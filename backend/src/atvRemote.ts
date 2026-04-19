import { EventEmitter } from "events";
import type { DeviceState, VolumeInfo } from "./types.js";

// androidtv-remote is a pure JS ESM package without types
// @ts-expect-error no type declarations
import { AndroidRemote, RemoteKeyCode, RemoteDirection } from "androidtv-remote";

export { RemoteKeyCode, RemoteDirection };

export interface CertPair {
  key: string;
  cert: string;
}

interface VolumeEvent {
  level: number;
  maximum: number;
  muted: boolean;
}

const RECONNECT_INITIAL_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;
const RECONNECT_BACKOFF = 2;

export class ATVConnection extends EventEmitter {
  private remote: InstanceType<typeof AndroidRemote> | null = null;
  private _isPowered = false;
  private _currentApp = "";
  private _volume: VolumeInfo = { level: 0, max: 15, muted: false };
  private _isReady = false;
  private cert: CertPair | null;
  private host: string;
  private deviceName: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_INITIAL_MS;
  private _shouldReconnect = false;
  private _connecting = false;

  constructor(host: string, deviceName: string, cert?: CertPair) {
    super();
    this.host = host;
    this.deviceName = deviceName;
    this.cert = cert ?? null;
  }

  get isPowered(): boolean {
    return this._isPowered;
  }
  get currentApp(): string {
    return this._currentApp;
  }
  get volume(): VolumeInfo {
    return this._volume;
  }
  get isReady(): boolean {
    return this._isReady;
  }

  get state(): Omit<DeviceState, "id" | "name" | "model"> {
    return {
      host: this.host,
      isPowered: this._isPowered,
      isAvailable: this._isReady,
      currentApp: this._currentApp,
      volume: { ...this._volume },
      paired: this.cert !== null,
    };
  }

  async startPairing(): Promise<void> {
    this.remote = new AndroidRemote(this.host, {
      pairing_port: 6467,
      remote_port: 6466,
      name: "Magenta Control",
      cert: {},
    });

    this.attachErrorHandler();

    this.remote.on("secret", () => {
      this.emit("secret");
    });

    this.remote.on("unpaired", () => {
      this.emit("unpaired");
    });

    await this.remote.start();
  }

  sendPairingCode(code: string): void {
    if (!this.remote) throw new Error("Pairing not started");
    this.remote.sendCode(code);

    this.remote.on("ready", () => {
      this.cert = this.remote!.getCertificate() as CertPair;
      this._isReady = true;
      this.bindStateEvents();
      this.emit("paired", this.cert);
      this.emit("ready");
    });
  }

  async connect(): Promise<boolean> {
    if (!this.cert) {
      throw new Error("Device not paired — no certificate");
    }

    this.clearReconnectTimer();
    this._shouldReconnect = true;

    // Clean up any previous remote to avoid listener leaks
    if (this.remote) {
      this.cleanupRemote();
    }

    this.remote = new AndroidRemote(this.host, {
      pairing_port: 6467,
      remote_port: 6466,
      name: "Magenta Control",
      cert: this.cert,
    });

    this.attachErrorHandler();

    this.remote.on("unpaired", () => {
      this._isReady = false;
      this.cert = null;
      this._shouldReconnect = false;
      this.clearReconnectTimer();
      this.emit("unpaired");
    });

    this.bindStateEvents();

    this._connecting = true;
    let started = false;
    try {
      started = !!(await this.remote.start());
      if (started) {
        this.reconnectDelay = RECONNECT_INITIAL_MS;
      }
      return started;
    } catch {
      return false;
    } finally {
      this._connecting = false;
      // Only schedule reconnect if start() actually failed.
      // When start() succeeds the "ready" event will fire shortly after
      // and set _isReady = true — we must not kill the connection before that.
      if (!started && !this._isReady) {
        this.scheduleReconnect();
      }
    }
  }

