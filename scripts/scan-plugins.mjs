#!/usr/bin/env node
// Gate scanner (spec §5 and standing rule 5).
//
// Runs against the WHOLE plugin directory — references/, scripts/, assets/, examples/ —
// not just SKILL.md. Any failure fails the run.
//
//   node scripts/scan-plugins.mjs                      # every plugin, internal rules
//   node scripts/scan-plugins.mjs --promotion          # stricter: what may go public
//   node scripts/scan-plugins.mjs --plugin <dir> ...   # only these
//   node scripts/scan-plugins.mjs --json               # machine-readable report
//
// Internal mode (CI on every PR):
//   fail  secrets · absolute paths · internal hosts · missing/invalid surface keyword ·
//         components inside .claude-plugin/ · skills without frontmatter · oversize files
//   warn  third-party PII · code-only signals in a plugin marked surface:both
//
// Promotion mode (promote.mjs, and CI in the public repo):
//   everything above fails, plus: surface must be `both`; no bin/, monitors/, .lsp.json;
//   no code-only signals at all.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  repoRoot, discoverPlugins, surfaceOf, SURFACES, walkFiles, isTextFile, fileSize, color, parseArgs, MANIFEST,
} from "./lib/plugins.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(here, "gates.config.json"), "utf8"));

function compile(list) {
  return list.map((r) => ({ ...r, re: new RegExp(r.pattern, r.ignoreCase ? "i" : "") }));
}
const RULES = {
  secrets: compile(CONFIG.secrets),
  absolutePaths: compile(CONFIG.absolutePaths),
  internalHosts: compile(CONFIG.internalHosts),
  pii: compile(CONFIG.pii),
  codeOnlySignals: compile(CONFIG.codeOnlySignals),
};

/**
 * Scan one plugin directory. Returns { name, dir, surface, failures: [], warnings: [], files: n, bytes: n }.
 * Each finding: { gate, file, line, snippet, note }.
 */
export function scanPlugin(plugin, { promotion = false } = {}) {
  const failures = [];
  const warnings = [];
  const fail = (gate, file, line, snippet, note) => failures.push({ gate, file, line, snippet, note });
  const warn = (gate, file, line, snippet, note) => warnings.push({ gate, file, line, snippet, note });

  const m = plugin.manifest;
  const surface = surfaceOf(m);

  // --- manifest sanity ---
  if (!m.name || m.name !== plugin.dir) fail("manifest", MANIFEST, 0, `name=${JSON.stringify(m.name)}`, `plugin.json name must equal the directory name (${plugin.dir})`);
  if (!m.description) fail("manifest", MANIFEST, 0, "", "plugin.json needs a description (it is what people see in the catalog)");
  if (!surface) fail("surface", MANIFEST, 0, JSON.stringify(m.keywords ?? []), 'keywords must include "surface:both" or "surface:code-only" (or "surface:verify" while untested on Cowork)');
  else if (!SURFACES.includes(surface)) fail("surface", MANIFEST, 0, `surface:${surface}`, `unknown surface value; use one of ${SURFACES.join(", ")}`);
  if (promotion && surface !== "both") fail("surface", MANIFEST, 0, `surface:${surface ?? "missing"}`, "only surface:both plugins can be promoted — realtors are Cowork-only");

  // --- layout ---
  const dotPlugin = join(plugin.path, ".claude-plugin");
  if (existsSync(dotPlugin)) {
    for (const e of readdirSync(dotPlugin)) {
      if (e !== "plugin.json") fail("layout", `.claude-plugin/${e}`, 0, "", "only plugin.json belongs in .claude-plugin/ — move components to the plugin root");
    }
  }
  const skillsDir = join(plugin.path, "skills");
  if (existsSync(skillsDir)) {
    for (const s of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const skillMd = join(skillsDir, s.name, "SKILL.md");
      if (!existsSync(skillMd)) { fail("layout", `skills/${s.name}`, 0, "", "skill directory has no SKILL.md"); continue; }
      const fm = frontmatter(readFileSync(skillMd, "utf8"));
      if (!fm) fail("skill", `skills/${s.name}/SKILL.md`, 1, "", "SKILL.md must start with YAML frontmatter (name + description)");
      else {
        if (!fm.name) fail("skill", `skills/${s.name}/SKILL.md`, 1, "", "frontmatter is missing name");
        if (!fm.description) fail("skill", `skills/${s.name}/SKILL.md`, 1, "", "frontmatter is missing description — it is the only thing Claude reads to decide whether to fire the skill");
        else if (fm.description.length < 60) warn("skill", `skills/${s.name}/SKILL.md`, 1, fm.description, "description is short; write when-to-use trigger phrases, not what-it-is");
      }
    }
  } else {
    const hasOther = ["commands", "agents", "hooks", ".mcp.json", "workflows"].some((p) => existsSync(join(plugin.path, p)));
    if (!hasOther) fail("layout", "skills/", 0, "", "plugin has no skills/ (or any other component) — nothing would install");
  }

  // --- code-only components ---
  for (const d of CONFIG.codeOnlyDirs) {
    if (existsSync(join(plugin.path, d))) {
      const msg = `${d}/ does not run in Cowork`;
      if (promotion || surface === "both") fail("code-only", `${d}/`, 0, "", promotion ? msg + " — not promotable" : msg + " — mark surface:code-only or remove it");
    }
  }
  for (const f of CONFIG.codeOnlyFiles) {
    if (existsSync(join(plugin.path, f))) {
      const msg = `${f} does not run in Cowork`;
      if (promotion || surface === "both") fail("code-only", f, 0, "", promotion ? msg + " — not promotable" : msg + " — mark surface:code-only or remove it");
    }
  }

  // --- content scans over every file ---
  const files = walkFiles(plugin.path);
  let bytes = 0;
  for (const rel of files) {
    const full = join(plugin.path, rel);
    const size = fileSize(full);
    bytes += size;
    if (size > CONFIG.maxFileBytes) fail("size", rel, 0, `${(size / 1e6).toFixed(1)} MB`, `file exceeds ${CONFIG.maxFileBytes / 1e6} MB`);
    if (rel === ".env" || rel.endsWith("/.env") || /\.(pem|key|p12|pfx)$/i.test(rel)) fail("secrets", rel, 0, "", "credential-looking file committed");
    if (!isTextFile(rel)) continue;

    const text = readFileSync(full, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const ln = i + 1;
      for (const r of RULES.secrets) if (r.re.test(line)) fail("secrets", rel, ln, redact(line), r.note);
      for (const r of RULES.absolutePaths) if (r.re.test(line)) fail("absolute-path", rel, ln, trim(line), r.note);
      for (const r of RULES.internalHosts) {
        const hit = r.re.exec(line);
        if (hit && !CONFIG.allowedHosts.some((h) => line.includes(h) && hit[0].includes(h))) fail("internal-host", rel, ln, trim(line), r.note);
      }
      for (const r of RULES.pii) {
        const re = new RegExp(r.re.source, r.re.flags + "g");
        let hit;
        while ((hit = re.exec(line))) {
          const val = hit[0];
          if ((r.allow ?? []).some((a) => val.includes(a))) continue;
          (promotion ? fail : warn)("pii", rel, ln, val, `${r.note} — third-party personal data does not belong in a repo (public or one promotion away from it)`);
        }
      }
      for (const r of RULES.codeOnlySignals) {
        if (r.re.test(line)) {
          if (promotion) fail("code-only", rel, ln, trim(line), r.note + " — will silently do nothing for realtors on Cowork");
          else if (surface === "both") warn("code-only", rel, ln, trim(line), r.note + " — re-run the portability checklist; is this really surface:both?");
        }
      }
    });
  }
  if (bytes > CONFIG.maxPluginBytes) fail("size", ".", 0, `${(bytes / 1e6).toFixed(1)} MB`, `plugin exceeds ${CONFIG.maxPluginBytes / 1e6} MB`);

  return { name: plugin.name ?? plugin.dir, dir: plugin.dir, version: plugin.version, surface, failures, warnings, files: files.length, bytes };
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  // Split on CRLF as well as LF. `.` and `$` in the key/value regex below don't
  // match a trailing \r, so a Windows checkout would report every skill as
  // "frontmatter is missing name".
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    // YAML block scalars (description: >- / | ) continue on the following indented lines.
    if (/^[>|][+-]?$/.test(value)) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.join(" ");
    }
    out[kv[1]] = value.replace(/^["']|["']$/g, "").trim();
  }
  return out;
}
function trim(s) { return s.trim().slice(0, 140); }
function redact(s) { return s.trim().replace(/[A-Za-z0-9._~+/=-]{12,}/g, (t) => t.slice(0, 4) + "…" + t.slice(-2)).slice(0, 140); }

