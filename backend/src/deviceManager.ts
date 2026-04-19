import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { EventEmitter } from "events";
import { ATVConnection, type CertPair } from "./atvRemote.js";
import { Discovery, type DiscoveredDevice } from "./discovery.js";
import { ADBBridge, type MediaSessionInfo } from "./adbBridge.js";
import { CastBridge, type CastMediaStatus } from "./castBridge.js";
import { resolveMAC, pingHost, wakeDevice } from "./wol.js";
import type { DeviceState, PersistedDevice, MediaMetadata } from "./types.js";
import { APP_LABELS } from "./types.js";

const DATA_DIR = path.resolve("data");
const DEVICES_FILE = path.join(DATA_DIR, "devices.json");

const WAKE_SETTLE_MS = 8_000;
const WAKE_RETRY_INTERVAL_MS = 3_000;
const WAKE_MAX_RETRIES = 5;
const READY_TIMEOUT_MS = 10_000;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

    // Connect persisted devices in the background so the HTTP server
    // can start immediately even if some devices are unreachable.
    for (const dev of this.persisted.values()) {
      if (dev.cert && dev.key) {
        this.connectDevice(dev.id, dev.host, dev.name, {
          cert: dev.cert,
          key: dev.key,
        }).catch((err) => {
          console.error(`[DeviceManager] Background connect failed for ${dev.name}:`, err);
        });
      }
    }

    // Resolve MAC addresses for any paired devices that don't have one yet
    this.resolveAllMACs().catch(() => {});
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

  isADBAvailable(): boolean {
    return this.adbBridge.isAvailable;
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
      const isPowered = state?.isPowered ?? false;
      const media = isPowered ? this.mediaCache.get(id) : undefined;
      devices.push({
        id,
        name: persisted.name,
        host: persisted.host,
        isPowered,
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

    // Try to resolve MAC in background
    this.tryResolveMAC(id, host).catch(() => {});

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
          mac: existing?.mac,
        });
        this.savePersisted();

        this.connections.set(id, conn);
        conn.on("state_changed", () => {
          const state = this.getDevice(id);
          if (state) this.emit("device:state", state);
        });

        // Resolve MAC now that we have a live connection
        this.tryResolveMAC(id, host).catch(() => {});

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

  sendKey(id: string, keyCode: number, direction?: number): void {
    const conn = this.connections.get(id);
    if (!conn) throw new Error("Device not connected: " + id);
    conn.sendKey(keyCode, direction);
  }

  sendKeyPress(id: string, keyCode: number): void {
    const conn = this.connections.get(id);
    if (!conn) throw new Error("Device not connected: " + id);
    conn.sendKeyPress(keyCode);
  }

  sendAppLink(id: string, link: string): void {
    const conn = this.connections.get(id);
    if (!conn) throw new Error("Device not connected: " + id);
    conn.sendAppLink(link);
  }

  /**
   * Toggle power. If the connection is alive, send the power command directly.
   * If the connection is dead (device in deep sleep), attempt WOL + reconnect.
   */
  async sendPower(id: string): Promise<{ method: "remote" | "wol"; ok: boolean }> {
    const conn = this.connections.get(id);
    const persisted = this.persisted.get(id);

    // Happy path: connection is alive — send power toggle
    if (conn?.isReady) {
      conn.sendPower();
      return { method: "remote", ok: true };
    }

    // Connection is dead — try WOL
    if (!persisted) throw new Error("Device not found: " + id);

    console.log(`[DeviceManager] Connection not ready for ${persisted.name}, attempting WOL wake`);

    const mac = await wakeDevice(persisted.host, persisted.mac);
    if (!mac) {
      throw new Error(
        "Cannot wake device — MAC address unknown. " +
        "Make sure the device was online at least once so its MAC could be learned."
      );
    }

    // Persist the MAC if we just learned it
    if (!persisted.mac) {
      persisted.mac = mac;
      this.savePersisted();
    }

    // Wait for the device to come back, then reconnect
    console.log(`[DeviceManager] WOL sent to ${mac}, waiting for device to wake...`);
    await sleep(WAKE_SETTLE_MS);

    // Helper: attempt reconnect and wait for the "ready" event with a timeout
    const tryReconnectAndWaitReady = (c: ATVConnection): Promise<boolean> => {
      return new Promise(async (resolve) => {
        const onReady = () => {
          clearTimeout(timer);
          resolve(true);
        };
        const timer = setTimeout(() => {
          c.removeListener("ready", onReady);
          resolve(false);
        }, READY_TIMEOUT_MS);

        c.once("ready", onReady);
        try {
          const started = await c.reconnect();
          if (!started) {
            clearTimeout(timer);
            c.removeListener("ready", onReady);
            resolve(false);
          }
        } catch {
          clearTimeout(timer);
          c.removeListener("ready", onReady);
          resolve(false);
        }
      });
    };

    // Attempt reconnect with retries
    const targetConn = conn ?? this.connections.get(id);
    if (targetConn) {
      for (let attempt = 0; attempt < WAKE_MAX_RETRIES; attempt++) {
        console.log(`[DeviceManager] WOL reconnect attempt ${attempt + 1}/${WAKE_MAX_RETRIES} for ${persisted.name}`);
        const ok = await tryReconnectAndWaitReady(targetConn);
        if (ok) {
          console.log(`[DeviceManager] Reconnected to ${persisted.name} after WOL`);
          const state = this.getDevice(id);
          if (state) this.emit("device:state", state);
          return { method: "wol", ok: true };
        }
        if (attempt < WAKE_MAX_RETRIES - 1) {
          await sleep(WAKE_RETRY_INTERVAL_MS);
        }
      }
    } else if (persisted.cert && persisted.key) {
      for (let attempt = 0; attempt < WAKE_MAX_RETRIES; attempt++) {
        console.log(`[DeviceManager] WOL connect attempt ${attempt + 1}/${WAKE_MAX_RETRIES} for ${persisted.name}`);
        try {
          await this.connectDevice(id, persisted.host, persisted.name, {
            cert: persisted.cert,
            key: persisted.key,
          });
          const newConn = this.connections.get(id);
          if (newConn?.isReady) {
            console.log(`[DeviceManager] Connected to ${persisted.name} after WOL`);
            return { method: "wol", ok: true };
          }
        } catch {
          // retry
        }
        if (attempt < WAKE_MAX_RETRIES - 1) {
          await sleep(WAKE_RETRY_INTERVAL_MS);
        }
      }
    }

    return { method: "wol", ok: false };
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

    // Try to learn the MAC address
    this.tryResolveMAC(id, dev.host).catch(() => {});

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
    // Skip if already connected / connecting
    if (this.connections.has(id)) return;

    const conn = new ATVConnection(host, name, cert);
    // Register immediately so parallel callers see it and don't create duplicates
    this.connections.set(id, conn);

    conn.on("state_changed", () => {
      const state = this.getDevice(id);
      if (state) this.emit("device:state", state);
    });

    conn.on("unpaired", () => {
      console.log(`[DeviceManager] Device ${name} (${host}) became unpaired`);
      this.connections.delete(id);
      this.mediaCache.delete(id);
      this.castBridge.stopPolling(host);
      this.castBridge.clearLastStatus(host);
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
      console.log(`[DeviceManager] Connected to ${name} (${host})`);
      this.tryResolveMAC(id, host).catch(() => {});
    } catch (err) {
      console.error(`[DeviceManager] Failed to connect to ${name}:`, err);
    }
  }

  /**
   * Try to resolve and cache the MAC address for a device.
   */
  private async tryResolveMAC(id: string, host: string): Promise<void> {
    const persisted = this.persisted.get(id);
    if (!persisted || persisted.mac) return;

    await pingHost(host);
    const mac = await resolveMAC(host);
    if (mac) {
      console.log(`[DeviceManager] Learned MAC for ${persisted.name}: ${mac}`);
      persisted.mac = mac;
      this.savePersisted();
    }
  }

  /**
   * Resolve MAC addresses for all persisted devices that are missing one.
   */
  private async resolveAllMACs(): Promise<void> {
    for (const dev of this.persisted.values()) {
      if (!dev.mac && dev.cert) {
        await this.tryResolveMAC(dev.id, dev.host).catch(() => {});
      }
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
