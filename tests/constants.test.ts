import { describe, it, expect } from "vitest";
import { DEFAULT_AGENTS, getSocketPaths } from "../src/constants.js";

describe("Core Constants Registry", () => {
  it("should define Hermes Agent with the official Client ID", () => {
    const hermes = DEFAULT_AGENTS.find((a) => a.key === "hermes");
    expect(hermes).toBeDefined();
    expect(hermes?.clientId).toBe("1541753081308512330");
    expect(hermes?.displayName).toBe("Hermes Agent");
    expect(hermes?.processNames).toContain("hermes");
  });

  it("should define Antigravity with the official Client ID", () => {
    const agy = DEFAULT_AGENTS.find((a) => a.key === "antigravity");
    expect(agy).toBeDefined();
    expect(agy?.clientId).toBe("1558457305995939962");
    expect(agy?.displayName).toBe("Antigravity");
    expect(agy?.processNames).toContain("agy");
    expect(agy?.processNames).toContain("antigravity");
  });

  it("should generate cross-platform socket candidates", () => {
    const paths = getSocketPaths();
    expect(Array.isArray(paths)).toBe(true);
    expect(paths.length).toBeGreaterThan(0);
    // At least index 0 path should end with discord-ipc-0 or pipe
    expect(paths.some((p) => p.includes("discord-ipc-0"))).toBe(true);
  });
});
