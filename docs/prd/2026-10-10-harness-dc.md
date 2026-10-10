# PRD: harness-dc (Discord Rich Presence Daemon for AI Coding Agents)

- Date: 2026-10-10
- Status: approved
- Author: Yuken Velino (MuaraAI)

## 1. Executive Summary
`harness-dc` adalah tools Discord Rich Presence otomatis untuk AI coding agents (Hermes Agent & Antigravity IDE/CLI di MVP v1). Berjalan sebagai background daemon berbasis Node.js/TypeScript yang hemat resource, tool ini secara dinamis memindai proses agent lokal, membaca direktori kerja (workspace), dan memperbarui profil Discord pengguna secara real-time via local IPC socket. Proyek ini dipublikasikan sebagai open-source di bawah lisensi MIT di organisasi MuaraAI (`MuaraAI/harness-dc`).

## 2. Problem Statement
Developer yang menggunakan coding agent di terminal (Hermes Agent) atau Antigravity IDE/CLI saat ini tampil offline atau hanya menampilkan status generik ("Visual Studio Code") di Discord. Tidak ada representasi visual real-time yang membedakan aktivitas coding bersama AI agent, proyek/workspace apa yang sedang digarap, atau berapa lama sesi coding berlangsung. Sementara itu, membuat Rich Presence kustom secara manual membutuhkan setup Discord Developer Portal dan bot token yang merepotkan bagi pengguna umum.

## 3. Goals & Non-Goals

### Goals
- **Zero-Config Launch:** Pengguna dapat langsung menjalankan `npx @muaraai/harness-dc` tanpa harus membuat aplikasi Discord sendiri.
- **Dynamic Multi-Agent Switching:** Otomatis berganti antara Discord Client ID (Hermes Agent vs Antigravity) tergantung agent mana yang sedang aktif di sistem.
- **Automatic Workspace Detection:** Mendeteksi nama git repository atau folder kerja aktif dari proses agent (CWD inspection).
- **Privacy Mode:** Opsi menyamarkan nama workspace sensitif menjadi label generik (`Private Workspace`).
- **Low Footprint & Auto-Cleanup:** Konsumsi memori < 30 MB, polling interval 3 detik (< 0.1% CPU), dan otomatis mengosongkan status presence jika proses agent ditutup.

### Non-Goals (Out of Scope v1)
- **Token/Billing Sniffing:** Tidak membaca API key, token balance, atau data sensitif dari session agent.
- **Agent Interception / Control:** Murni monitor status read-only; tidak menyuntikkan prompt atau mengubah behavior agent.
- **Desktop GUI (Electron/Tauri):** Murni CLI dan background daemon untuk menjaga kesederhanaan dan performa tinggi.
- **Default Claude Code ID:** Karena kebijakan nama brand di Discord Developer Portal memblokir nama "Claude Code", ID Claude dibuat opsional via custom config override (`config.json`), tidak di-bundle secara default di v1.

## 4. Target Users
- **AI Agent Power Users & Developers:** Pengembang yang rutin ngoding menggunakan Hermes Agent atau Antigravity dan aktif berkomunikasi di komunitas Discord (MuaraAI, developer group, server komunitas tech).
- **Open-Source Contributors:** Pengembang yang ingin menambahkan dukungan agent baru (Aider, Codex, Goose, dll.) via skema registry terbuka.

## 5. User Stories
- **US-1 (Zero-Config Execution):** Sebagai developer, saya ingin menjalankan `npx @muaraai/harness-dc` dan status Discord saya langsung berubah menjadi `Playing Hermes Agent` saat Hermes berjalan, tanpa konfigurasi manual apa pun.
- **US-2 (Context Awareness):** Sebagai developer, saya ingin teman Discord melihat proyek apa yang sedang saya kerjakan (contoh: `Workspace: MuaraAI/harness-dc`).
- **US-3 (Privacy Guard):** Sebagai developer yang mengerjakan proyek privat/NDA, saya ingin mengaktifkan `--privacy` sehingga nama folder diganti menjadi `Workspace: Private Workspace`.
- **US-4 (Agent Switching):** Sebagai developer yang beralih dari Hermes ke Antigravity, saya ingin Discord presence otomatis disconnect dari Hermes dan connect ke Antigravity tanpa perlu me-restart daemon.
- **US-5 (Clean Teardown):** Sebagai developer, saat saya menghentikan agent (Ctrl+C atau exit), saya ingin status Discord presence terhapus dalam waktu maksimal 5 detik.
- **US-6 (Custom Client ID Override):** Sebagai developer yang memiliki Discord App sendiri dengan custom logo, saya ingin bisa mendefinisikan `clientId` kustom di `~/.config/harness-dc/config.json`.

## 6. Functional Requirements

