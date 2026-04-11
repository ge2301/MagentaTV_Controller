import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { DeviceManager } from "./deviceManager.js";
import { createDeviceRoutes } from "./routes/devices.js";
import type { WSMessage } from "./types.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/api/ws" });

const manager = new DeviceManager();

app.use("/api/devices", createDeviceRoutes(manager));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", devices: manager.getDevices().length });
});

// --- WebSocket broadcasting ---

const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);

  const list: WSMessage = {
    type: "devices:list",
    payload: manager.getDevices(),
  };
  ws.send(JSON.stringify(list));

  ws.on("close", () => {
    clients.delete(ws);
  });
});

function broadcast(msg: WSMessage): void {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

manager.on("device:discovered", (device) => {
  broadcast({ type: "device:discovered", deviceId: device?.id, payload: device });
});

manager.on("device:state", (device) => {
  broadcast({ type: "device:state", deviceId: device?.id, payload: device });
});

manager.on("device:paired", (device) => {
  broadcast({ type: "device:paired", deviceId: device?.id, payload: device });
});

manager.on("device:removed", (id) => {
  broadcast({ type: "device:removed", deviceId: id, payload: null });
});

// --- Start ---

async function main(): Promise<void> {
  await manager.start();

  server.listen(PORT, () => {
    console.log(`\n  Magenta Control backend running on http://localhost:${PORT}`);
    console.log(`  WebSocket at ws://localhost:${PORT}/api/ws`);
    console.log(`  REST API at http://localhost:${PORT}/api/devices\n`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  manager.stop();
  server.close();
  process.exit(0);
});
