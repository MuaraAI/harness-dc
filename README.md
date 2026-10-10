# harness-dc

> ⚡ **Ultra-lightweight Discord Rich Presence daemon for AI coding agents (Hermes Agent & Antigravity)**. Zero configuration required. Built by [MuaraAI](https://github.com/MuaraAI).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

---

## Features

- 🚀 **Zero-Config Launch:** Run immediately via `npx @muaraai/harness-dc` without registering Discord bot tokens or application IDs.
- 🔄 **Dynamic Agent Switching:** Automatically detects whether you are using **Hermes Agent** or **Antigravity CLI / 2.0** and switches the Discord status instantly.
- 📁 **Smart Workspace Detection:** Resolves active repository/folder names directly from the agent's process working directory (`/proc/<pid>/cwd` on Linux, `lsof` on macOS).
- 🔒 **Privacy Mode:** Mask proprietary or sensitive repository names with `--privacy` (displays `Workspace: Private Workspace`).
- 🪶 **Minimal Resource Footprint:** Pure native Node.js IPC implementation (`node:net`) with **zero heavy Discord dependencies**. Uses < 25 MB RAM and < 0.1% CPU.
- 🐧 **Cross-Platform:** Supports Linux (Native pacman/deb/RPM, Flatpak sandbox, Snap), macOS, and Windows 10/11 Named Pipes.

---

## Quick Start

### Run Instantly via npx
```bash
npx @muaraai/harness-dc
```

### Or Install Globally
```bash
npm install -g @muaraai/harness-dc
harness-dc
```

---

## CLI Usage

```text
Usage:
  npx @muaraai/harness-dc [command] [options]

Commands:
  start          Run in foreground (default watch mode)
  daemon         Spawn detached daemon in the background
  stop           Stop the running background daemon
  status         Check background daemon status

Options:
  -p, --privacy  Mask workspace/folder names
  -h, --help     Show help manual
  -v, --version  Show version
```

### Examples

**Run in background as a daemon:**
```bash
harness-dc daemon
```

**Check daemon status:**
```bash
harness-dc status
```

**Stop daemon:**
```bash
harness-dc stop
```

**Run with Privacy Mode enabled:**
```bash
harness-dc --privacy
# or as daemon:
harness-dc daemon --privacy
```

---

## Supported AI Agents

| Agent | Command / Process | Discord Display | Default Client ID |
|---|---|---|---|
| **Hermes Agent** | `hermes` | `Playing Hermes Agent` | `1541753081308512330` |
| **Antigravity** | `agy`, `antigravity` | `Playing Antigravity` | `1558457305995939962` |

---

## Custom Configuration (Optional)

You can customize polling intervals or override Client IDs by creating `~/.config/harness-dc/config.json`:

```json
{
  "pollIntervalMs": 3000,
  "privacyMode": false,
  "customAgents": [
    {
      "key": "custom-agent",
      "displayName": "My Custom Agent",
      "clientId": "YOUR_DISCORD_APP_ID",
      "processNames": ["myagent"],
      "largeImageKey": "logo",
      "largeText": "My Custom Agent",
      "smallImageKey": "icon",
      "smallText": "Active"
    }
  ]
}
```

---

## Architecture & How It Works

1. **Lightweight Socket Discovery:** Scans local Unix domain socket candidate paths (`/run/user/$UID/discord-ipc-0`, Flatpak socket, `/tmp/discord-ipc-0`) or Windows Named Pipe (`\\?\pipe\discord-ipc-0`).
2. **Binary LE Frame Protocol:** Encodes 8-byte LE header packets (`[opcode: 4 bytes][length: 4 bytes][JSON payload]`) directly to the Discord Desktop socket.
3. **Process Harvester:** Scans running agent processes periodically and inspects `/proc/<pid>/cwd` to detect current active projects without spawning heavy subshells.

---

## Development

```bash
# Clone repository
git clone https://github.com/MuaraAI/harness-dc.git
cd harness-dc

# Install dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run build
```

---

## License

[MIT](LICENSE) © 2026 [MuaraAI](https://github.com/MuaraAI)
