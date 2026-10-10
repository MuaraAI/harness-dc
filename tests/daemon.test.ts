import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HarnessDaemon } from "../src/daemon.js";
import type { DiscordIpcClient } from "../src/ipc.js";
import type { ActiveAgentInfo } from "../src/types.js";
import { DEFAULT_AGENTS } from "../src/constants.js";

describe("HarnessDaemon State Machine & Polling Loop", () => {
  let mockIpc: Partial<DiscordIpcClient>;
  let sendActivityCalls: any[] = [];
  let connectCalls: string[] = [];
  let clearActivityCalls: number = 0;

  beforeEach(() => {
    sendActivityCalls = [];
    connectCalls = [];
    clearActivityCalls = 0;

    mockIpc = {
      isConnected: false,
      currentClientId: null,
      connect: vi.fn(async (clientId: string) => {
        connectCalls.push(clientId);
        mockIpc.isConnected = true;
        mockIpc.currentClientId = clientId;
        return true;
      }),
      sendActivity: vi.fn(async (activity: any) => {
        sendActivityCalls.push(activity);
      }),
      clearActivity: vi.fn(async () => {
        clearActivityCalls++;
      }),
      disconnect: vi.fn(() => {
        mockIpc.isConnected = false;
        mockIpc.currentClientId = null;
      }),
    };
  });

  it("should stay idle and not send activity if no agent is running", async () => {
    const scannerMock = vi.fn(async () => null);
    const daemon = new HarnessDaemon({
      ipcClient: mockIpc as DiscordIpcClient,
      scanner: scannerMock,
    });

    await daemon.tick();

    expect(daemon.status.state).toBe("idle");
    expect(connectCalls.length).toBe(0);
    expect(sendActivityCalls.length).toBe(0);
  });

  it("should connect and send activity when Hermes is detected", async () => {
    const fakeAgentInfo: ActiveAgentInfo = {
      agent: DEFAULT_AGENTS[0], // hermes
      pid: 1234,
      cwd: "/home/curzy/workspace/cool-proj",
      workspaceName: "cool-proj",
      startTime: Date.now(),
    };

    const scannerMock = vi.fn(async () => fakeAgentInfo);
    const daemon = new HarnessDaemon({
      ipcClient: mockIpc as DiscordIpcClient,
      scanner: scannerMock,
    });

    await daemon.tick();

    expect(daemon.status.state).toBe("active");
    expect(daemon.status.activeAgent?.agent.key).toBe("hermes");
    expect(connectCalls).toContain("1541753081308512330");
    expect(sendActivityCalls.length).toBe(1);
    expect(sendActivityCalls[0].details).toBe("Workspace: cool-proj");
    expect(sendActivityCalls[0].assets.large_image).toBe("logo");
  });

  it("should switch client ID when agent changes from Hermes to Antigravity", async () => {
    let currentAgent: ActiveAgentInfo | null = {
      agent: DEFAULT_AGENTS[0], // hermes
      pid: 1234,
      cwd: "/home/curzy/workspace/proj",
      workspaceName: "proj",
      startTime: Date.now(),
    };

    const scannerMock = vi.fn(async () => currentAgent);
    const daemon = new HarnessDaemon({
      ipcClient: mockIpc as DiscordIpcClient,
      scanner: scannerMock,
    });

    await daemon.tick();
    expect(connectCalls).toEqual(["1541753081308512330"]);

    // Now switch to antigravity
    currentAgent = {
      agent: DEFAULT_AGENTS[1], // antigravity
      pid: 5678,
      cwd: "/home/curzy/workspace/proj2",
      workspaceName: "proj2",
      startTime: Date.now(),
    };

    await daemon.tick();
    expect(connectCalls).toEqual(["1541753081308512330", "1558457305995939962"]);
    expect(daemon.status.activeAgent?.agent.key).toBe("antigravity");
  });

  it("should clear activity when agent exits", async () => {
    let currentAgent: ActiveAgentInfo | null = {
      agent: DEFAULT_AGENTS[0],
      pid: 1234,
      cwd: "/home/curzy/workspace/proj",
      workspaceName: "proj",
      startTime: Date.now(),
    };

    const scannerMock = vi.fn(async () => currentAgent);
    const daemon = new HarnessDaemon({
      ipcClient: mockIpc as DiscordIpcClient,
      scanner: scannerMock,
    });

    await daemon.tick();
    expect(daemon.status.state).toBe("active");

    // Agent terminates
    currentAgent = null;
    await daemon.tick();

    expect(daemon.status.state).toBe("idle");
    expect(clearActivityCalls).toBe(1);
  });
});
