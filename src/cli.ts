#!/usr/bin/env node

import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HarnessDaemon } from "./daemon.js";
import { getConfigPath } from "./config.js";

export interface ParsedCli {
  command: "start" | "daemon" | "stop" | "status" | "help" | "version";
  privacy: boolean;
  help: boolean;
  version: boolean;
}

export function parseCliArgs(argv: string[]): ParsedCli {
  const options = {
    privacy: { type: "boolean" as const, short: "p", default: false },
    help: { type: "boolean" as const, short: "h", default: false },
    version: { type: "boolean" as const, short: "v", default: false },
  };

  const parsed = parseArgs({
    args: argv,
    options,
    allowPositionals: true,
    strict: false,
  });

  const positionals = parsed.positionals || [];
  let command: ParsedCli["command"] = "start";

  if (parsed.values.help) {
    command = "help";
  } else if (parsed.values.version) {
    command = "version";
  } else if (positionals.length > 0) {
    const first = positionals[0].toLowerCase();
    if (["start", "daemon", "stop", "status"].includes(first)) {
      command = first as ParsedCli["command"];
    } else {
      command = "help";
    }
  }

  return {
    command,
    privacy: Boolean(parsed.values.privacy),
    help: Boolean(parsed.values.help),
    version: Boolean(parsed.values.version),
  };
}

function getPidFilePath(): string {
  const configDir = path.dirname(getConfigPath());
  return path.join(configDir, "daemon.pid");
}

function readValidPid(pidFile: string): number | null {
  try {
    if (!fs.existsSync(pidFile)) return null;
    const raw = fs.readFileSync(pidFile, "utf-8").trim();
    const pid = Number(raw);
    if (Number.isInteger(pid) && pid > 1) {
      return pid;
    }
  } catch {}
  return null;
}

function printBanner() {
  console.log("\x1b[36m========================================\x1b[0m");
  console.log("\x1b[1m\x1b[35m  Harness-DC\x1b[0m \x1b[90m— Discord Rich Presence\x1b[0m");
  console.log("\x1b[90m  Hermes Agent & Antigravity by MuaraAI\x1b[0m");
  console.log("\x1b[36m========================================\x1b[0m\n");
}

