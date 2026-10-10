import { describe, it, expect } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("CLI Argument Parser", () => {
  it("should default to command 'start' when no arguments are provided", () => {
    const parsed = parseCliArgs([]);
    expect(parsed.command).toBe("start");
    expect(parsed.privacy).toBe(false);
  });

  it("should recognize 'daemon' subcommand with --privacy flag", () => {
    const parsed = parseCliArgs(["daemon", "--privacy"]);
    expect(parsed.command).toBe("daemon");
    expect(parsed.privacy).toBe(true);
  });

  it("should recognize 'stop' subcommand", () => {
    const parsed = parseCliArgs(["stop"]);
    expect(parsed.command).toBe("stop");
  });

  it("should recognize 'status' subcommand", () => {
    const parsed = parseCliArgs(["status"]);
    expect(parsed.command).toBe("status");
  });

  it("should recognize --help flag", () => {
    const parsed = parseCliArgs(["--help"]);
    expect(parsed.help).toBe(true);
  });

  it("should route unknown subcommands to help", () => {
    const parsed = parseCliArgs(["unknown-command"]);
    expect(parsed.command).toBe("help");
  });
});
