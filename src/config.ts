import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { HarnessConfig } from "./types.js";

export function getConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "harness-dc", "config.json");
}

export function loadConfig(): HarnessConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Return empty on parse error
  }

  return {};
}
