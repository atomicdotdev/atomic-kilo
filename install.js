#!/usr/bin/env node

/**
 * atomic-kilo install
 *
 * Global install:  symlinks rules, agent mode, and AGENTS.md into
 *                  ~/.config/kilo/ so they apply to every project.
 *
 * Project install: copies AGENTS.md and kilo.jsonc into a project directory,
 *                  then runs `atomic agent enable --agent kilo` to wire up
 *                  hook recording.
 *
 * Usage:
 *   npx atomic-kilo                          # global install (default)
 *   npx atomic-kilo --project /path/to/proj  # set up a project
 *   npx atomic-kilo --global --project .     # both at once
 *   node install.js --silent                 # postinstall (global, quiet)
 *   node install.js --uninstall              # remove global symlinks
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const silent = process.argv.includes("--silent");
const uninstall = process.argv.includes("--uninstall");
const wantGlobal =
  process.argv.includes("--global") ||
  (!process.argv.includes("--project") && !uninstall);
const projectIdx = process.argv.indexOf("--project");
const projectPath =
  projectIdx !== -1 ? process.argv[projectIdx + 1] || null : null;

const PKG_DIR = __dirname;
const KILO_CONFIG_DIR = path.join(os.homedir(), ".config", "kilo");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isOurSymlink(dstPath) {
  try {
    if (!fs.lstatSync(dstPath).isSymbolicLink()) return false;
    return fs.readlinkSync(dstPath).startsWith(PKG_DIR);
  } catch {
    return false;
  }
}

function symlinkSafe(src, dst) {
  if (fs.existsSync(dst) && !isOurSymlink(dst)) {
    return false; // user's own file — don't overwrite
  }
  if (fs.existsSync(dst) || isOurSymlink(dst)) {
    fs.unlinkSync(dst);
  }
  ensureDir(path.dirname(dst));
  fs.symlinkSync(src, dst);
  return true;
}

function tryExec(cmd, opts) {
  try {
    execSync(cmd, { stdio: "pipe", ...opts });
    return true;
  } catch {
    return false;
  }
}

function tryExecShow(cmd, opts) {
  try {
    const out = execSync(cmd, { encoding: "utf8", ...opts });
    if (out.trim()) console.log(out.trimEnd());
    return true;
  } catch (e) {
    if (e.stdout) console.log(e.stdout.toString().trimEnd());
    if (e.stderr) console.error(e.stderr.toString().trimEnd());
    return false;
  }
}

// ---------------------------------------------------------------------------
// Global install → ~/.config/kilo/
// ---------------------------------------------------------------------------

function doGlobalInstall() {
  if (!silent && !tryExec("atomic --version")) {
    console.warn(
      "  note: 'atomic' not on PATH — install it so the hooks work at runtime",
    );
  }

  let rulesLinked = 0;
  let agentsLinked = 0;

  // 1. Symlink rules → ~/.config/kilo/rules/
  const rulesTarget = path.join(KILO_CONFIG_DIR, "rules");
  const rulesSrc = path.join(PKG_DIR, "rules", "atomic.md");
  const rulesDst = path.join(rulesTarget, "atomic.md");
  if (fs.existsSync(rulesSrc) && symlinkSafe(rulesSrc, rulesDst)) {
    rulesLinked++;
    if (!silent) console.log("  rules:  atomic.md → ~/.config/kilo/rules/");
  }

  // 2. Symlink agent mode → ~/.config/kilo/agent/
  const agentTarget = path.join(KILO_CONFIG_DIR, "agent");
  const agentSrc = path.join(PKG_DIR, "agents", "atomic.md");
  const agentDst = path.join(agentTarget, "atomic.md");
  if (fs.existsSync(agentSrc) && symlinkSafe(agentSrc, agentDst)) {
    agentsLinked++;
    if (!silent) console.log("  agents: atomic.md → ~/.config/kilo/agent/");
  }

  // 3. Copy AGENTS.md → ~/.config/kilo/AGENTS.md
  //
  // We copy instead of symlink because Kilo's findUp follows symlinks and
  // walks the resolved target's parent directories. A symlink into the
  // atomic-kilo checkout (~/Projects/agents/...) causes findUp to traverse
  // all the way to ~/ where it discovers ~/.agents/skills/ and fails to
  // parse Zed-specific SKILL.md files. Copying keeps the file rooted in
  // ~/.config/kilo/ so findUp stays within the config directory.
  const agentsMdSrc = path.join(PKG_DIR, "AGENTS.md");
  const agentsMdDst = path.join(KILO_CONFIG_DIR, "AGENTS.md");
  let promptLinked = false;
  if (fs.existsSync(agentsMdSrc)) {
    // Remove old symlink from a previous install
    if (isOurSymlink(agentsMdDst)) {
      fs.unlinkSync(agentsMdDst);
    }
    if (!fs.existsSync(agentsMdDst)) {
      ensureDir(KILO_CONFIG_DIR);
      fs.copyFileSync(agentsMdSrc, agentsMdDst);
      promptLinked = true;
      if (!silent) console.log("  prompt: AGENTS.md copied → ~/.config/kilo/");
    } else {
      if (!silent)
        console.log("  prompt: ~/.config/kilo/AGENTS.md already exists");
    }
  }

  // 4. Symlink plugin → ~/.config/kilo/plugin/ (singular, per Kilo docs)
  const pluginSrc = path.join(PKG_DIR, "plugins", "atomic-hooks.ts");
  const pluginDst = path.join(KILO_CONFIG_DIR, "plugin", "atomic-hooks.ts");
  let pluginLinked = false;
  if (fs.existsSync(pluginSrc) && symlinkSafe(pluginSrc, pluginDst)) {
    pluginLinked = true;
    if (!silent)
      console.log("  plugin: atomic-hooks.ts → ~/.config/kilo/plugins/");
  }

  // 5. Symlink package.json + install plugin dependency
  const pkgSrc = path.join(PKG_DIR, "package.json");
  const pkgDst = path.join(KILO_CONFIG_DIR, "package.json");
  if (fs.existsSync(pkgSrc)) {
    symlinkSafe(pkgSrc, pkgDst);
    try {
      execSync("bun install --no-progress", {
        cwd: KILO_CONFIG_DIR,
        stdio: "pipe",
      });
      if (!silent) console.log("  deps:   @opencode-ai/plugin installed");
    } catch {
      if (!silent)
        console.log("  deps:   bun install skipped (bun not found or failed)");
    }
  }

  // 6. Make hook scripts executable (fallback for CLI mode)
  const hooksDir = path.join(PKG_DIR, "hooks");
  if (fs.existsSync(hooksDir)) {
    for (const file of fs.readdirSync(hooksDir)) {
      if (file.endsWith(".sh")) {
        fs.chmodSync(path.join(hooksDir, file), 0o755);
      }
    }
    if (!silent) console.log(`  hooks:  made executable → ${hooksDir}/`);
  }

  if (!silent) {
    console.log();
    console.log(
      `✓ atomic-kilo global install (${rulesLinked} rules, ${agentsLinked} agents${pluginLinked ? ", plugin" : ""}${promptLinked ? ", AGENTS.md" : ""})`,
    );
    console.log(`  Symlinks point to: ${PKG_DIR}`);
    console.log();
    console.log("Enable Atomic recording in a project:");
    console.log("  cd /path/to/your/project");
    console.log("  atomic init                         # create .atomic/ repo");
    console.log(
      "  atomic agent enable --agent kilo    # enable hook recording",
    );
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Project install → <project>/
// ---------------------------------------------------------------------------

function doProjectInstall(projDir) {
  const proj = path.resolve(projDir);

  if (!fs.existsSync(proj) || !fs.statSync(proj).isDirectory()) {
    console.error(`Error: directory '${projDir}' does not exist.`);
    process.exit(1);
  }

  if (!silent) console.log(`Setting up project: ${proj}`);

  // 1. Copy AGENTS.md to project root
  const agentsMdDst = path.join(proj, "AGENTS.md");
  if (!fs.existsSync(agentsMdDst)) {
    fs.copyFileSync(path.join(PKG_DIR, "AGENTS.md"), agentsMdDst);
    if (!silent) console.log("  prompt: copied AGENTS.md");
  } else {
    if (!silent) console.log("  prompt: AGENTS.md already exists");
  }

  // 2. Create kilo.jsonc if it doesn't exist
  const kiloConfig = path.join(proj, "kilo.jsonc");
  let configCreated = false;
  if (!fs.existsSync(kiloConfig)) {
    fs.writeFileSync(
      kiloConfig,
      `{
  // Kilo Code configuration — see https://kilo.ai/docs/customize
  "instructions": [
    ".kilo/rules/*.md",
    "AGENTS.md"
  ]
}
`,
    );
    configCreated = true;
    if (!silent) console.log("  config: created kilo.jsonc");
  } else {
    if (!silent) console.log("  config: kilo.jsonc already exists");
  }

  // 3. Run atomic agent enable --agent kilo
  const hasAtomic = tryExec("atomic --version");
  const hasAtomicDir = fs.existsSync(path.join(proj, ".atomic"));

  if (hasAtomic && hasAtomicDir) {
    if (!silent) console.log("  hooks:  running atomic agent enable...");
    tryExecShow("atomic agent enable --agent kilo", { cwd: proj });
  } else if (!hasAtomic) {
    if (!silent) {
      console.log("  hooks:  'atomic' not on PATH — after installing, run:");
      console.log(`          cd ${proj} && atomic agent enable --agent kilo`);
    }
  } else {
    if (!silent) {
      console.log(
        "  hooks:  no .atomic/ directory — run 'atomic init' first, then:",
      );
      console.log(`          cd ${proj} && atomic agent enable --agent kilo`);
    }
  }

  if (!silent) {
    console.log();
    console.log(`✓ Project setup complete: ${proj}`);
    console.log();
    console.log("To finish (if not already done):");
    console.log(`  cd ${proj}`);
    console.log("  atomic init                         # create .atomic/ repo");
    console.log(
      "  atomic agent enable --agent kilo    # enable hook recording",
    );
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Uninstall (global)
// ---------------------------------------------------------------------------

function doUninstall() {
  let removed = 0;

  // Symlinked files (rules + agent mode + plugin)
  const symlinks = [
    path.join(KILO_CONFIG_DIR, "rules", "atomic.md"),
    path.join(KILO_CONFIG_DIR, "agent", "atomic.md"),
    path.join(KILO_CONFIG_DIR, "plugin", "atomic-hooks.ts"),
    path.join(KILO_CONFIG_DIR, "package.json"),
  ];

  for (const dst of symlinks) {
    if (isOurSymlink(dst)) {
      fs.unlinkSync(dst);
      removed++;
      if (!silent) console.log(`  removed: ${dst}`);
    }
  }

  // AGENTS.md is copied (not symlinked) — remove if it exists
  const agentsMd = path.join(KILO_CONFIG_DIR, "AGENTS.md");
  if (fs.existsSync(agentsMd)) {
    fs.unlinkSync(agentsMd);
    removed++;
    if (!silent) console.log(`  removed: ${agentsMd}`);
  }

  // Try to clean up empty directories
  for (const dir of [
    path.join(KILO_CONFIG_DIR, "rules"),
    path.join(KILO_CONFIG_DIR, "agent"),
    path.join(KILO_CONFIG_DIR, "plugin"),
  ]) {
    try {
      fs.rmdirSync(dir);
    } catch {
      /* not empty */
    }
  }

  if (!silent) {
    console.log();
    console.log(
      `✓ atomic-kilo uninstalled (${removed} global symlinks removed)`,
    );
    console.log(
      "  Note: per-project AGENTS.md and kilo.jsonc files must be removed manually.",
    );
    console.log(
      "  To remove hooks from a project: cd <project> && atomic agent disable --agent kilo",
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (uninstall) {
  doUninstall();
} else {
  if (wantGlobal) {
    doGlobalInstall();
  }
  if (projectPath) {
    doProjectInstall(projectPath);
  }
}