| ID | Deskripsi Kebutuhan | Prioritas |
|---|---|---|
| **FR-1** | **Process Scanner:** Memindai tabel proses sistem setiap 3 detik untuk mendeteksi `hermes` dan `antigravity` (termasuk variasi eksekusi node/python/binary). | **P0** |
| **FR-2** | **Discord IPC Connection:** Berkomunikasi langsung via Unix Domain Socket (`/run/user/$UID/discord-ipc-0` di Linux, `discord-ipc-0` di macOS/Windows) menggunakan protokol frame Discord IPC (`[op: int32LE][len: int32LE][payload]`). | **P0** |
| **FR-3** | **Pre-configured App Registry:** Membawa default Client ID resmi: Hermes (`1541753081308512330`) dan Antigravity (`1558457305995939962`). | **P0** |
| **FR-4** | **CWD Resolver:** Mengekstrak direktori kerja aktif dari PID agent (via `/proc/<PID>/cwd` di Linux atau fallback `lsof`/`ps`) untuk mengekstrak nama repo/folder. | **P0** |
| **FR-5** | **Activity Formatter:** Mengirim opcode `FRAME` dengan payload `SET_ACTIVITY` berisi `details` (nama workspace), `state` (status aktivitas), `timestamps.start` (waktu mulai), dan asset image (`large_image: "logo"`). | **P0** |
| **FR-6** | **Auto-Clear / Idle State:** Menghapus activity (`SET_ACTIVITY` dengan data kosong) jika tidak ada agent yang terdeteksi aktif dalam siklus polling. | **P0** |
| **FR-7** | **CLI Subcommands:** Menyediakan antarmuka CLI standar: `harness-dc start` (foreground / watch mode), `harness-dc daemon` (background spawn), `harness-dc stop`, dan `harness-dc status`. | **P1** |
| **FR-8** | **Configuration Loader:** Membaca file opsional `~/.config/harness-dc/config.json` untuk kustomisasi Client ID, whitelist/blacklist repo, dan toggle privacy mode. | **P1** |
| **FR-9** | **Linux Systemd Helper:** Perintah `harness-dc service install` untuk membuat unit file user systemd (`~/.config/systemd/user/harness-dc.service`). | **P2** |

## 7. User Flows

### Flow 1: Normal Daemon Lifecycle
```text
[User starts agent: 'hermes']
       │
       ▼
[harness-dc Poller detects PID]
       │
       ▼
[Resolve CWD -> 'MuaraAI/harness-dc']
       │
       ▼
[Connect to Discord IPC Socket via Hermes Client ID: 1541753081308512330]
       │
       ▼
[Send Handshake -> Receive Ready]
       │
       ▼
[Send SET_ACTIVITY: Details="Workspace: harness-dc", State="Agent Active"]
       │
[Discord shows: 'Playing Hermes Agent']
       │
[User exits Hermes]
       │
       ▼
[Poller detects no active agent] -> [Send SET_ACTIVITY null] -> [Presence cleared]
```

## 8. Success Metrics
- **Zero Configuration:** 100% pengguna dapat menjalankan presence tanpa input konfigurasi manual.
- **Detection Latency:** Perubahan status terdeteksi dan terkirim ke Discord dalam < 3 detik.
- **Resource Footprint:** Memory RSS < 30 MB; CPU usage rata-rata < 0.2%.
- **Stability:** Graceful recovery saat Discord app ditutup lalu dibuka kembali tanpa crash daemon.

## 9. Technical Considerations
- **Runtime:** Node.js 18+ / TypeScript.
- **Dependencies (The Ladder / Ponytail Rule):**
  - CLI: `node:util` (`parseArgs`) native stdlib.
  - IPC: `node:net` native socket stdlib (tanpa library eksternal discord-rpc berukuran besar).
  - Process Inspection: native `child_process.execFile` (`pgrep`, `ps`) dan native `/proc` filesystem reader di Linux.
- **Config Storage:** `~/.config/harness-dc/config.json`.
- **License:** MIT License.
- **Distribution:** npm public package (`@muaraai/harness-dc` atau `harness-dc`) dan binary release.

## 10. Dependencies & Prerequisites
- **Discord Developer Portal Apps:**
  - Hermes Agent: ID `1541753081308512330` (Aset gambar `logo` di-upload).
  - Antigravity: ID `1558457305995939962` (Aset gambar `logo` di-upload).
- **Target Repository:** `MuaraAI/harness-dc` (GitHub public repository).

## 11. Risks & Open Questions
- **Risk 1:** Discord IPC socket path berbeda pada snap/flatpak Discord di Linux.
  - *Mitigasi:* Scan multiple socket paths (`/run/user/$UID/discord-ipc-0`, `/tmp/discord-ipc-0`, `$XDG_RUNTIME_DIR/app/com.discordapp.Discord/discord-ipc-0`).
- **Risk 2:** Cross-platform CWD resolution di macOS / Windows.
  - *Mitigasi:* Di Linux baca `/proc/<pid>/cwd`; di macOS/Windows fallback ke `lsof -p <pid>` atau default generic label jika permission dibatasi.

## 12. Milestones
- **Milestone 1 (Core IPC & Frame Protocol):** Implementasi lightweight Discord IPC client menggunakan native `node:net`.
- **Milestone 2 (Process & CWD Scanner):** Deteksi proses `hermes` dan `antigravity` beserta direktori kerja.
- **Milestone 3 (Agent State Machine & Switching):** Manajemen koneksi multi-client ID dan auto-clear.
- **Milestone 4 (CLI & Daemonization):** Command `start`, `stop`, `status`, dan flag `--privacy`.
- **Milestone 5 (Publishing & Documentation):** Setup GitHub repo `MuaraAI/harness-dc`, README, dan publikasi npm package.
