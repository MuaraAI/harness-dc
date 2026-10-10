export type AgentKey = "hermes" | "antigravity" | "claude" | string;

export interface AgentDefinition {
  key: AgentKey;
  displayName: string;
  clientId: string;
  processNames: string[];
  largeImageKey: string;
  largeText: string;
  smallImageKey?: string;
  smallText?: string;
}

export interface ActivityPayload {
  details: string;
  state: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
}

export interface ActiveAgentInfo {
  agent: AgentDefinition;
  pid: number;
  cwd: string;
  workspaceName: string;
  startTime: number;
}

export interface HarnessConfig {
  pollIntervalMs?: number;
  privacyMode?: boolean;
  customAgents?: AgentDefinition[];
  ignoredWorkspaces?: string[];
}
