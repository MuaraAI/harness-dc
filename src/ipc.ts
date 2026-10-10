import net from "node:net";
import fs from "node:fs";
import crypto from "node:crypto";
import { getSocketPaths } from "./constants.js";
import type { ActivityPayload } from "./types.js";

export const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
} as const;

const MAX_PACKET_SIZE = 64 * 1024; // 64 KB safety threshold

export class DiscordIpcClient {
  private socket: net.Socket | null = null;
  private candidatePaths: string[];
  public isConnected: boolean = false;
  public currentClientId: string | null = null;

  constructor(candidatePaths?: string[]) {
    this.candidatePaths = candidatePaths ?? getSocketPaths();
  }

  public async connect(clientId: string): Promise<boolean> {
    if (this.isConnected && this.currentClientId === clientId) {
      return true;
    }

    if (this.isConnected) {
      this.disconnect();
    }

    for (const socketPath of this.candidatePaths) {
      // Pre-check socket existence on Unix platforms
      if (process.platform !== "win32") {
        try {
          const stat = fs.lstatSync(socketPath);
          if (!stat.isSocket()) continue;
          const uid = typeof process.getuid === "function" ? process.getuid() : 0;
          if (stat.uid !== uid && stat.uid !== 0) continue; // Must be user-owned or root-owned
        } catch {
          continue;
        }
      }

      try {
        const connected = await this.tryConnectSocket(socketPath, clientId);
        if (connected) {
          this.currentClientId = clientId;
          this.isConnected = true;
          return true;
        }
      } catch {
        // Continue to next candidate
      }
    }

    this.isConnected = false;
    this.currentClientId = null;
    return false;
  }

  private tryConnectSocket(socketPath: string, clientId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect(socketPath);
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        } else {
          this.disconnect();
        }
      };

      socket.setTimeout(2500);

      socket.on("error", () => cleanup());
      socket.on("timeout", () => cleanup());
      socket.on("close", () => cleanup());
      socket.on("end", () => cleanup());

      socket.on("connect", () => {
        const handshakePayload = JSON.stringify({
          v: 1,
          client_id: clientId,
        });
        try {
          this.writeFrame(socket, OPCODES.HANDSHAKE, handshakePayload);
        } catch {
          cleanup();
        }
      });

      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > MAX_PACKET_SIZE + 8) {
          cleanup();
          return;
        }

        while (buffer.length >= 8) {
          const opcode = buffer.readUInt32LE(0);
          const length = buffer.readUInt32LE(4);

          if (length > MAX_PACKET_SIZE) {
            cleanup();
            return;
          }

          if (buffer.length < 8 + length) {
            break; // Wait for full packet
          }

          if (opcode === OPCODES.CLOSE) {
            cleanup();
            return;
          }

          if (opcode === OPCODES.FRAME && !resolved) {
            resolved = true;
            socket.setTimeout(0);
            this.socket = socket;

            // Remove connect-time cleanup handler now that socket is active
            socket.removeAllListeners("close");
            socket.removeAllListeners("error");

            socket.on("close", () => {
              this.isConnected = false;
              this.socket = null;
            });
            socket.on("error", () => {
              this.isConnected = false;
              this.socket = null;
            });

            resolve(true);
            return;
          }

          buffer = buffer.subarray(8 + length);
        }
      });
    });
  }

  private writeFrame(socket: net.Socket, opcode: number, payload: string): void {
    const payloadBuffer = Buffer.from(payload, "utf-8");
    const headerBuffer = Buffer.alloc(8);
    headerBuffer.writeUInt32LE(opcode, 0);
    headerBuffer.writeUInt32LE(payloadBuffer.length, 4);

    socket.write(Buffer.concat([headerBuffer, payloadBuffer]));
  }

  public async sendActivity(activity: ActivityPayload | null): Promise<void> {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const payload = JSON.stringify({
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity,
      },
      nonce: crypto.randomUUID(),
    });

    try {
      this.writeFrame(this.socket, OPCODES.FRAME, payload);
    } catch {
      this.disconnect();
    }
  }

  public async clearActivity(): Promise<void> {
    await this.sendActivity(null);
  }

  public disconnect(): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.isConnected = false;
    this.currentClientId = null;
  }
}
