#!/usr/bin/env node
/**
 * 游戏开发包同步脚本
 *
 * 放置在游戏项目的 .cursor/sync.mjs，通过 .cursor/skill-source 定位源仓库。
 * 同步范围：skills、rules、vite.config、脚本等所有开发包内容。
 *
 * 用法:
 *   node .cursor/sync.mjs update  # 一键更新：git pull → install → 同步到项目
 *   node .cursor/sync.mjs pull    # 从源仓库拉取最新开发包到本项目
 *   node .cursor/sync.mjs push    # 把本项目的 skill 修改推回源仓库
 *   node .cursor/sync.mjs diff    # 查看本项目与源仓库之间的差异
 */
import { readFileSync, existsSync, readdirSync, statSync, cpSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, "..");
const SOURCE_FILE = join(__dirname, "skill-source");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".vite"]);

/**
 * Toolkit file mapping: [sourceRepoRelPath, projectRelPath]
 * Directories are synced recursively (node_modules excluded).
 * These are generic dev-kit files, NOT game-specific code.
 */
const TOOLKIT_MAP = [
  ["boilerplate-common/vite.config.ts", "vite.config.ts"],
  ["boilerplate-common/scripts", "scripts"],
  ["sync.mjs", ".cursor/sync.mjs"],
  ["split-read.mjs", ".cursor/split-read.mjs"],
];

/**
 * 3D framework files — only synced when project has src/core/ (i.e. 3D project).
 * These are framework infrastructure, NOT game-specific code.
 */
const TOOLKIT_MAP_3D = [
  ["boilerplate-3d/src/core", "src/core"],
  ["boilerplate-3d/src/types/core.ts", "src/types/core.ts"],
  ["boilerplate-3d/specs/core", "specs/core"],
  ["boilerplate-3d/specs/_index.md", "specs/_index.md"],
];

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!existsSync(SOURCE_FILE)) {
  die(
    `找不到 ${SOURCE_FILE}\n` +
    `   请手动创建该文件，内容为源仓库的绝对路径。\n` +
    `   例如: E:/cursor-plugin-web-game`
  );
}

const SOURCE_DIR = readFileSync(SOURCE_FILE, "utf-8").trim();
if (!existsSync(SOURCE_DIR)) {
  die(
    `源仓库路径不存在: ${SOURCE_DIR}\n` +
    `   请检查 ${SOURCE_FILE} 中的路径是否正确。`
  );
}

const SOURCE_SKILLS = join(SOURCE_DIR, "bundled-skills");
const SOURCE_RULES = join(SOURCE_DIR, "bundled-rules");
const PROJECT_SKILLS = join(PROJECT_DIR, ".cursor", "skills");
const PROJECT_RULES = join(PROJECT_DIR, ".cursor", "rules");

const command = process.argv[2];

if (!command || !["update", "pull", "push", "diff"].includes(command)) {
  console.log(`
游戏开发包同步工具

用法:
  node .cursor/sync.mjs update  一键更新（git pull → install → 同步到项目）
  node .cursor/sync.mjs pull    从源仓库拉取到本项目（不更新 git）
  node .cursor/sync.mjs push    把本项目的 skill 修改推回源仓库
  node .cursor/sync.mjs diff    查看差异

同步范围: skills + rules + vite.config + 脚本

源仓库: ${SOURCE_DIR}
项目:   ${PROJECT_DIR}
`);
  process.exit(0);
}

// ── 工具函数 ────────────────────────────────

function getAllFiles(dir, base = dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      results.push(...getAllFiles(full, base));
    } else {
      results.push(relative(base, full));
    }
  }
  return results;
}

function getSubDirs(baseDir) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir).filter(
    (n) => !SKIP_DIRS.has(n) && statSync(join(baseDir, n)).isDirectory()
  );
}

function compareFiles(fileA, fileB) {
  if (!existsSync(fileA) && !existsSync(fileB)) return "both_missing";
  if (!existsSync(fileA)) return "only_b";
  if (!existsSync(fileB)) return "only_a";
  const a = readFileSync(fileA);
  const b = readFileSync(fileB);
  return a.equals(b) ? "same" : "different";
}

function statusIcon(result) {
  return result === "only_a" ? "  + 仅源仓库" :
         result === "only_b" ? "  - 仅项目  " :
         "  ≠ 有差异  ";
}

// ── Skills ──────────────────────────────────

function diffSkills(sourceBase, projectBase) {
  const skills = getSubDirs(sourceBase);
  let hasChanges = false;

  for (const skill of skills) {
    const srcDir = join(sourceBase, skill);
    const dstDir = join(projectBase, skill);
    const allFiles = new Set([
      ...getAllFiles(srcDir, srcDir),
      ...getAllFiles(dstDir, dstDir),
    ]);

    for (const file of [...allFiles].sort()) {
      const result = compareFiles(join(srcDir, file), join(dstDir, file));
      if (result === "same") continue;
      hasChanges = true;
      console.log(`${statusIcon(result)}  skills/${skill}/${file}`);
    }
  }
  return hasChanges;
}

function syncSkills(from, to, label) {
  const skills = getSubDirs(from);
  for (const skill of skills) {
    const src = join(from, skill);
    const dst = join(to, skill);
    cpSync(src, dst, {
      recursive: true,
      force: true,
      filter: (s) => !SKIP_DIRS.has(s.split(/[/\\]/).pop()),
    });
    console.log(`  ✓ ${label}/${skill}/`);
  }
}

// ── Rules ───────────────────────────────────

