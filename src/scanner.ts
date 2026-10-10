import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_AGENTS } from "./constants.js";
import type { ActiveAgentInfo, AgentDefinition } from "./types.js";

const execFileAsync = promisify(execFile);

export function extractWorkspaceName(cwd: string, privacyMode?: boolean): string {
  if (privacyMode) {
    return "Private Workspace";
  }

  if (!cwd || cwd.trim() === "") {
    return "unknown";
  }

  const normalized = path.resolve(cwd.trim());
  const parsed = path.parse(normalized);

  if (normalized === parsed.root) {
    return "root";
  }

  return path.basename(normalized);
}

export function matchProcessAgent(
  comm: string,
  cmdline: string,
  agents: AgentDefinition[] = DEFAULT_AGENTS
): AgentDefinition | null {
  const commLower = comm.toLowerCase().trim();
  const cmdlineLower = cmdline.toLowerCase().trim();

  for (const agent of agents) {
    for (const name of agent.processNames) {
      const nameLower = name.toLowerCase();

      // Check comm exact match
      if (commLower === nameLower || commLower.endsWith(`/${nameLower}`)) {
        return agent;
      }

      // Check cmdline contains binary name or path
      if (
        cmdlineLower.includes(`/${nameLower} `) ||
        cmdlineLower.endsWith(`/${nameLower}`) ||
        cmdlineLower.startsWith(`${nameLower} `) ||
        cmdlineLower === nameLower ||
        cmdlineLower.includes(`.hermes/bin/${nameLower}`) ||
        cmdlineLower.includes(`bin/${nameLower}`)
      ) {
        return agent;
      }
    }
  }

  return null;
}

export async function resolveProcessCwd(pid: number): Promise<string> {
  if (pid === process.pid) {
    return process.cwd();
  }

  if (process.platform === "linux") {
    try {
      const target = fs.readlinkSync(`/proc/${pid}/cwd`);
      return target;
    } catch {
      // Fall through to fallback
    }
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
      const lines = stdout.split("\n");
      const nLine = lines.find((l) => l.startsWith("n"));
      if (nLine) {
        return nLine.slice(1);
      }
    } catch {
      // Fall through
    }
  }

  return process.cwd();
}

interface ProcessCandidate {
  pid: number;
  comm: string;
  cmdline: string;
  agent: AgentDefinition;
}

export async function scanActiveAgent(options?: {
  privacyMode?: boolean;
  customAgents?: AgentDefinition[];
}): Promise<ActiveAgentInfo | null> {
  const agents = options?.customAgents ?? DEFAULT_AGENTS;
  const matches: ProcessCandidate[] = [];

  if (process.platform === "linux" && fs.existsSync("/proc")) {
    try {
      const entries = fs.readdirSync("/proc");
      for (const entry of entries) {
        const pid = Number(entry);
        if (!Number.isInteger(pid) || pid <= 0) continue;

        try {
          const comm = fs.readFileSync(`/proc/${pid}/comm`, "utf-8").trim();
          const cmdlineRaw = fs.readFileSync(`/proc/${pid}/cmdline`);
          const cmdline = cmdlineRaw.toString("utf-8").replace(/\0/g, " ").trim();

          const matched = matchProcessAgent(comm, cmdline, agents);
          if (matched) {
            matches.push({ pid, comm, cmdline, agent: matched });
          }
        } catch {
          // Process might have terminated while reading
          continue;
        }
      }
    } catch {
      // Fallback
    }
  }

  // Cross-platform fallback via ps
  if (matches.length === 0 && process.platform !== "win32") {
    try {
      const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid,comm,args"]);
      const lines = stdout.split("\n").slice(1);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const pid = Number(parts[0]);
        const comm = parts[1] || "";
        const args = parts.slice(2).join(" ");

        if (!pid) continue;
        const matched = matchProcessAgent(comm, args, agents);
        if (matched) {
          matches.push({ pid, comm, cmdline: args, agent: matched });
        }
      }
    } catch {}
  }

  if (matches.length === 0) {
    return null;
  }

  // Pick the highest PID (most recently launched process)
  matches.sort((a, b) => b.pid - a.pid);
  const active = matches[0];

  const cwd = await resolveProcessCwd(active.pid);
  const workspaceName = extractWorkspaceName(cwd, options?.privacyMode);

  return {
    agent: active.agent,
    pid: active.pid,
    cwd,
    workspaceName,
    startTime: Date.now(),
  };
}
