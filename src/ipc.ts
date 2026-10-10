import net from "node:net";
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
        }
      };

      socket.setTimeout(2500);

      socket.on("error", () => {
        cleanup();
      });

      socket.on("timeout", () => {
        cleanup();
      });

      socket.on("connect", () => {
        // Send HANDSHAKE (opcode 0)
        const handshakePayload = JSON.stringify({
          v: 1,
          client_id: clientId,
        });
        this.writeFrame(socket, OPCODES.HANDSHAKE, handshakePayload);
      });

      socket.on("data", (data) => {
        if (data.length >= 8) {
          const opcode = data.readUInt32LE(0);
          if (opcode === OPCODES.FRAME && !resolved) {
            resolved = true;
            socket.setTimeout(0);
            this.socket = socket;

            // Handle subsequent socket lifecycle
            socket.on("close", () => {
              this.isConnected = false;
              this.socket = null;
            });

            resolve(true);
          }
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
      this.isConnected = false;
      this.socket = null;
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
