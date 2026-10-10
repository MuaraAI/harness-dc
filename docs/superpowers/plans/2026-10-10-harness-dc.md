# harness-dc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun CLI & background daemon Discord Rich Presence ultra-ringan (`harness-dc`) untuk AI coding agents (Hermes Agent & Antigravity) dengan zero-config `npx`, auto-detecting process CWD, dan native IPC framing.

**Architecture:** Node.js/TypeScript tanpa dependency berat. Menggunakan `node:net` untuk socket IPC Discord (Unix Domain Socket / Windows Named Pipe) dan `node:util` (`parseArgs`) untuk CLI. Daemon memindai proses lokal secara periodik (3s), mencocokkan PID agent aktif, mengekstrak CWD workspace, dan memancarkan payload `SET_ACTIVITY` ke Discord IPC.

**Tech Stack:** TypeScript, Node.js 18+, Node native stdlib (`node:net`, `node:util`, `node:fs`, `node:child_process`), Vitest/Node test runner.

**Spec:** `docs/prd/2026-10-10-harness-dc.md`

## Global Constraints
- Node 18+ native modules only where possible (The Ladder: zero heavy external discord libraries).
- Executable binary configured in `package.json` under `"bin": { "harness-dc": "./dist/cli.js" }`.
- Permissive MIT License; target repository `MuaraAI/harness-dc`.
- Built-in App IDs: Hermes (`1541753081308512330`) and Antigravity (`1558457305995939962`).
- Safe privacy mode: menyamarkan nama workspace ketika `--privacy` aktif.

## Review Focus
1. **Discord Client Disconnect/Reconnect:** Daemon harus graceful reconnect tanpa crash saat Discord ditutup lalu dibuka kembali.
2. **Zombie Agent PIDs:** Handle jika PID proses agent di `/proc` sudah exit saat CWD sedang dibaca.
3. **Multi-Agent Conflict:** Jika Hermes dan Antigravity berjalan bersamaan, gunakan agent dengan waktu start paling baru (atau deterministik precedence).
4. **Platform IPC Socket Paths:** Cek semua kemungkinan path Unix socket (`/run/user/$UID/discord-ipc-0`, `/tmp/discord-ipc-0`, Flatpak sandbox).
5. **Clean IPC Frame Encoding:** Opcode `0` (Handshake) dan `1` (Frame) harus di-encode dengan 8-byte LE header (`[opcode: 4 bytes][length: 4 bytes]`) yang valid.

---

### Task 1: Project Scaffolding & TypeScript Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `LICENSE`

**Interfaces:**
- Produces: Project build pipeline (`npm run build`), test runner setup, and bin definition.

- [ ] **Step 1: Create package.json with bin and scripts**
Define package `@muaraai/harness-dc` with TypeScript dependencies, type definitions, and Vitest.

- [ ] **Step 2: Create tsconfig.json**
Configure strict TypeScript settings with ESM output (`moduleResolution: "node16"`, `outDir: "./dist"`).

- [ ] **Step 3: Create .gitignore and LICENSE (MIT)**
Exclude `node_modules/`, `dist/`, `.env`, and test artifacts. Set MIT license for MuaraAI.

- [ ] **Step 4: Install dependencies and verify build toolchain**
Run: `npm install` and check TypeScript compilation.

- [ ] **Step 5: Commit**
`git add package.json tsconfig.json .gitignore LICENSE && git commit -m "chore: scaffold project structure and typescript config"`

---