async function handleStart(privacy: boolean) {
  printBanner();
  console.log(`[harness-dc] Mode: \x1b[32mForeground\x1b[0m`);
  console.log(`[harness-dc] Privacy: ${privacy ? "\x1b[33mEnabled\x1b[0m" : "\x1b[90mAuto (from config/cli)\x1b[0m"}`);
  console.log(`[harness-dc] Watching process table for Hermes / Antigravity...\n`);

  // Only override config if CLI explicitly passed --privacy
  const daemon = new HarnessDaemon(privacy ? { privacyMode: true } : {});

  const shutdown = async () => {
    console.log(`\n[harness-dc] Shutting down, clearing Discord presence...`);
    try {
      const pidFile = getPidFilePath();
      if (fs.existsSync(pidFile)) {
        const recordedPid = readValidPid(pidFile);
        if (recordedPid === process.pid) {
          fs.unlinkSync(pidFile);
        }
      }
    } catch {}
    await daemon.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await daemon.start();
}

async function handleDaemon(privacy: boolean) {
  printBanner();
  const pidFile = getPidFilePath();
  fs.mkdirSync(path.dirname(pidFile), { recursive: true, mode: 0o700 });

  if (fs.existsSync(pidFile)) {
    const existingPid = readValidPid(pidFile);
    if (existingPid) {
      try {
        process.kill(existingPid, 0);
        console.log(`\x1b[33m[harness-dc] Daemon is already running (PID: ${existingPid})\x1b[0m`);
        return;
      } catch (err: any) {
        if (err?.code === "ESRCH") {
          try { fs.unlinkSync(pidFile); } catch {}
        } else {
          console.error(`\x1b[31m[harness-dc] Cannot inspect PID ${existingPid}: ${err.message}\x1b[0m`);
          return;
        }
      }
    } else {
      try { fs.unlinkSync(pidFile); } catch {}
    }
  }

  // Prevent symlink following
  try {
    if (fs.lstatSync(pidFile).isSymbolicLink()) {
      fs.unlinkSync(pidFile);
    }
  } catch {}

  const scriptPath = path.resolve(process.argv[1]);
  const args = [scriptPath, "start"];
  if (privacy) args.push("--privacy");

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  child.on("error", (err) => {
    console.error("[harness-dc] Failed to spawn background daemon:", err.message);
  });

  child.unref();

  if (child.pid) {
    fs.writeFileSync(pidFile, String(child.pid), { encoding: "utf-8", mode: 0o600 });
    console.log(`\x1b[32m✓ harness-dc daemon started in background (PID: ${child.pid})\x1b[0m`);
    console.log(`Use \x1b[36mharness-dc status\x1b[0m to check or \x1b[31mharness-dc stop\x1b[0m to terminate.`);
  }
}

async function handleStop() {
  const pidFile = getPidFilePath();
  if (!fs.existsSync(pidFile)) {
    console.log(`[harness-dc] No background daemon PID found.`);
    return;
  }

  const pid = readValidPid(pidFile);
  if (!pid) {
    console.log(`[harness-dc] Removed invalid daemon PID file.`);
    try { fs.unlinkSync(pidFile); } catch {}
    return;
  }

  try {
    process.kill(pid, "SIGTERM");

    // Wait up to 2 seconds for graceful exit
    let alive = true;
    for (let i = 0; i < 20; i++) {
      try {
        process.kill(pid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        alive = false;
        break;
      }
    }

    if (!alive) {
      console.log(`\x1b[32m✓ harness-dc daemon (PID: ${pid}) stopped.\x1b[0m`);
    } else {
      console.log(`\x1b[33m! Sent SIGTERM to daemon (PID: ${pid})\x1b[0m`);
    }
  } catch {
    console.log(`[harness-dc] Daemon process (PID: ${pid}) was not running.`);
  } finally {
    try {
      fs.unlinkSync(pidFile);
    } catch {}
  }
}

async function handleStatus() {
  const pidFile = getPidFilePath();
  if (!fs.existsSync(pidFile)) {
    console.log(`[harness-dc] Daemon is \x1b[31mstopped\x1b[0m.`);
    return;
  }

  const pid = readValidPid(pidFile);
  if (!pid) {
    console.log(`[harness-dc] Daemon PID file is \x1b[31minvalid or corrupt\x1b[0m.`);
    try { fs.unlinkSync(pidFile); } catch {}
    return;
  }

  try {
    process.kill(pid, 0);
    console.log(`[harness-dc] Daemon is \x1b[32mrunning\x1b[0m (PID: ${pid}).`);
  } catch {
    console.log(`[harness-dc] Daemon PID file exists (${pid}) but process is \x1b[31mdead\x1b[0m.`);
  }
}

function printHelp() {
  printBanner();
  console.log(`Usage:
  npx @muaraai/harness-dc [command] [options]

Commands:
  start          Run in foreground (default)
  daemon         Spawn in background
  stop           Stop the background daemon
  status         Check daemon status

Options:
  -p, --privacy  Mask workspace/folder names
  -h, --help     Show this help message
  -v, --version  Show version
`);
}

async function main() {
  const parsed = parseCliArgs(process.argv.slice(2));

  switch (parsed.command) {
    case "start":
      await handleStart(parsed.privacy);
      break;
    case "daemon":
      await handleDaemon(parsed.privacy);
      break;
    case "stop":
      await handleStop();
      break;
    case "status":
      await handleStatus();
      break;
    case "help":
      printHelp();
      break;
    case "version":
      console.log("harness-dc v0.1.0");
      break;
  }
}

const isDirectRun = (() => {
  try {
    const entryPath = fs.realpathSync(process.argv[1]);
    const currentPath = fileURLToPath(import.meta.url);
    return entryPath === currentPath;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main().catch((err) => {
    console.error("[harness-dc] Fatal error:", err);
    process.exit(1);
  });
}
