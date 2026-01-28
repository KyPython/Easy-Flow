#!/usr/bin/env node
/**
 * Validate heading hierarchy in JSX/TSX files.
 *
 * Rule (simple + fast): any <h3> must be preceded by an <h2> somewhere earlier in the same file.
 * This mirrors the CI failure you hit and makes it catchable early in Dev CI / pre-commit.
 *
 * Usage:
 *   node scripts/validate-heading-hierarchy.js [fileOrDir ...]
 */

const fs = require('fs');
const path = require('path');

// Keep default scope tight to known problematic pages/components.
// Pass explicit file/dir args to validate other areas.
const DEFAULT_TARGETS = [
  path.join('rpa-system', 'rpa-dashboard', 'src', 'components', 'WorkflowCreationPrompt', 'WorkflowCreationPrompt.jsx'),
  path.join('rpa-system', 'rpa-dashboard', 'src', 'pages', 'HistoryPage.jsx'),
  path.join('rpa-system', 'rpa-dashboard', 'src', 'pages', 'IntegrationsPage.jsx'),
  path.join('rpa-system', 'rpa-dashboard', 'src', 'pages', 'WebhooksPage.jsx')
];

const args = process.argv.slice(2);
const targets = args.length ? args : DEFAULT_TARGETS;

function isCodeFile(p) {
  return p.endsWith('.jsx') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.ts');
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // skip typical heavy dirs
      if (ent.name === 'node_modules' || ent.name === 'build' || ent.name === 'dist') continue;
      out.push(...walk(full));
      continue;
    }
    if (ent.isFile() && isCodeFile(full)) out.push(full);
  }
  return out;
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const files = [];
for (const t of targets) {
  const abs = path.isAbsolute(t) ? t : path.join(process.cwd(), t);
  if (!fs.existsSync(abs)) continue;
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    files.push(...walk(abs));
  } else if (stat.isFile()) {
    files.push(abs);
  }
}

const failures = [];

for (const file of files) {
  const content = readSafe(file);
  if (!content) continue;

  const h2Index = content.search(/<h2\b/i);
  const h3Matches = [...content.matchAll(/<h3\b/gi)];

  if (h3Matches.length === 0) continue;

  // If there are h3s and no h2 at all, or the first h3 appears before the first h2, fail.
  if (h2Index === -1) {
    failures.push({
      file,
      reason: 'Found <h3> but no <h2> in file'
    });
    continue;
  }

  const firstH3Index = h3Matches[0].index ?? -1;
  if (firstH3Index !== -1 && firstH3Index < h2Index) {
    failures.push({
      file,
      reason: 'Found <h3> before first <h2>'
    });
  }
}

if (failures.length) {
  console.error('❌ Heading hierarchy validation failed.');
  console.error('   Rule: any <h3> must be preceded by an <h2> earlier in the same file.');
  for (const f of failures) {
    const rel = path.relative(process.cwd(), f.file);
    console.error(`- ${rel}: ${f.reason}`);
  }
  process.exit(1);
}

console.log('✅ Heading hierarchy validation passed.');
