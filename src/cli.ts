#!/usr/bin/env node

import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
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
      command = first as any;
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

function printBanner() {
  console.log("\x1b[36m========================================\x1b[0m");
  console.log("\x1b[1m\x1b[35m  Harness-DC\x1b[0m \x1b[90m— Discord Rich Presence\x1b[0m");
  console.log("\x1b[90m  Hermes Agent & Antigravity by MuaraAI\x1b[0m");
  console.log("\x1b[36m========================================\x1b[0m\n");
}

async function handleStart(privacy: boolean) {
  printBanner();
  console.log(`[harness-dc] Mode: \x1b[32mForeground\x1b[0m`);
  console.log(`[harness-dc] Privacy: ${privacy ? "\x1b[33mEnabled\x1b[0m" : "\x1b[90mDisabled\x1b[0m"}`);
  console.log(`[harness-dc] Watching process table for Hermes / Antigravity...\n`);

  const daemon = new HarnessDaemon({ privacyMode: privacy });

  const shutdown = async () => {
    console.log(`\n[harness-dc] Shutting down, clearing Discord presence...`);
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
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });

  if (fs.existsSync(pidFile)) {
    const existingPid = Number(fs.readFileSync(pidFile, "utf-8").trim());
    try {
      process.kill(existingPid, 0);
      console.log(`\x1b[33m[harness-dc] Daemon is already running (PID: ${existingPid})\x1b[0m`);
      return;
    } catch {
      // Stale PID file
      fs.unlinkSync(pidFile);
    }
  }

  const scriptPath = process.argv[1];
  const args = ["start"];
  if (privacy) args.push("--privacy");

  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  child.unref();

  if (child.pid) {
    fs.writeFileSync(pidFile, String(child.pid), "utf-8");
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

  const pid = Number(fs.readFileSync(pidFile, "utf-8").trim());
  try {
    process.kill(pid, "SIGTERM");
    console.log(`\x1b[32m✓ harness-dc daemon (PID: ${pid}) stopped.\x1b[0m`);
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

  const pid = Number(fs.readFileSync(pidFile, "utf-8").trim());
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

import { fileURLToPath } from "node:url";

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
