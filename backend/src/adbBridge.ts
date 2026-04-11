import { EventEmitter } from "events";

// @ts-ignore no type declarations
import { Adb } from "@devicefarmer/adbkit";

export interface MediaSessionInfo {
  packageName: string;
  playbackState: string;
  title: string;
  artist: string;
  album: string;
}

export class ADBBridge extends EventEmitter {
  private client: ReturnType<typeof Adb.createClient> | null = null;
  private pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private lastInfo = new Map<string, MediaSessionInfo>();

  private getClient(): ReturnType<typeof Adb.createClient> {
    if (!this.client) {
      this.client = Adb.createClient();
    }
    return this.client;
  }

  async connectDevice(host: string): Promise<boolean> {
    try {
      const id = await this.getClient().connect(host, 5555);
      console.log(`[ADB] Connected to ${host}: ${id}`);
      return true;
    } catch (err) {
      console.error(`[ADB] Failed to connect to ${host}:`, err);
      return false;
    }
  }

  startPolling(host: string, intervalMs = 5000): void {
    const deviceId = `${host}:5555`;
    if (this.pollingIntervals.has(host)) return;

    const poll = async () => {
      try {
        const info = await this.getMediaSession(deviceId);
        if (info) {
          const prev = this.lastInfo.get(host);
          const changed =
            !prev ||
            prev.title !== info.title ||
            prev.playbackState !== info.playbackState ||
            prev.packageName !== info.packageName;

          if (changed) {
            this.lastInfo.set(host, info);
            this.emit("media_info", host, info);
          }
        }
      } catch {
        // device may be unreachable
      }
    };

    poll();
    this.pollingIntervals.set(
      host,
      setInterval(poll, intervalMs)
    );
  }

  stopPolling(host: string): void {
    const interval = this.pollingIntervals.get(host);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(host);
    }
  }

  stopAll(): void {
    for (const [host] of this.pollingIntervals) {
      this.stopPolling(host);
    }
  }

  getLastInfo(host: string): MediaSessionInfo | undefined {
    return this.lastInfo.get(host);
  }

  private async getMediaSession(
    deviceId: string
  ): Promise<MediaSessionInfo | null> {
    try {
      const output = await this.shellCommand(
        deviceId,
        "dumpsys media_session"
      );
      return this.parseMediaSession(output);
    } catch {
      return null;
    }
  }

  private async shellCommand(
    deviceId: string,
    command: string
  ): Promise<string> {
    const device = this.getClient().getDevice(deviceId);
    const stream = await device.shell(command);
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      stream.on("error", reject);
    });
  }

  private parseMediaSession(dump: string): MediaSessionInfo | null {
    const lines = dump.split("\n");

    let packageName = "";
    let playbackState = "NONE";
    let title = "";
    let artist = "";
    let album = "";

    // Find active session
    let inActiveSession = false;
    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes("active=true")) {
        inActiveSession = true;
      }

      if (inActiveSession) {
        const pkgMatch = trimmed.match(/package=(\S+)/);
        if (pkgMatch) packageName = pkgMatch[1];

        const stateMatch = trimmed.match(/state=(\d+)/);
        if (stateMatch) {
          const stateCode = parseInt(stateMatch[1]);
          playbackState = this.playbackStateToString(stateCode);
        }

        if (trimmed.startsWith("description=")) {
          const descMatch = trimmed.match(/description=(.+)/);
          if (descMatch) title = descMatch[1].trim();
        }

        const metadataMatch = trimmed.match(
          /android\.media\.metadata\.(\w+)=(.+)/i
        );
        if (metadataMatch) {
          const key = metadataMatch[1].toUpperCase();
          const value = metadataMatch[2].trim();
          if (key === "TITLE") title = value;
          if (key === "ARTIST") artist = value;
          if (key === "ALBUM") album = value;
        }
      }
    }

    if (!packageName && !title) return null;

    return { packageName, playbackState, title, artist, album };
  }

  private playbackStateToString(state: number): string {
    const states: Record<number, string> = {
      0: "NONE",
      1: "STOPPED",
      2: "PAUSED",
      3: "PLAYING",
      4: "FAST_FORWARDING",
      5: "REWINDING",
      6: "BUFFERING",
      7: "ERROR",
      8: "CONNECTING",
      9: "SKIPPING_TO_PREVIOUS",
      10: "SKIPPING_TO_NEXT",
      11: "SKIPPING_TO_QUEUE_ITEM",
    };
    return states[state] ?? `UNKNOWN(${state})`;
  }
}
