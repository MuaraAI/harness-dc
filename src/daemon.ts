import { DiscordIpcClient } from "./ipc.js";
import { scanActiveAgent } from "./scanner.js";
import { loadConfig } from "./config.js";
import type { ActiveAgentInfo, ActivityPayload, AgentDefinition, HarnessConfig } from "./types.js";

export interface DaemonStatus {
  state: "idle" | "active";
  activeAgent: ActiveAgentInfo | null;
  connectedClientId: string | null;
  uptimeSeconds: number;
}

export interface DaemonOptions {
  ipcClient?: DiscordIpcClient;
  scanner?: (opts?: { privacyMode?: boolean; customAgents?: AgentDefinition[] }) => Promise<ActiveAgentInfo | null>;
  config?: HarnessConfig;
  privacyMode?: boolean;
  pollIntervalMs?: number;
}

export class HarnessDaemon {
  private ipc: DiscordIpcClient;
  private scannerFn: (opts?: { privacyMode?: boolean; customAgents?: AgentDefinition[] }) => Promise<ActiveAgentInfo | null>;
  private config: HarnessConfig;
  private privacyMode: boolean;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private startTimestamp: number;
  private isTicking: boolean = false;
  private isRunning: boolean = false;

  public status: DaemonStatus = {
    state: "idle",
    activeAgent: null,
    connectedClientId: null,
    uptimeSeconds: 0,
  };

  private currentSessionStartTime: number | null = null;

  constructor(options?: DaemonOptions) {
    this.config = options?.config ?? loadConfig();
    this.privacyMode = options?.privacyMode ?? this.config.privacyMode ?? false;

    const rawInterval = options?.pollIntervalMs ?? this.config.pollIntervalMs ?? 3000;
    this.pollIntervalMs = typeof rawInterval === "number" && rawInterval >= 500 ? rawInterval : 3000;

    this.ipc = options?.ipcClient ?? new DiscordIpcClient();
    this.scannerFn = options?.scanner ?? scanActiveAgent;
    this.startTimestamp = Date.now();
  }

  public async tick(): Promise<void> {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      this.status.uptimeSeconds = Math.floor((Date.now() - this.startTimestamp) / 1000);

      const active = await this.scannerFn({
        privacyMode: this.privacyMode,
        customAgents: this.config.customAgents,
      });

      if (!active) {
        if (this.status.state === "active") {
          await this.ipc.clearActivity();
          this.status.state = "idle";
          this.status.activeAgent = null;
          this.status.connectedClientId = null;
          this.currentSessionStartTime = null;
        }
        return;
      }

      // Check ignoredWorkspaces config
      if (
        this.config.ignoredWorkspaces &&
        this.config.ignoredWorkspaces.some(
          (w) => w.toLowerCase() === active.workspaceName.toLowerCase()
        )
      ) {
        if (this.status.state === "active") {
          await this.ipc.clearActivity();
          this.status.state = "idle";
          this.status.activeAgent = null;
          this.status.connectedClientId = null;
          this.currentSessionStartTime = null;
        }
        return;
      }

      // Only reset session timer if the agent type changes
      const isDifferentAgentType =
        !this.status.activeAgent ||
        this.status.activeAgent.agent.key !== active.agent.key;

      if (isDifferentAgentType) {
        this.currentSessionStartTime = Math.floor(Date.now() / 1000);
      }

      // Connect or switch client ID if needed
      if (!this.ipc.isConnected || this.ipc.currentClientId !== active.agent.clientId) {
        const connected = await this.ipc.connect(active.agent.clientId);
        if (!connected) {
          this.status.connectedClientId = null;
          return;
        }
      }

      const activity: ActivityPayload = {
        details: `Workspace: ${active.workspaceName}`,
        state: active.agent.displayName === "Hermes Agent" ? "Autonomous Coding" : "Active Session",
        timestamps: {
          start: this.currentSessionStartTime ?? Math.floor(Date.now() / 1000),
        },
        assets: {
          large_image: active.agent.largeImageKey,
          large_text: active.agent.largeText,
          small_image: active.agent.smallImageKey,
          small_text: active.agent.smallText,
        },
      };

      await this.ipc.sendActivity(activity);

      this.status.state = "active";
      this.status.activeAgent = active;
      this.status.connectedClientId = active.agent.clientId;
    } finally {
      this.isTicking = false;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.tick();
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        await this.tick();
      } catch {}
      this.scheduleNextTick();
    }, this.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ipc.isConnected) {
      await this.ipc.clearActivity();
      this.ipc.disconnect();
    }
    this.status.state = "idle";
    this.status.activeAgent = null;
    this.status.connectedClientId = null;
    this.currentSessionStartTime = null;
  }
}
