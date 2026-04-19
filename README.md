# Magenta Home Control

An Apple Home-inspired web dashboard to discover, monitor, and control Telekom Magenta TV devices (MagentaTV Stick Gen 2, MagentaTV One) on your local network.

## Features

- **Auto-discovery** of Android TV devices via mDNS + manual IP entry
- **Real-time status** — power, current app, volume (via WebSocket)
- **Virtual remote** — D-pad, media transport, volume, channel, number pad
- **App launchers** — MagentaTV, Netflix, YouTube, Disney+, Prime Video, Spotify
- **Now Playing metadata** — via optional ADB or Google Cast integration
- **Dark, glass-morphism UI** inspired by Apple Home

## Quick Start

### Prerequisites

- Node.js 20+
- Magenta TV device(s) on the same local network

### Install & Run

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

The backend runs on port `3001`. The Vite dev server proxies `/api` and `/ws` to it automatically.

## How It Works

### Protocols

| Protocol | Library | Purpose |
|----------|---------|---------|
| Android TV Remote v2 | `androidtv-remote` | Primary: discovery, pairing, control, state |
| ADB over WiFi | `@devicefarmer/adbkit` | Optional: media session metadata |
| Google Cast | `castv2-client` | Optional: cast content status |

### Pairing

1. Add a device (auto-discovered or manual IP)
2. Click "Start Pairing" — a 6-digit PIN appears on the TV
3. Enter the PIN to complete pairing
4. Certificates are stored in `backend/data/devices.json` for reconnection

### Architecture

```
Frontend (React + Tailwind)  ←WebSocket→  Backend (Express + androidtv-remote)
                                              ↕ Android TV Remote Protocol v2 (TLS)
                                          Magenta TV Devices
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | List all devices |
| POST | `/api/devices/add` | Add device by IP |
| POST | `/api/devices/pair/start` | Start pairing |
| POST | `/api/devices/pair/finish` | Submit PIN |
| POST | `/api/devices/:id/key` | Send remote key |
| POST | `/api/devices/:id/launch` | Launch app |
| POST | `/api/devices/:id/power` | Toggle power |
| POST | `/api/devices/:id/adb/enable` | Enable ADB metadata |
| POST | `/api/devices/:id/cast/enable` | Enable Cast metadata |
| DELETE | `/api/devices/:id` | Remove device |
| WS | `/ws` | Real-time state stream |