function diffRules(sourceBase, projectBase) {
  if (!existsSync(sourceBase)) return false;
  let hasChanges = false;
  const rules = readdirSync(sourceBase).filter((n) => n.endsWith(".mdc"));

  for (const rule of rules) {
    const result = compareFiles(join(sourceBase, rule), join(projectBase, rule));
    if (result === "same") continue;
    hasChanges = true;
    console.log(`${statusIcon(result)}  rules/${rule}`);
  }
  return hasChanges;
}

function syncRules(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  const rules = readdirSync(from).filter((n) => n.endsWith(".mdc"));
  for (const rule of rules) {
    cpSync(join(from, rule), join(to, rule), { force: true });
    console.log(`  ✓ rules/${rule}`);
  }
}

// ── Toolkit files ───────────────────────────

function diffToolkitEntries(entries, sourceDir, projectDir) {
  let hasChanges = false;

  for (const [srcRel, dstRel] of entries) {
    const srcPath = join(sourceDir, srcRel);
    const dstPath = join(projectDir, dstRel);

    if (!existsSync(srcPath)) continue;

    if (statSync(srcPath).isDirectory()) {
      const allFiles = new Set([
        ...getAllFiles(srcPath, srcPath),
        ...(existsSync(dstPath) ? getAllFiles(dstPath, dstPath) : []),
      ]);
      for (const file of [...allFiles].sort()) {
        const result = compareFiles(join(srcPath, file), join(dstPath, file));
        if (result === "same") continue;
        hasChanges = true;
        console.log(`${statusIcon(result)}  ${dstRel}/${file}`);
      }
    } else {
      const result = compareFiles(srcPath, dstPath);
      if (result === "same") continue;
      hasChanges = true;
      console.log(`${statusIcon(result)}  ${dstRel}`);
    }
  }
  return hasChanges;
}

function diffToolkit(sourceDir, projectDir) {
  let hasChanges = diffToolkitEntries(TOOLKIT_MAP, sourceDir, projectDir);

  if (existsSync(join(projectDir, "src", "core"))) {
    const has3D = diffToolkitEntries(TOOLKIT_MAP_3D, sourceDir, projectDir);
    hasChanges = hasChanges || has3D;
  }

  return hasChanges;
}

function syncToolkitEntries(entries, sourceDir, projectDir) {
  for (const [srcRel, dstRel] of entries) {
    const srcPath = join(sourceDir, srcRel);
    const dstPath = join(projectDir, dstRel);

    if (!existsSync(srcPath)) continue;

    const parentDir = dirname(dstPath);
    mkdirSync(parentDir, { recursive: true });

    if (statSync(srcPath).isDirectory()) {
      cpSync(srcPath, dstPath, {
        recursive: true,
        force: true,
        filter: (s) => !SKIP_DIRS.has(s.split(/[/\\]/).pop()),
      });
    } else {
      cpSync(srcPath, dstPath, { force: true });
    }
    console.log(`  ✓ ${dstRel}`);
  }
}

function syncToolkit(sourceDir, projectDir) {
  syncToolkitEntries(TOOLKIT_MAP, sourceDir, projectDir);

  if (existsSync(join(projectDir, "src", "core"))) {
    console.log("── 3D Core ──");
    syncToolkitEntries(TOOLKIT_MAP_3D, sourceDir, projectDir);
  }
}

// ── 命令实现 ────────────────────────────────

function run(cmd, cwd) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function doPull() {
  console.log("── Skills ──");
  syncSkills(SOURCE_SKILLS, PROJECT_SKILLS, "skills");

  console.log("── Rules ──");
  syncRules(SOURCE_RULES, PROJECT_RULES);

  console.log("── Toolkit ──");
  syncToolkit(SOURCE_DIR, PROJECT_DIR);
}

if (command === "update") {
  console.log(`\n🔄 更新开发包`);
  console.log(`   源仓库: ${SOURCE_DIR}`);
  console.log(`   项目:   ${PROJECT_DIR}\n`);

  console.log("── 1. Git Pull ──");
  try {
    run("git pull", SOURCE_DIR);
  } catch {
    die("git pull 失败，请检查源仓库状态。");
  }

  console.log("\n── 2. Install（更新全局 Skill） ──");
  const installScript = join(SOURCE_DIR, "install.mjs");
  if (existsSync(installScript)) {
    try {
      run(`node install.mjs`, SOURCE_DIR);
    } catch {
      console.log("  ⚠ install 失败，跳过全局安装，继续同步到项目...");
    }
  } else {
    console.log("  ⚠ install.mjs 不存在，跳过全局安装");
  }

  console.log("\n── 3. 同步到项目 ──");
  doPull();

  console.log("\n✅ 更新完成。\n");
}

if (command === "diff") {
  console.log(`\n📋 差异对比`);
  console.log(`   源仓库: ${SOURCE_DIR}`);
  console.log(`   项目:   ${PROJECT_DIR}\n`);

  const s = diffSkills(SOURCE_SKILLS, PROJECT_SKILLS);
  const r = diffRules(SOURCE_RULES, PROJECT_RULES);
  const t = diffToolkit(SOURCE_DIR, PROJECT_DIR);

  if (!s && !r && !t) {
    console.log("  ✓ 没有差异，已同步。");
  }
  console.log("");
}

if (command === "pull") {
  console.log(`\n⬇️  拉取: 源仓库 → 本项目`);
  console.log(`   源仓库: ${SOURCE_DIR}\n`);

  doPull();

  console.log("\n✅ 拉取完成。\n");
}

if (command === "push") {
  console.log(`\n⬆️  推送: 本项目 → 源仓库`);
  console.log(`   源仓库: ${SOURCE_DIR}\n`);

  syncSkills(PROJECT_SKILLS, SOURCE_SKILLS, "skills");

  console.log("\n✅ 推送完成。");
  console.log("   注意：仅推送 skills。rules 和 toolkit 由源仓库统一管理。\n");
}
