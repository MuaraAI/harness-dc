# Graph Report - harness-dc  (2026-10-10)

## Corpus Check
- 18 files · ~6,441 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 146 nodes · 227 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc5e667e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- daemon.ts
- compilerOptions
- DiscordIpcClient
- cli.ts
- scripts
- PRD: harness-dc (Discord Rich Presence Daemon for AI Coding Agents)
- harness-dc
- Review Focus
- scanner.ts

## God Nodes (most connected - your core abstractions)
1. `DiscordIpcClient` - 14 edges
2. `compilerOptions` - 14 edges
3. `PRD: harness-dc (Discord Rich Presence Daemon for AI Coding Agents)` - 13 edges
4. `HarnessDaemon` - 11 edges
5. `harness-dc` - 9 edges
6. `Review Focus` - 8 edges
7. `main()` - 7 edges
8. `ActiveAgentInfo` - 7 edges
9. `scripts` - 6 edges
10. `vitest` - 6 edges

## Surprising Connections (you probably didn't know these)
- `DaemonStatus` --references--> `ActiveAgentInfo`  [EXTRACTED]
  src/daemon.ts → src/types.ts
- `DaemonOptions` --references--> `DiscordIpcClient`  [EXTRACTED]
  src/daemon.ts → src/ipc.ts
- `HarnessDaemon` --references--> `DiscordIpcClient`  [EXTRACTED]
  src/daemon.ts → src/ipc.ts
- `HarnessDaemon` --references--> `ActiveAgentInfo`  [EXTRACTED]
  src/daemon.ts → src/types.ts
- `HarnessDaemon` --references--> `HarnessConfig`  [EXTRACTED]
  src/daemon.ts → src/types.ts

## Import Cycles
- None detected.

## Communities (10 total, 1 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.08
Nodes (24): author, bin, harness-dc, bugs, url, description, devDependencies, @types/node (+16 more)

### Community 1 - "daemon.ts"
Cohesion: 0.22
Nodes (11): vitest, loadConfig(), DEFAULT_AGENTS, getSocketPaths(), DaemonOptions, DaemonStatus, OPCODES, ActiveAgentInfo (+3 more)

### Community 2 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+8 more)

### Community 4 - "cli.ts"
Cohesion: 0.21
Nodes (13): getPidFilePath(), handleDaemon(), handleStart(), handleStatus(), handleStop(), isDirectRun, main(), parseCliArgs() (+5 more)

### Community 5 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, start, test, test:watch, watch

### Community 6 - "PRD: harness-dc (Discord Rich Presence Daemon for AI Coding Agents)"
Cohesion: 0.12
Nodes (16): 10. Dependencies & Prerequisites, 11. Risks & Open Questions, 12. Milestones, 1. Executive Summary, 2. Problem Statement, 3. Goals & Non-Goals, 4. Target Users, 5. User Stories (+8 more)

### Community 7 - "harness-dc"
Cohesion: 0.15
Nodes (12): Architecture & How It Works, CLI Usage, Custom Configuration (Optional), Development, Examples, Features, harness-dc, License (+4 more)

### Community 8 - "Review Focus"
Cohesion: 0.18
Nodes (10): Global Constraints, harness-dc Implementation Plan, Review Focus, Task 1: Project Scaffolding & TypeScript Configuration, Task 2: Core Data Types & Constants Registry, Task 3: Discord IPC Native Socket Client (The Framing Protocol), Task 4: Process Scanner & Workspace CWD Resolver, Task 5: Daemon Loop & State Management (+2 more)

### Community 9 - "scanner.ts"
Cohesion: 0.47
Nodes (7): execFileAsync, extractWorkspaceName(), matchProcessAgent(), ProcessCandidate, resolveProcessCwd(), scanActiveAgent(), AgentDefinition

## Knowledge Gaps
- **74 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+69 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 78 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `daemon.ts` to `package.json`, `scanner.ts`, `cli.ts`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **Why does `DiscordIpcClient` connect `DiscordIpcClient` to `daemon.ts`, `cli.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _74 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `PRD: harness-dc (Discord Rich Presence Daemon for AI Coding Agents)` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._