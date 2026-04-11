import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { EventEmitter } from "events";
import { ATVConnection, type CertPair } from "./atvRemote.js";
import { Discovery, type DiscoveredDevice } from "./discovery.js";
import { ADBBridge, type MediaSessionInfo } from "./adbBridge.js";
import { CastBridge, type CastMediaStatus } from "./castBridge.js";
import type { DeviceState, PersistedDevice, MediaMetadata } from "./types.js";
import { APP_LABELS } from "./types.js";

const DATA_DIR = path.resolve("data");
const DEVICES_FILE = path.join(DATA_DIR, "devices.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export class DeviceManager extends EventEmitter {
  private discovery: Discovery;
  private connections = new Map<string, ATVConnection>();
  private persisted = new Map<string, PersistedDevice>();
  private pairingInProgress = new Map<string, ATVConnection>();
  private adbBridge: ADBBridge;
  private castBridge: CastBridge;
  private mediaCache = new Map<string, MediaMetadata>();

  constructor() {
    super();
    this.discovery = new Discovery();
    this.adbBridge = new ADBBridge();
    this.castBridge = new CastBridge();
    ensureDataDir();
    this.loadPersisted();

    this.adbBridge.on("media_info", (host: string, info: MediaSessionInfo) => {
      const id = this.hostToId(host);
      this.mediaCache.set(id, {
        title: info.title,
        artist: info.artist,
        album: info.album,
        playbackState: info.playbackState,
        source: "adb",
      });
      const state = this.getDevice(id);
      if (state) this.emit("device:state", state);
    });

    this.castBridge.on("cast_status", (host: string, status: CastMediaStatus) => {
      const id = this.hostToId(host);
      if (!this.mediaCache.has(id) || this.mediaCache.get(id)!.source === "cast") {
        this.mediaCache.set(id, {
          title: status.title,
          artist: status.artist,
          album: "",
          playbackState: status.playerState,
          source: "cast",
        });
        const state = this.getDevice(id);
        if (state) this.emit("device:state", state);
      }
    });
  }

  async start(): Promise<void> {
    this.discovery.on("device", (dev: DiscoveredDevice) => {
      this.handleDiscoveredDevice(dev);
    });
    this.discovery.start();

    for (const dev of this.persisted.values()) {
      if (dev.cert && dev.key) {
        await this.connectDevice(dev.id, dev.host, dev.name, {
          cert: dev.cert,
          key: dev.key,
        });
      }
    }
  }

  stop(): void {
    this.discovery.stop();
    this.adbBridge.stopAll();
    this.castBridge.stopAll();
    for (const conn of this.connections.values()) {
      conn.disconnect();
    }
    this.connections.clear();
  }

  async enableADB(host: string): Promise<boolean> {
    const ok = await this.adbBridge.connectDevice(host);
    if (ok) this.adbBridge.startPolling(host);
    return ok;
  }

  async enableCast(host: string): Promise<boolean> {
    const ok = await this.castBridge.connectDevice(host);
    if (ok) this.castBridge.startPolling(host);
    return ok;
  }

  getDevices(): DeviceState[] {
    const devices: DeviceState[] = [];

    for (const [id, persisted] of this.persisted) {
      const conn = this.connections.get(id);
      const state = conn?.state;
      const media = this.mediaCache.get(id);
      devices.push({
        id,
        name: persisted.name,
        host: persisted.host,
        isPowered: state?.isPowered ?? false,
        isAvailable: state?.isAvailable ?? false,
        currentApp: state?.currentApp ?? "",
        volume: state?.volume ?? { level: 0, max: 15, muted: false },
        paired: state?.paired ?? !!(persisted.cert && persisted.key),
        model: persisted.manuallyAdded ? "manual" : "mdns",
        media,
      });
    }

    return devices;
  }

  getDevice(id: string): DeviceState | undefined {
    return this.getDevices().find((d) => d.id === id);
  }

  async addManualDevice(host: string, name?: string): Promise<DeviceState> {
    const id = this.hostToId(host);
    const deviceName = name ?? `Android TV (${host})`;

    if (!this.persisted.has(id)) {
      this.persisted.set(id, {
        id,
        name: deviceName,
        host,
        manuallyAdded: true,
      });
      this.savePersisted();
    }

    const device = this.getDevice(id);
    this.emit("device:discovered", device);
    return device!;
  }

  async startPairing(host: string): Promise<string> {
    const id = this.hostToId(host);
    const persisted = this.persisted.get(id);
    const name = persisted?.name ?? `Android TV (${host})`;

    const conn = new ATVConnection(host, name);
    this.pairingInProgress.set(id, conn);

    return new Promise((resolve, reject) => {
      conn.on("secret", () => {
        resolve(id);
        this.emit("device:pairing_started", { id, host });
      });

      conn.on("error", (err: Error) => {
        reject(err);
      });

      conn.startPairing().catch(reject);
    });
  }

  async finishPairing(host: string, code: string): Promise<DeviceState> {
    const id = this.hostToId(host);
    const conn = this.pairingInProgress.get(id);
    if (!conn) throw new Error("No pairing in progress for " + host);

    return new Promise((resolve, reject) => {
      conn.on("paired", (cert: CertPair) => {
        this.pairingInProgress.delete(id);

        const existing = this.persisted.get(id);
        this.persisted.set(id, {
          id,
          name: existing?.name ?? `Android TV (${host})`,
          host,
          manuallyAdded: existing?.manuallyAdded ?? true,
          cert: cert.cert,
          key: cert.key,
        });
        this.savePersisted();

        this.connections.set(id, conn);
        conn.on("state_changed", () => {
          const state = this.getDevice(id);
          if (state) this.emit("device:state", state);
        });

        const state = this.getDevice(id);
        this.emit("device:paired", state);
        resolve(state!);
      });

      conn.on("error", reject);

      try {
        conn.sendPairingCode(code);
      } catch (err) {
        reject(err);
      }
    });
  }

  sendKey(id: string, keyCode: number, direction?: string): void {
    const conn = this.connections.get(id);
    if (!conn) throw new Error("Device not connected: " + id);
    conn.sendKey(keyCode, direction);
  }

  sendAppLink(id: string, link: string): void {
    const conn = this.connections.get(id);
    if (!conn) throw new Error("Device not connected: " + id);
    conn.sendAppLink(link);
  }

  sendPower(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) throw new Error("Device not connected: " + id);
    conn.sendPower();
  }

  removeDevice(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.disconnect();
      this.connections.delete(id);
    }
    this.persisted.delete(id);
    this.savePersisted();
    this.emit("device:removed", id);
  }

  private async handleDiscoveredDevice(dev: DiscoveredDevice): Promise<void> {
    const id = this.hostToId(dev.host);

    if (!this.persisted.has(id)) {
      this.persisted.set(id, {
        id,
        name: dev.name,
        host: dev.host,
        manuallyAdded: false,
      });
      this.savePersisted();
    }

    const persisted = this.persisted.get(id)!;
    if (persisted.cert && persisted.key && !this.connections.has(id)) {
      await this.connectDevice(id, dev.host, persisted.name, {
        cert: persisted.cert,
        key: persisted.key,
      });
    }

    const state = this.getDevice(id);
    this.emit("device:discovered", state);
  }

  private async connectDevice(
    id: string,
    host: string,
    name: string,
    cert: CertPair
  ): Promise<void> {
    const conn = new ATVConnection(host, name, cert);

    conn.on("state_changed", () => {
      const state = this.getDevice(id);
      if (state) this.emit("device:state", state);
    });

    conn.on("unpaired", () => {
      console.log(`[DeviceManager] Device ${name} (${host}) became unpaired`);
      this.connections.delete(id);
      const persisted = this.persisted.get(id);
      if (persisted) {
        persisted.cert = undefined;
        persisted.key = undefined;
        this.savePersisted();
      }
      this.emit("device:state", this.getDevice(id));
    });

    conn.on("error", (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`[DeviceManager] Connection error for ${name}:`, msg);
    });

    try {
      await conn.connect();
      this.connections.set(id, conn);
      console.log(`[DeviceManager] Connected to ${name} (${host})`);
    } catch (err) {
      console.error(`[DeviceManager] Failed to connect to ${name}:`, err);
    }
  }

  private hostToId(host: string): string {
    return host.replace(/\./g, "_");
  }

  private loadPersisted(): void {
    if (!existsSync(DEVICES_FILE)) return;
    try {
      const raw = readFileSync(DEVICES_FILE, "utf-8");
      const arr: PersistedDevice[] = JSON.parse(raw);
      for (const dev of arr) {
        this.persisted.set(dev.id, dev);
      }
      console.log(`[DeviceManager] Loaded ${arr.length} persisted devices`);
    } catch (err) {
      console.error("[DeviceManager] Failed to load devices.json:", err);
    }
  }

  private savePersisted(): void {
    try {
      ensureDataDir();
      const arr = Array.from(this.persisted.values());
      writeFileSync(DEVICES_FILE, JSON.stringify(arr, null, 2));
    } catch (err) {
      console.error("[DeviceManager] Failed to save devices.json:", err);
    }
  }
}

export const APP_LABEL_MAP = APP_LABELS;
