# harness-dc

Discord Rich Presence background daemon for AI coding agents (Hermes Agent & Antigravity).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

harness-dc inspects local processes to detect active AI coding sessions, resolves the working directory, and updates your Discord profile via local IPC sockets without manual configuration.

## Why this

- **Zero setup:** Runs out of the box via `npx` with bundled official application IDs for Hermes Agent and Antigravity.
- **Native framing:** Uses Node's `node:net` stdlib for Discord binary IPC framing (8-byte little-endian header) instead of third-party Discord SDKs. Memory usage remains under 25 MB RSS.
- **Process-level workspace resolution:** Reads `/proc/<pid>/cwd` on Linux and `lsof` on macOS to extract repository names without parsing internal agent transcripts.
- **Privacy mode:** Masks workspace and folder names when working on private codebases.

## Quick Start

Run directly without installing:

```bash
npx @muaraai/harness-dc
```

Or install globally:

```bash
npm install -g @muaraai/harness-dc
harness-dc
```

Side effects:
- Connects locally to Discord desktop socket (`/run/user/$UID/discord-ipc-0` on Linux, `$TMPDIR/discord-ipc-0` on macOS, or `\\?\pipe\discord-ipc-0` on Windows).
- When running in daemon mode, writes a PID file to `~/.config/harness-dc/daemon.pid`.
- To undo: run `harness-dc stop` to terminate the daemon and clear presence.

## Usage

```bash
# Foreground watch mode (default)
harness-dc start

# Background daemon mode
harness-dc daemon

# Check daemon status
harness-dc status

# Stop background daemon
harness-dc stop

# Enable privacy mask
harness-dc --privacy
harness-dc daemon --privacy
```

### Real session output

```text
$ harness-dc daemon
========================================
  Harness-DC — Discord Rich Presence
  Hermes Agent & Antigravity by MuaraAI
========================================

✓ harness-dc daemon started in background (PID: 35373)
Use harness-dc status to check or harness-dc stop to terminate.

$ harness-dc status
[harness-dc] Daemon is running (PID: 35373).

$ harness-dc stop
✓ harness-dc daemon (PID: 35373) stopped.
```

## Supported Agents

| Agent | Binary / Process | Discord Status | Client ID |
|---|---|---|---|
| Hermes Agent | `hermes` | Playing Hermes Agent | `1541753081308512330` |
| Antigravity | `agy`, `antigravity` | Playing Antigravity | `1558457305995939962` |

<details>
<summary>How it works</summary>

1. **Socket Discovery:** Scans Unix domain socket paths (`/run/user/$UID/discord-ipc-{0..9}`, Flatpak sandbox paths, Snap paths, `/tmp`) or Windows Named Pipes (`\\?\pipe\discord-ipc-{0..9}`).
2. **Binary LE Framing:** Establishes a local IPC handshake (`opcode: 0`) and sends `SET_ACTIVITY` frames (`opcode: 1`) with an 8-byte LE header (`[opcode: uint32LE][length: uint32LE][payload]`).
3. **Process Poller:** Periodically inspects running processes every 3 seconds. When an agent is detected, resolves its current working directory (CWD) to derive workspace details.
4. **Auto-Cleanup:** When the agent terminates or Discord closes, the daemon clears the active presence and resets to idle.

</details>

<details>
<summary>Custom Configuration</summary>

Override defaults by creating `~/.config/harness-dc/config.json`:

```json
{
  "pollIntervalMs": 3000,
  "privacyMode": false,
  "customAgents": [
    {
      "key": "custom-agent",
      "displayName": "Custom Agent",
      "clientId": "YOUR_DISCORD_APP_ID",
      "processNames": ["myagent"],
      "largeImageKey": "logo",
      "largeText": "Custom Agent",
      "smallImageKey": "icon",
      "smallText": "Active"
    }
  ]
}
```

</details>

## Contributing & Security

- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- License: [MIT](LICENSE) © 2026 MuaraAI
