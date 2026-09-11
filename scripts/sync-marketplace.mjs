#!/usr/bin/env node
// Generate .claude-plugin/marketplace.json from every plugin's plugin.json (spec §4).
//
// plugin.json is the single source of truth. This script derives the marketplace
// catalog from it so the two can never disagree. Fields that only live in the
// marketplace (category, tags, displayName) are preserved from the existing entry.
//
//   node scripts/sync-marketplace.mjs            # write the file
//   node scripts/sync-marketplace.mjs --check    # exit 1 if the file is out of date
//   node scripts/sync-marketplace.mjs --root <dir> --name <marketplace-name>

import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot, discoverPlugins, readJson, MARKETPLACE, color, parseArgs } from "./lib/plugins.mjs";

const DEFAULTS = {
  name: "loanark-tools",
  owner: { name: "Loan Ark Inc.", url: "https://github.com/LoanArkAI" },
  metadata: { description: "Internal Claude plugins for Loan Ark staff.", version: "1.0.0" },
};

export function buildMarketplace(root, { name } = {}) {
  const path = join(root, MARKETPLACE);
  const existing = existsSync(path) ? readJson(path) : {};
  const existingEntries = new Map((existing.plugins ?? []).map((p) => [p.name, p]));
  const plugins = discoverPlugins(root);

  const entries = plugins.map((p) => {
    const prev = existingEntries.get(p.name) ?? {};
    const m = p.manifest;
    const entry = {
      name: p.name,
      source: `./${p.dir}`,
      version: p.version,
      description: m.description ?? prev.description ?? "",
    };
    if (m.displayName ?? prev.displayName) entry.displayName = m.displayName ?? prev.displayName;
    if (m.author) entry.author = m.author;
    if (m.homepage) entry.homepage = m.homepage;
    if (m.repository) entry.repository = m.repository;
    if (m.license) entry.license = m.license;
    if (Array.isArray(m.keywords) && m.keywords.length) entry.keywords = m.keywords;
    entry.category = prev.category ?? "workflow";
    if (Array.isArray(prev.tags) && prev.tags.length) entry.tags = prev.tags;
    return entry;
  });

  // Plugins that were in the catalog but no longer exist are recorded as removed
  // (renames: { old: null }) so clients that understand it stop offering updates.
  const removed = [...existingEntries.keys()].filter((n) => !plugins.some((p) => p.name === n));
  const renames = { ...(existing.renames ?? {}) };
  for (const n of removed) renames[n] = null;

  const out = {
    name: name ?? existing.name ?? DEFAULTS.name,
    owner: existing.owner ?? DEFAULTS.owner,
    metadata: existing.metadata ?? DEFAULTS.metadata,
    plugins: entries,
  };
  if (Object.keys(renames).length) out.renames = renames;
  return { out, path, removed };
}

export function serialize(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

// ---- CLI ----
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { flags } = parseArgs(process.argv.slice(2));
  const root = flags.root ? flags.root : repoRoot();
  const { out, path, removed } = buildMarketplace(root, { name: flags.name });
  const next = serialize(out);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;

  if (flags.check) {
    if (current === next) {
      console.log(`${color.green("✓")} ${MARKETPLACE} is in sync with plugin.json (${out.plugins.length} plugins)`);
      process.exit(0);
    }
    console.log(`${color.red("✗")} ${MARKETPLACE} is out of date. Run: node scripts/sync-marketplace.mjs`);
    process.exit(1);
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  const changed = current !== next;
  console.log(`${changed ? color.green("✓ wrote") : color.dim("• unchanged")} ${MARKETPLACE} — ${out.plugins.length} plugins`);
  for (const p of out.plugins) console.log(`  ${p.name}@${p.version}`);
  for (const n of removed) console.log(`  ${color.yellow("removed")} ${n}`);
}
