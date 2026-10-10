import path from "node:path";
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
      candidates.push(`\\\\?\\pipe\\discord-ipc-${i}`);
    }
    return candidates;
  }

  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const xdg = process.env.XDG_RUNTIME_DIR || `/run/user/${uid}`;
  const tmpDirs = [
    xdg,
    path.join(xdg, "app/com.discordapp.Discord"),
    path.join(xdg, "snap.discord"),
    process.env.TMPDIR,
    process.env.TMP,
    process.env.TEMP,
    "/tmp",
  ].filter(Boolean) as string[];

  for (const dir of tmpDirs) {
    for (let i = 0; i < 10; i++) {
      candidates.push(path.join(dir, `discord-ipc-${i}`));
    }
  }

  // Deduplicate while maintaining priority order
  return Array.from(new Set(candidates));
}
