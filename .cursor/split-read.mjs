#!/usr/bin/env node
/**
 * split-read: Read file content between markers, outputting only the target section.
 *
 * Used with Cursor Agent's Shell tool to achieve true on-demand reading, saving context tokens.
 *
 * Usage:
 *   node split-read.mjs <file> --before "<marker>"
 *   node split-read.mjs <file> --after "<marker>"
 *   node split-read.mjs <file> --start "<marker>" --end "<marker>"
 *   node split-read.mjs <file> --section "<name>"
 *   node split-read.mjs <file> --list-sections
 *
 * Options:
 *   --line-numbers      Show line numbers (for locating edits later)
 *   --exclude-markers   Exclude marker lines from output
 *
 * Section marker formats supported:
 *   <!--- section:NAME --->  /  <!--- /section:NAME --->
 *   <!-- section:NAME -->    /  <!-- /section:NAME -->
 *   <!--- split:NAME --->    /  <!--- /split:NAME --->
 *   <!-- split:NAME -->      /  <!-- /split:NAME -->
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function parseArgs(argv) {
  const args = { flags: {} };
  let i = 2;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--before' || arg === '--after' || arg === '--start' ||
        arg === '--end' || arg === '--section' || arg === '--encoding') {
      args.flags[arg.slice(2)] = argv[++i];
    } else if (arg === '--line-numbers') {
      args.flags.lineNumbers = true;
    } else if (arg === '--exclude-markers') {
      args.flags.excludeMarkers = true;
    } else if (arg === '--list-sections') {
      args.flags.listSections = true;
    } else if (arg === '--help' || arg === '-h') {
      args.flags.help = true;
    } else if (!arg.startsWith('-')) {
      args.file = arg;
    }
    i++;
  }
  return args;
}

function findMarkerLine(lines, marker) {
  const stripped = marker.trim();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().includes(stripped)) return i;
  }
  return null;
}

function findSectionBounds(lines, name) {
  const startRe = new RegExp(
    `<!-{2,3}\\s*(?:section|split):${escapeRegex(name)}\\s*-{2,3}>`, 'i'
  );
  const exactEndRe = new RegExp(
    `<!-{2,3}\\s*/(?:section|split):${escapeRegex(name)}\\s*-{2,3}>`, 'i'
  );
  const anyNextRe = new RegExp(
    `<!-{2,3}\\s*(?:section|split):\\S+\\s*-{2,3}>`, 'i'
  );

  let start = null;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) { start = i; break; }
  }
  if (start === null) return [null, null];

  for (let i = start + 1; i < lines.length; i++) {
    if (exactEndRe.test(lines[i])) return [start, i];
    if (anyNextRe.test(lines[i]) && !startRe.test(lines[i])) return [start, i];
  }
  return [start, lines.length];
}

function listAllSections(lines) {
  const re = /<!-{2,3}\s*(?:section|split):(\S+)\s*-{2,3}>/gi;
  const sections = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    let m;
    while ((m = re.exec(lines[i])) !== null) {
      const name = m[1];
      if (!name.startsWith('/') && !seen.has(name)) {
        seen.add(name);
        sections.push({ name, line: i + 1 });
      }
    }
  }
  return sections;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatOutput(lines, start, end, showLineNumbers) {
  const selected = lines.slice(start, end);
  if (showLineNumbers) {
    const width = String(end).length;
    return selected.map((line, i) =>
      `${String(start + i + 1).padStart(width)}| ${line}`
    ).join('\n');
  }
  return selected.join('\n');
}

function printHelp() {
  console.log(`split-read: Read file content between markers.

Usage:
  node split-read.mjs <file> --before "<marker>"          Read everything before marker
  node split-read.mjs <file> --after "<marker>"           Read everything after marker
  node split-read.mjs <file> --start "<s>" --end "<e>"    Read between two markers
  node split-read.mjs <file> --section "<name>"           Read named section
  node split-read.mjs <file> --list-sections              List all section markers

Options:
  --line-numbers       Show line numbers
  --exclude-markers    Exclude marker lines from output
  --encoding <enc>     File encoding (default: utf-8)
  -h, --help           Show this help`);
}

function main() {
  const { file, flags } = parseArgs(process.argv);

  if (flags.help) { printHelp(); return; }

  if (!file) {
    console.error('Error: no file specified');
    process.exit(1);
  }

  const filepath = resolve(file);
  let content;
  try {
    content = readFileSync(filepath, flags.encoding || 'utf-8');
  } catch (e) {
    console.error(`Error: cannot read file - ${e.message}`);
    process.exit(1);
  }

  const lines = content.split(/\r?\n/);

  if (flags.listSections) {
    const sections = listAllSections(lines);
    if (sections.length === 0) {
      console.log('No sections found.');
    } else {
      console.log('Sections found:');
      for (const s of sections) {
        console.log(`  ${s.name} (line ${s.line})`);
      }
    }
    return;
  }

  const modeCount = [flags.before, flags.after, flags.section, flags.start]
    .filter(Boolean).length;

  if (modeCount === 0) {
    console.error('Error: specify a mode (--before, --after, --start/--end, --section, --list-sections)');
    process.exit(1);
  }

  let result;

  if (flags.before) {
    const idx = findMarkerLine(lines, flags.before);
    if (idx === null) {
      console.error(`Warning: marker '${flags.before}' not found, outputting all content`);
      result = formatOutput(lines, 0, lines.length, flags.lineNumbers);
    } else {
      result = formatOutput(lines, 0, idx, flags.lineNumbers);
    }
  } else if (flags.after) {
    const idx = findMarkerLine(lines, flags.after);
    if (idx === null) {
      console.error(`Warning: marker '${flags.after}' not found, outputting all content`);
      result = formatOutput(lines, 0, lines.length, flags.lineNumbers);
    } else {
      const start = flags.excludeMarkers ? idx + 1 : idx;
      result = formatOutput(lines, start, lines.length, flags.lineNumbers);
    }
  } else if (flags.section) {
    const [s, e] = findSectionBounds(lines, flags.section);
    if (s === null) {
      console.error(`Error: section '${flags.section}' not found`);
      process.exit(1);
    }
    const start = flags.excludeMarkers ? s + 1 : s;
    const end = flags.excludeMarkers ? e : Math.min(e + 1, lines.length);
    result = formatOutput(lines, start, end, flags.lineNumbers);
  } else if (flags.start) {
    const sIdx = findMarkerLine(lines, flags.start);
    if (sIdx === null) {
      console.error(`Error: start marker '${flags.start}' not found`);
      process.exit(1);
    }
    let eIdx;
    if (flags.end) {
      eIdx = findMarkerLine(lines, flags.end);
      if (eIdx === null) {
        console.error(`Warning: end marker '${flags.end}' not found, reading to end of file`);
        eIdx = lines.length;
      }
    } else {
      eIdx = lines.length;
    }
    const start = flags.excludeMarkers ? sIdx + 1 : sIdx;
    const end = flags.excludeMarkers ? eIdx : Math.min(eIdx + 1, lines.length);
    result = formatOutput(lines, start, end, flags.lineNumbers);
  }

  console.log(result);
}

main();
