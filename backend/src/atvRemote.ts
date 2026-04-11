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

export class ATVConnection extends EventEmitter {
  private remote: InstanceType<typeof AndroidRemote> | null = null;
  private _isPowered = false;
  private _currentApp = "";
  private _volume: VolumeInfo = { level: 0, max: 15, muted: false };
  private _isReady = false;
  private cert: CertPair | null;
  private host: string;
  private deviceName: string;

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
      this.emit("unpaired");
    });

    this.bindStateEvents();

    const started = await this.remote.start();
    return !!started;
  }

  private attachErrorHandler(): void {
    if (!this.remote) return;
    this.remote.on("error", (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(
        `[ATVRemote] Error for ${this.deviceName} (${this.host}):`,
        msg
      );
      this.emit("error", err);
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
      this.emit("ready");
      this.emit("state_changed");
    });
  }

  sendKey(
    keyCode: number,
    direction: string = "SHORT"
  ): void {
    if (!this.remote || !this._isReady) {
      throw new Error("Not connected");
    }
    this.remote.sendKey(keyCode, direction);
  }

  sendAppLink(link: string): void {
    if (!this.remote || !this._isReady) {
      throw new Error("Not connected");
    }
    this.remote.sendAppLink(link);
  }

  sendPower(): void {
    if (!this.remote) {
      throw new Error("Not connected");
    }
    this.remote.sendPower();
  }

  getCertificate(): CertPair | null {
    return this.cert;
  }

  disconnect(): void {
    this._isReady = false;
    try {
      this.remote?.stop();
    } catch {
      // ignore
    }
    this.remote = null;
  }
}
