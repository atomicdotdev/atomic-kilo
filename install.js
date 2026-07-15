#!/usr/bin/env node

/**
 * atomic-kilo install
 *
 * Installs Atomic rules, agent mode, and optional kilo.jsonc configuration
 * into the current project for Kilo Code integration.
 *
 * Kilo Code auto-discovers AGENTS.md at the project root and loads rules
 * from .kilo/rules/ via kilo.jsonc configuration.
 *
 * Usage:
 *   npx atomic-kilo            # install from npm
 *   node install.js             # install from local checkout
 *   node install.js --silent   # postinstall (no output on success)
 *   node install.js --uninstall # remove installed files
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const silent = process.argv.includes("--silent");
const uninstall = process.argv.includes("--uninstall");

const PKG_DIR = __dirname;

function tryExec(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function doInstall() {
  // 1. Check for atomic CLI
  if (!silent && !tryExec("atomic --version")) {
    console.warn(
      "  note: 'atomic' not on PATH — install it so the hooks work at runtime",
    );
  }

  const cwd = process.cwd();
  let rulesInstalled = 0;
  let agentsInstalled = 0;

  // 2. Copy rules to .kilo/rules/
  const rulesDir = path.join(cwd, ".kilo", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  const rulesSrc = path.join(PKG_DIR, "rules", "atomic.md");
  const rulesDst = path.join(rulesDir, "atomic.md");
  if (fs.existsSync(rulesSrc)) {
    fs.copyFileSync(rulesSrc, rulesDst);
    rulesInstalled++;
    if (!silent) console.log("  rules: atomic.md → .kilo/rules/");
  }

  // 3. Copy agent mode to .kilo/agents/
  const agentsDir = path.join(cwd, ".kilo", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  const agentSrc = path.join(PKG_DIR, "agents", "atomic.md");
  const agentDst = path.join(agentsDir, "atomic.md");
  if (fs.existsSync(agentSrc)) {
    fs.copyFileSync(agentSrc, agentDst);
    agentsInstalled++;
    if (!silent) console.log("  agent: atomic.md → .kilo/agents/");
  }

  // 4. Create kilo.jsonc if it doesn't exist
  const kiloConfig = path.join(cwd, "kilo.jsonc");
  let configCreated = false;
  if (!fs.existsSync(kiloConfig)) {
    const configContent = `{
  // Kilo Code configuration — see https://kilo.ai/docs/customize
  "instructions": [
    ".kilo/rules/*.md",
    "AGENTS.md"
  ]
}
`;
    fs.writeFileSync(kiloConfig, configContent);
    configCreated = true;
    if (!silent) console.log("  config: created kilo.jsonc");
  } else {
    if (!silent)
      console.log(
        "  config: kilo.jsonc exists (add .kilo/rules/*.md to instructions if needed)",
      );
  }

  // 5. Make hook scripts executable
  const hooksDir = path.join(PKG_DIR, "hooks");
  if (fs.existsSync(hooksDir)) {
    for (const file of fs.readdirSync(hooksDir)) {
      if (file.endsWith(".sh")) {
        fs.chmodSync(path.join(hooksDir, file), 0o755);
      }
    }
  }

  if (!silent) {
    console.log();
    console.log(
      `✓ atomic-kilo installed (${rulesInstalled} rules, ${agentsInstalled} agents${configCreated ? ", kilo.jsonc created" : ""})`,
    );
    console.log();
    console.log(
      "Copy AGENTS.md into your project root to enable the agent prompt:",
    );
    console.log(
      `  cp ${path.join(PKG_DIR, "AGENTS.md")} /path/to/your/project/`,
    );
    console.log();
  }
}

function doUninstall() {
  const cwd = process.cwd();
  let removed = 0;

  // Remove .kilo/rules/atomic.md
  const rulesDst = path.join(cwd, ".kilo", "rules", "atomic.md");
  if (fs.existsSync(rulesDst)) {
    fs.unlinkSync(rulesDst);
    removed++;
    if (!silent) console.log("  removed: .kilo/rules/atomic.md");
  }

  // Remove .kilo/agents/atomic.md
  const agentDst = path.join(cwd, ".kilo", "agents", "atomic.md");
  if (fs.existsSync(agentDst)) {
    fs.unlinkSync(agentDst);
    removed++;
    if (!silent) console.log("  removed: .kilo/agents/atomic.md");
  }

  // Try to remove empty directories
  for (const dir of [
    path.join(cwd, ".kilo", "rules"),
    path.join(cwd, ".kilo", "agents"),
    path.join(cwd, ".kilo"),
  ]) {
    try {
      fs.rmdirSync(dir);
    } catch {
      /* not empty */
    }
  }

  if (!silent) {
    console.log();
    console.log(`✓ atomic-kilo uninstalled (${removed} files removed)`);
    console.log(
      "  Note: AGENTS.md and kilo.jsonc in project root must be removed manually.",
    );
  }
}

if (uninstall) {
  doUninstall();
} else {
  doInstall();
}