  async reconnect(): Promise<boolean> {
    if (!this.cert || this._connecting) return false;
    this.cleanupRemote();
    try {
      return await this.connect();
    } catch {
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (!this._shouldReconnect || !this.cert) return;
    this.clearReconnectTimer();

    console.log(
      `[ATVRemote] Scheduling reconnect for ${this.deviceName} in ${this.reconnectDelay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this._shouldReconnect || !this.cert) return;

      console.log(`[ATVRemote] Attempting reconnect to ${this.deviceName} (${this.host})`);
      const ok = await this.reconnect();
      if (!ok) {
        this.reconnectDelay = Math.min(
          this.reconnectDelay * RECONNECT_BACKOFF,
          RECONNECT_MAX_MS
        );
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private attachErrorHandler(): void {
    if (!this.remote) return;
    this.remote.on("error", (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(
        `[ATVRemote] Error for ${this.deviceName} (${this.host}):`,
        msg
      );

      const wasReady = this._isReady;
      this._isReady = false;
      if (wasReady) {
        this.emit("state_changed");
      }

      this.emit("error", err);
      if (!this._connecting) {
        this.scheduleReconnect();
      }
    });

    this.remote.on("close", () => {
      console.log(
        `[ATVRemote] Connection closed for ${this.deviceName} (${this.host})`
      );
      const wasReady = this._isReady;
      this._isReady = false;
      if (wasReady) {
        this.emit("state_changed");
      }
      if (!this._connecting) {
        this.scheduleReconnect();
      }
    });
  }

  private bindStateEvents(): void {
    if (!this.remote) return;

    this.remote.on("powered", (powered: boolean) => {
      this._isPowered = powered;
      this.emit("state_changed");
    });

    this.remote.on("volume", (vol: VolumeEvent) => {
      this._volume = {
        level: vol.level,
        max: vol.maximum,
        muted: vol.muted,
      };
      this.emit("state_changed");
    });

    this.remote.on("current_app", (app: string) => {
      this._currentApp = app;
      this.emit("state_changed");
    });

    this.remote.on("ready", () => {
      this._isReady = true;
      this.reconnectDelay = RECONNECT_INITIAL_MS;
      this.clearReconnectTimer();
      this.emit("ready");
      this.emit("state_changed");
    });
  }

  sendKey(
    keyCode: number,
    direction: number = RemoteDirection.SHORT
  ): void {
    if (!this.remote || !this._isReady) {
      throw new Error("Not connected");
    }
    const keyName = RemoteKeyCode[keyCode] ?? keyCode;
    const dirName = RemoteDirection[direction] ?? direction;
    console.log(`[Remote] sendKey ${keyName} (${keyCode}) direction=${dirName} → ${this.deviceName}`);
    this.remote.sendKey(keyCode, direction);
  }

  sendKeyPress(keyCode: number): void {
    if (!this.remote || !this._isReady) {
      throw new Error("Not connected");
    }
    const keyName = RemoteKeyCode[keyCode] ?? keyCode;
    console.log(`[Remote] sendKeyPress ${keyName} (${keyCode}) START_LONG+END_LONG → ${this.deviceName}`);
    this.remote.sendKey(keyCode, RemoteDirection.START_LONG);
    setTimeout(() => {
      if (this.remote && this._isReady) {
        this.remote.sendKey(keyCode, RemoteDirection.END_LONG);
      }
    }, 50);
  }

  sendAppLink(link: string): void {
    if (!this.remote || !this._isReady) {
      throw new Error("Not connected");
    }
    this.remote.sendAppLink(link);
  }

  sendPower(): void {
    if (!this.remote || !this._isReady) {
      throw new Error("Not connected");
    }
    this.remote.sendPower();
  }

  getCertificate(): CertPair | null {
    return this.cert;
  }

  private cleanupRemote(): void {
    this._isReady = false;
    try {
      this.remote?.stop();
    } catch {
      // ignore
    }
    this.remote = null;
  }

  disconnect(): void {
    this._shouldReconnect = false;
    this.clearReconnectTimer();
    this.cleanupRemote();
  }
}