export function formatReport(results, { promotion }) {
  const lines = [];
  for (const r of results) {
    const ok = r.failures.length === 0;
    lines.push(`${ok ? color.green("✓") : color.red("✗")} ${r.name}@${r.version ?? "?"}  surface:${r.surface ?? "missing"}  ${r.files} files, ${(r.bytes / 1e3).toFixed(0)} KB${r.warnings.length ? `  ${color.yellow(r.warnings.length + " warning" + (r.warnings.length === 1 ? "" : "s"))}` : ""}`);
    for (const f of r.failures) lines.push(`    ${color.red("FAIL")} ${f.gate.padEnd(13)} ${f.file}${f.line ? ":" + f.line : ""}  ${f.snippet ? color.dim(f.snippet) + "  " : ""}— ${f.note}`);
    for (const w of r.warnings.slice(0, 25)) lines.push(`    ${color.yellow("warn")} ${w.gate.padEnd(13)} ${w.file}${w.line ? ":" + w.line : ""}  ${w.snippet ? color.dim(w.snippet) + "  " : ""}— ${w.note}`);
    if (r.warnings.length > 25) lines.push(`    ${color.yellow("warn")} … ${r.warnings.length - 25} more warnings (run with --json for all)`);
  }
  const failed = results.filter((r) => r.failures.length);
  lines.push("");
  lines.push(failed.length
    ? `${failed.length} of ${results.length} plugins failed the ${promotion ? "promotion" : "internal"} gates. Nothing ${promotion ? "is published" : "merges"} until this is clean.`
    : `All ${results.length} plugins passed the ${promotion ? "promotion" : "internal"} gates.`);
  return lines.join("\n");
}

// ---- CLI ----
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { flags } = parseArgs(process.argv.slice(2));
  const root = flags.root || repoRoot();
  const promotion = Boolean(flags.promotion);
  let plugins = discoverPlugins(root);
  if (flags.plugin) {
    const want = String(flags.plugin).split(",");
    plugins = plugins.filter((p) => want.includes(p.dir) || want.includes(p.name));
    const missing = want.filter((w) => !plugins.some((p) => p.dir === w || p.name === w));
    if (missing.length) { console.error(`✗ no such plugin: ${missing.join(", ")}`); process.exit(2); }
  }
  const results = plugins.map((p) => scanPlugin(p, { promotion }));
  if (flags.json) console.log(JSON.stringify({ promotion, results }, null, 2));
  else console.log(formatReport(results, { promotion }));
  process.exit(results.some((r) => r.failures.length) ? 1 : 0);
}
