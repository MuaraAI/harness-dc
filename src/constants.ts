import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type { AgentDefinition } from "./types.js";

export const DEFAULT_AGENTS: AgentDefinition[] = [
  {
    key: "hermes",
    displayName: "Hermes Agent",
    clientId: "1541753081308512330",
    processNames: ["hermes"],
    largeImageKey: "logo",
    largeText: "Hermes Agent",
    smallImageKey: "icon",
    smallText: "Active",
  },
  {
    key: "antigravity",
    displayName: "Antigravity",
    clientId: "1558457305995939962",
    processNames: ["agy", "antigravity"],
    largeImageKey: "logo",
    largeText: "Antigravity",
    smallImageKey: "icon",
    smallText: "Active",
  },
];

export function getSocketPaths(): string[] {
  const isWindows = process.platform === "win32";
  const candidates: string[] = [];

  if (isWindows) {
    for (let i = 0; i < 10; i++) {
      candidates.push(`\\\\.\\pipe\\discord-ipc-${i}`);
      candidates.push(`\\\\?\\pipe\\discord-ipc-${i}`);
    }
    return candidates;
  }

  const tmpDirs: string[] = [];
  const uid = typeof process.getuid === "function" ? process.getuid() : null;

  if (process.env.XDG_RUNTIME_DIR) {
    const xdg = process.env.XDG_RUNTIME_DIR;
    tmpDirs.push(
      xdg,
      path.join(xdg, "app/com.discordapp.Discord"),
      path.join(xdg, "app/com.discordapp.DiscordCanary"),
      path.join(xdg, "app/dev.vencord.Vesktop"),
      path.join(xdg, "snap.discord")
    );
  } else if (process.platform === "linux" && uid !== null) {
    tmpDirs.push(`/run/user/${uid}`);
  }

  tmpDirs.push(os.tmpdir());
  if (process.env.TMPDIR) tmpDirs.push(process.env.TMPDIR);
  if (process.env.TMP) tmpDirs.push(process.env.TMP);
  if (process.env.TEMP) tmpDirs.push(process.env.TEMP);
  tmpDirs.push("/tmp");

  const validDirs = Array.from(new Set(tmpDirs.filter((d) => Boolean(d) && fs.existsSync(d))));

  for (const dir of validDirs) {
    for (let i = 0; i < 10; i++) {
      candidates.push(path.join(dir, `discord-ipc-${i}`));
    }
  }

  // Deduplicate while maintaining priority order
  return Array.from(new Set(candidates));
}
