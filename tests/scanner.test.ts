import { describe, it, expect } from "vitest";
import { extractWorkspaceName, matchProcessAgent, resolveProcessCwd } from "../src/scanner.js";
import { DEFAULT_AGENTS } from "../src/constants.js";

describe("Process Scanner & Workspace Resolver", () => {
  describe("extractWorkspaceName", () => {
    it("should extract folder basename for standard paths", () => {
      expect(extractWorkspaceName("/home/curzy/workspace/MuaraAI/harness-dc")).toBe("harness-dc");
      expect(extractWorkspaceName("/Users/developer/projects/cool-app")).toBe("cool-app");
    });

    it("should return 'Private Workspace' when privacyMode is enabled", () => {
      expect(extractWorkspaceName("/home/curzy/secret-repo", true)).toBe("Private Workspace");
    });

    it("should handle root or empty paths gracefully", () => {
      expect(extractWorkspaceName("/")).toBe("root");
      expect(extractWorkspaceName("")).toBe("unknown");
    });
  });

  describe("matchProcessAgent", () => {
    it("should match hermes from command line or comm", () => {
      const match1 = matchProcessAgent("hermes", "/usr/bin/hermes chat", DEFAULT_AGENTS);
      expect(match1).toBeDefined();
      expect(match1?.key).toBe("hermes");

      const match2 = matchProcessAgent("python3", "python3 /path/to/.hermes/bin/hermes", DEFAULT_AGENTS);
      expect(match2).toBeDefined();
      expect(match2?.key).toBe("hermes");
    });

    it("should match antigravity from agy or antigravity binary", () => {
      const match1 = matchProcessAgent("agy", "/home/curzy/.local/bin/agy -c", DEFAULT_AGENTS);
      expect(match1).toBeDefined();
      expect(match1?.key).toBe("antigravity");

      const match2 = matchProcessAgent("antigravity", "/opt/Antigravity/antigravity", DEFAULT_AGENTS);
      expect(match2).toBeDefined();
      expect(match2?.key).toBe("antigravity");
    });

    it("should return null for unrelated processes", () => {
      const match = matchProcessAgent("bash", "/bin/bash", DEFAULT_AGENTS);
      expect(match).toBeNull();
    });

    it("should NOT false-positive on commands referencing agent paths in arguments", () => {
      expect(matchProcessAgent("vim", "vim /path/to/bin/hermes", DEFAULT_AGENTS)).toBeNull();
      expect(matchProcessAgent("git", "git diff bin/hermes", DEFAULT_AGENTS)).toBeNull();
      expect(matchProcessAgent("grep", "grep -rn bin/agy .", DEFAULT_AGENTS)).toBeNull();
      expect(matchProcessAgent("node", "node dist/cli.js start", DEFAULT_AGENTS)).toBeNull();
    });

    it("should match python -m hermes invocation", () => {
      const match = matchProcessAgent("python3", "python3 -m hermes", DEFAULT_AGENTS);
      expect(match).toBeDefined();
      expect(match?.key).toBe("hermes");
    });
  });

  describe("resolveProcessCwd", () => {
    it("should resolve current process CWD", async () => {
      const cwd = await resolveProcessCwd(process.pid);
      expect(cwd).toBeDefined();
      expect(typeof cwd).toBe("string");
      expect(cwd).toBe(process.cwd());
    });
  });
});
