// Shared helpers for the Loan Ark plugin pipeline.
// Pure Node 22 — no dependencies, so CI and laptops run it as-is.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";

export const MANIFEST = join(".claude-plugin", "plugin.json");
export const MARKETPLACE = join(".claude-plugin", "marketplace.json");

/** Directories that are never plugins, even if someone drops a manifest in them. */
const NOT_PLUGINS = new Set([".git", ".github", "node_modules", "scripts", "docs", "test", "tests", ".claude-plugin", ".claude"]);

/** Root of the repository the script is running in (git toplevel, else cwd). */
export function repoRoot(from = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: from, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return resolve(from);
  }
}

/** Parse JSON with a useful error that names the file. */
export function readJson(path) {
  const text = readFileSync(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${path}: invalid JSON — ${err.message}`);
  }
}

/**
 * Every plugin in the repo: a top-level directory that contains .claude-plugin/plugin.json.
 * Returns [{ dir, name, version, manifest, manifestPath }] sorted by directory name.
 */
export function discoverPlugins(root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || NOT_PLUGINS.has(entry.name) || entry.name.startsWith(".")) continue;
    const manifestPath = join(root, entry.name, MANIFEST);
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    out.push({
      dir: entry.name,
      path: join(root, entry.name),
      name: manifest.name,
      version: manifest.version,
      manifest,
      manifestPath,
    });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

/** The `surface:*` keyword from a manifest, or null when missing. */
export function surfaceOf(manifest) {
  const kw = Array.isArray(manifest?.keywords) ? manifest.keywords : [];
  const hit = kw.find((k) => typeof k === "string" && k.startsWith("surface:"));
  return hit ? hit.slice("surface:".length) : null;
}

export const SURFACES = ["both", "code-only", "verify"];

// ---------- semver (the subset we need; no prerelease games) ----------

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

export function isSemver(v) {
  return typeof v === "string" && SEMVER.test(v);
}

/** -1, 0, 1 like a comparator. Prerelease sorts below its release. */
export function compareSemver(a, b) {
  const ma = SEMVER.exec(a);
  const mb = SEMVER.exec(b);
  if (!ma || !mb) throw new Error(`compareSemver: not semver: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  const pa = ma[4], pb = mb[4];
  if (pa === pb) return 0;
  if (pa === undefined) return 1;
  if (pb === undefined) return -1;
  return pa < pb ? -1 : 1;
}

// ---------- file walking ----------

const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".DS_Store"]);

/** Every file under dir (relative paths, forward slashes), skipping VCS/junk. */
export function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else if (entry.isFile()) out.push(relative(base, full).split(sep).join("/"));
  }
  return out.sort();
}

const TEXT_EXT = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".ps1",
  ".html", ".htm", ".css", ".svg", ".csv", ".xml", ".env", ".ini", ".cfg", ".rb", ".go", ".rs", ".sql", "",
]);

export function isTextFile(relPath) {
  const dot = relPath.lastIndexOf(".");
  const slash = relPath.lastIndexOf("/");
  const ext = dot > slash ? relPath.slice(dot).toLowerCase() : "";
  return TEXT_EXT.has(ext);
}

export function fileSize(path) {
  return statSync(path).size;
}

// ---------- git helpers ----------

export function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Contents of a file at a ref, or null if it did not exist there. */
export function gitShow(ref, relPath, cwd) {
  try {
    return execFileSync("git", ["show", `${ref}:${relPath}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

export function gitChangedFiles(base, head, cwd) {
  const out = git(["diff", "--name-only", `${base}..${head}`], cwd);
  return out ? out.split("\n").filter(Boolean) : [];
}

export function tagExists(tag, cwd) {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function releaseTag(name, version) {
  return `${name}--v${version}`;
}

// ---------- output ----------

export const color = {
  red: (s) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s),
};

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}
