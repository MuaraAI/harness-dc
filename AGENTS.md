# AGENTS.md — harness-dc Engineering Guide

Welcome AI Agent! This guide defines the operational rules, codebase architecture, and engineering standards for `@muaraai/harness-dc`.

---

## 1. Project Overview & Philosophy

`harness-dc` is an ultra-lightweight, zero-config Discord Rich Presence daemon for AI coding agents (Hermes Agent, Antigravity, etc.).

### Core Engineering Invariants
- **The Ladder (Ponytail Rule):** Always prefer standard library (`node:net`, `node:util`, `node:fs`) over heavy external dependencies. Zero bloated Discord RPC libraries.
- **Zero Secrets / Zero Token Access:** Never sniff, log, or read agent session tokens or API keys. Process inspection is strictly read-only (`pid`, `comm`, `cmdline`, and `cwd`).
- **Privacy First:** Never bypass `privacyMode`. If enabled, workspace names must always be masked as `"Private Workspace"`.

---

## 2. Codebase Architecture

```text
src/
├── types.ts          # Core data contracts (AgentDefinition, ActivityPayload, HarnessConfig)
├── constants.ts      # Default agent registry (Hermes & Antigravity IDs) + socket path resolver
├── ipc.ts            # Native binary Discord IPC framing client (8-byte LE header, opcodes 0-4)
├── scanner.ts        # Fast process inspection (/proc on Linux, lsof fallback, CWD resolver)
├── daemon.ts         # Polling loop, state machine, multi-agent switching & auto-clear
├── cli.ts            # Entrypoint binary (node:util parseArgs, background spawn, PID manager)
└── index.ts          # Public exports
```

---

## 3. Standard Verification Commands

Before concluding any change or opening a PR:
```bash
# 1. Run all unit & integration tests
npm test

# 2. Compile TypeScript
npm run build

# 3. Verify CLI execution
node dist/cli.js --version
node dist/cli.js status
```

---

## 4. How to Add a New AI Agent

1. Add the agent definition to `src/constants.ts` under `DEFAULT_AGENTS`:
   ```typescript
   {
     key: "agent-key",
     displayName: "Display Name",
     clientId: "DISCORD_APPLICATION_ID",
     processNames: ["binary-name"],
     largeImageKey: "logo",
     largeText: "Display Name",
     smallImageKey: "icon",
     smallText: "Active",
   }
   ```
2. Add test cases in `tests/constants.test.ts` and `tests/scanner.test.ts`.
3. Verify test passes via `npm test`.

---

## 5. Git & Commit Protocol

- Conventional Commits strictly required:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `docs(scope): ...`
  - `test(scope): ...`
  - `chore(scope): ...`
- Keep `docs/` and `graphify-out/` untracked in `.gitignore`.
