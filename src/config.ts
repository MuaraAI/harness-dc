import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { HarnessConfig } from "./types.js";

export function getConfigPath(): string {
  const isWindows = process.platform === "win32";
  const rawConfigHome =
    process.env.XDG_CONFIG_HOME ||
    (isWindows && process.env.APPDATA ? process.env.APPDATA : path.join(os.homedir(), ".config"));
  const configHome = path.resolve(rawConfigHome);
  return path.join(configHome, "harness-dc", "config.json");
}

export function loadConfig(): HarnessConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as HarnessConfig;
      }
    }
  } catch {
    // Return empty on parse error
  }

  return {};
}
