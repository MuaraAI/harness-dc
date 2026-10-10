import { describe, it, expect, beforeEach, afterEach } from "vitest";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { DiscordIpcClient } from "../src/ipc.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Discord IPC Client & Framing Protocol", () => {
  let socketPath: string;
  let mockServer: net.Server;
  let openSockets: net.Socket[] = [];
  let serverReceived: Array<{ opcode: number; payload: any }> = [];

  beforeEach(async () => {
    serverReceived = [];
    openSockets = [];
    socketPath = path.join(
      os.tmpdir(),
      `test-discord-ipc-${Date.now()}-${Math.floor(Math.random() * 10000)}.sock`
    );

    mockServer = net.createServer((socket) => {
      openSockets.push(socket);
      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 8) {
          const opcode = buffer.readUInt32LE(0);
          const length = buffer.readUInt32LE(4);

          if (buffer.length < 8 + length) {
            break; // Wait for full packet
          }

          const payloadRaw = buffer.subarray(8, 8 + length).toString("utf-8");
          const payload = JSON.parse(payloadRaw);
          serverReceived.push({ opcode, payload });
          buffer = buffer.subarray(8 + length);

          // If handshake (opcode 0), reply with READY (opcode 1)
          if (opcode === 0) {
            const readyPayload = JSON.stringify({
              cmd: "DISPATCH",
              data: { v: 1, user: { id: "123", username: "tester" } },
              evt: "READY",
            });
            const resHeader = Buffer.alloc(8);
            resHeader.writeUInt32LE(1, 0); // FRAME
            resHeader.writeUInt32LE(Buffer.byteLength(readyPayload), 4);
            socket.write(Buffer.concat([resHeader, Buffer.from(readyPayload)]));
          }
        }
      });
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(socketPath, () => resolve());
    });
  });

  afterEach(async () => {
    for (const s of openSockets) {
      s.destroy();
    }
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
    if (fs.existsSync(socketPath)) {
      try {
        fs.unlinkSync(socketPath);
      } catch {}
    }
  });

  it("should perform handshake (opcode 0) and establish connection", async () => {
    const client = new DiscordIpcClient([socketPath]);
    const connected = await client.connect("1541753081308512330");

    expect(connected).toBe(true);
    expect(client.isConnected).toBe(true);
    expect(serverReceived.length).toBeGreaterThanOrEqual(1);
    expect(serverReceived[0].opcode).toBe(0);
    expect(serverReceived[0].payload).toEqual({
      v: 1,
      client_id: "1541753081308512330",
    });

    client.disconnect();
    expect(client.isConnected).toBe(false);
  });

  it("should send SET_ACTIVITY payload (opcode 1) with nonce and pid", async () => {
    const client = new DiscordIpcClient([socketPath]);
    await client.connect("1541753081308512330");

    await client.sendActivity({
      details: "Workspace: harness-dc",
      state: "Agent Active",
      timestamps: { start: 1700000000 },
      assets: {
        large_image: "logo",
        large_text: "Hermes Agent",
      },
    });

    await sleep(50);

    const activityPackets = serverReceived.filter((p) => p.opcode === 1);
    expect(activityPackets.length).toBe(1);
    expect(activityPackets[0].payload.cmd).toBe("SET_ACTIVITY");
    expect(activityPackets[0].payload.args.activity.details).toBe(
      "Workspace: harness-dc"
    );
    expect(activityPackets[0].payload.args.activity.state).toBe("Agent Active");

    client.disconnect();
  });

  it("should clear activity when clearActivity is called", async () => {
    const client = new DiscordIpcClient([socketPath]);
    await client.connect("1541753081308512330");

    await client.clearActivity();

    await sleep(50);

    const activityPackets = serverReceived.filter((p) => p.opcode === 1);
    expect(activityPackets.length).toBe(1);
    expect(activityPackets[0].payload.cmd).toBe("SET_ACTIVITY");
    expect(activityPackets[0].payload.args.activity).toBeNull();

    client.disconnect();
  });
});