### Task 2: Core Data Types & Constants Registry

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`
- Test: `tests/constants.test.ts`

**Interfaces:**
- Produces: `AgentDefinition`, `ActivityPayload`, `HarnessConfig`, `DEFAULT_AGENTS`, `DEFAULT_SOCKET_PATHS`.

- [ ] **Step 1: Write test for constants registry**
Verify default client IDs for Hermes and Antigravity match the PRD.

- [ ] **Step 2: Run test to verify it fails**
Run test suite to confirm types and constants are not yet defined.

- [ ] **Step 3: Implement src/types.ts and src/constants.ts**
Declare data contracts for agent definitions, Discord activity payload, and socket paths.

- [ ] **Step 4: Run test to verify it passes**
Verify test passes cleanly.

- [ ] **Step 5: Commit**
`git add src/types.ts src/constants.ts tests/constants.test.ts && git commit -m "feat: add core types and agent registry constants"`

---

### Task 3: Discord IPC Native Socket Client (The Framing Protocol)

**Files:**
- Create: `src/ipc.ts`
- Test: `tests/ipc.test.ts`

**Interfaces:**
- Consumes: `ActivityPayload` from `src/types.ts`.
- Produces: `DiscordIpcClient` class with `connect(clientId)`, `sendActivity(payload)`, `clearActivity()`, `disconnect()`, and frame encoder/decoder.

- [ ] **Step 1: Write unit test with Mock IPC Socket Server**
Create a local mock net.Server emulating Discord IPC opcode 0 (Handshake) and opcode 1 (Frame SET_ACTIVITY).

- [ ] **Step 2: Run test to verify it fails**
Ensure tests fail before implementing `DiscordIpcClient`.

- [ ] **Step 3: Implement src/ipc.ts**
Implement LE packet framing:
`Buffer.alloc(8)` with opcode and JSON payload length, followed by utf-8 JSON body. Handle socket reconnect and error boundaries.

- [ ] **Step 4: Run test to verify it passes**
Verify handshake and activity transmission succeed.

- [ ] **Step 5: Commit**
`git add src/ipc.ts tests/ipc.test.ts && git commit -m "feat(ipc): implement native discord ipc framing client"`

---

### Task 4: Process Scanner & Workspace CWD Resolver

**Files:**
- Create: `src/scanner.ts`
- Test: `tests/scanner.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_AGENTS` from `src/constants.ts`.
- Produces: `scanActiveAgent(privacyMode?: boolean): Promise<ActiveAgentInfo | null>`.

- [ ] **Step 1: Write unit test for process scanner & CWD parsing**
Test workspace detection from path names, fallback to folder name, and privacy mask when privacyMode is enabled.

- [ ] **Step 2: Run test to verify it fails**
Verify failure prior to implementation.

- [ ] **Step 3: Implement src/scanner.ts**
Inspect process list via `/proc` (Linux) or `pgrep`/`ps` fallback, read symlink `/proc/<pid>/cwd`, extract repository name, and match against `DEFAULT_AGENTS`.

- [ ] **Step 4: Run test to verify it passes**
Confirm scanner identifies target agents and correctly sanitizes privacy paths.

- [ ] **Step 5: Commit**
`git add src/scanner.ts tests/scanner.test.ts && git commit -m "feat(scanner): implement process detector and cwd resolver"`

---

### Task 5: Daemon Loop & State Management

**Files:**
- Create: `src/daemon.ts`
- Test: `tests/daemon.test.ts`

**Interfaces:**
- Consumes: `DiscordIpcClient` and `scanActiveAgent`.
- Produces: `HarnessDaemon` class managing poll timers, active connection switching, and graceful exit hooks.

- [ ] **Step 1: Write unit test for state transitions**
Test transitions: `idle -> hermes detected (connect) -> antigravity detected (switch client) -> exited (clear activity)`.

- [ ] **Step 2: Run test to verify it fails**
Confirm daemon runner test fails.

- [ ] **Step 3: Implement src/daemon.ts**
Implement lifecycle runner with 3s polling timer, PID tracking, elapsed time calculation, and SIGINT/SIGTERM teardown.

- [ ] **Step 4: Run test to verify it passes**
Verify timer transitions and cleanup logic pass.

- [ ] **Step 5: Commit**
`git add src/daemon.ts tests/daemon.test.ts && git commit -m "feat(daemon): implement polling state machine and connection manager"`

---

### Task 6: CLI Interface & Background Process Daemonizer

**Files:**
- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Produces: Executable CLI binary (`harness-dc`) handling commands: `start` (foreground), `daemon` (background spawn), `stop`, `status`, `--privacy`, `--help`.

- [ ] **Step 1: Write test for CLI argument parser**
Test subcommand resolution and flag parsing with `node:util.parseArgs`.

- [ ] **Step 2: Run test to verify it fails**
Confirm failure before CLI wiring.

- [ ] **Step 3: Implement src/cli.ts with shebang**
Add `#!/usr/bin/env node`, wire `parseArgs`, handle PID file write/read for background daemon lifecycle (`~/.config/harness-dc/daemon.pid`).

- [ ] **Step 4: Run test and verify CLI behavior**
Verify subcommands parse correctly and return appropriate status.

- [ ] **Step 5: Commit**
`git add src/cli.ts tests/cli.test.ts && git commit -m "feat(cli): wire cli entrypoint and background daemon commands"`

---

### Task 7: Build Verification, Integration Check & Documentation

**Files:**
- Create: `README.md`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Produces: End-to-end working bundle ready for `npm link` and `npx`, with GitHub Actions automated CI and npm release workflow.

- [ ] **Step 1: Create README.md**
Document usage (`npx @muaraai/harness-dc`), features, architecture, and manual config instructions.

- [ ] **Step 2: Create GitHub Actions workflows**
Add CI testing workflow and automated npm publish workflow.

- [ ] **Step 3: Run full build and test suite**
Execute `npm run build && npm test` and ensure 100% tests pass and build outputs to `dist/`.

- [ ] **Step 4: Commit**
`git add README.md .github/workflows/ && git commit -m "docs: add readme and github actions workflows"`
