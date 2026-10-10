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
  const cmdlineTrimmed = cmdline.trim();
  const cmdlineLower = cmdlineTrimmed.toLowerCase();

  // Self-ignore harness-dc binary / commands
  if (commLower.includes("harness-dc") || cmdlineLower.includes("harness-dc")) {
    return null;
  }

  // Tokenize cmdline into arguments
  const tokens = cmdlineTrimmed.split(/\s+/).filter(Boolean);
  const exeToken = (tokens[0] || "").toLowerCase();
  const exeBase = path.basename(exeToken);

  const INTERPRETERS = new Set([
    "python",
    "python3",
    "node",
    "bun",
    "deno",
    "bash",
    "sh",
    "zsh",
    "env",
  ]);

  for (const agent of agents) {
    for (const name of agent.processNames) {
      if (!name || typeof name !== "string" || name.trim() === "") continue;
      const target = name.toLowerCase().trim();

      // 1. comm exact or basename match
      if (commLower === target || commLower.endsWith(`/${target}`)) {
        return agent;
      }

      // 2. Binary executable token match (e.g. /usr/bin/hermes, agy.exe)
      if (exeBase === target || exeBase === `${target}.exe` || exeBase === `${target}.js`) {
        return agent;
      }

      // 3. Script argument match ONLY for common runtime interpreters (python, node, bash, sh, etc.)
      const isInterpreter = INTERPRETERS.has(exeBase) || INTERPRETERS.has(commLower);
      if (isInterpreter && tokens.length > 1) {
        const scriptArg = (tokens[1] || "").toLowerCase();
        const scriptBase = path.basename(scriptArg);
        if (scriptBase === target || scriptBase === `${target}.py` || scriptBase === `${target}.js`) {
          return agent;
        }

        // Support python -m hermes
        if (tokens.includes("-m")) {
          const mIndex = tokens.indexOf("-m");
          if (tokens[mIndex + 1]?.toLowerCase() === target) {
            return agent;
          }
        }

        // Check if path ends with target under .hermes or bin directory
        if (scriptArg.includes(`.hermes/bin/${target}`) || scriptArg.includes(`.hermes/hermes-agent`)) {
          return agent;
        }
      }
    }
  }

  return null;
}

export async function resolveProcessCwd(pid: number): Promise<string> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return "";
  }

  if (pid === process.pid) {
    return process.cwd();
  }

  if (process.platform === "linux") {
    try {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return "";
    }
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync(
        "lsof",
        ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
        { timeout: 3000 }
      );
      const lines = stdout.split("\n");
      const nLine = lines.find((l) => l.startsWith("n"));
      if (nLine) {
        return nLine.slice(1);
      }
    } catch {}
    return "";
  }

  return "";
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
    } catch {}
  }

  // Cross-platform fallback via ps (macOS / BSD / Linux fallback)
  if (matches.length === 0 && process.platform !== "win32") {
    try {
      const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid=,args="], {
        timeout: 3000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const lines = stdout.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(\d+)\s+(.+)$/);
        if (!match) continue;

        const pid = Number(match[1]);
        const args = match[2];
        const comm = args.split(/\s+/)[0] || "";

        if (!pid) continue;
        const matched = matchProcessAgent(comm, args, agents);
        if (matched) {
          matches.push({ pid, comm, cmdline: args, agent: matched });
        }
      }
    } catch {}
  }

  // Windows fallback via PowerShell Get-CimInstance
  if (matches.length === 0 && process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "Get-CimInstance Win32_Process | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json -Compress",
        ],
        { timeout: 4000 }
      );
      const parsed = JSON.parse(stdout);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const pid = Number(item.ProcessId);
        const comm = String(item.Name || "");
        const cmdline = String(item.CommandLine || "");
        if (!pid) continue;

        const matched = matchProcessAgent(comm, cmdline, agents);
        if (matched) {
          matches.push({ pid, comm, cmdline, agent: matched });
        }
      }
    } catch {}
  }

  if (matches.length === 0) {
    return null;
  }

  // Pick the highest PID (most recently launched process)
  matches.sort((a, b) => b.pid - a.pid);

  for (const candidate of matches) {
    // Verify process is still alive before reporting
    try {
      process.kill(candidate.pid, 0);
    } catch {
      continue;
    }

    const cwd = await resolveProcessCwd(candidate.pid);
    const workspaceName = extractWorkspaceName(cwd, options?.privacyMode);

    return {
      agent: candidate.agent,
      pid: candidate.pid,
      cwd,
      workspaceName,
      startTime: Date.now(),
    };
  }

  return null;
}
