import { EventEmitter } from "events";

// @ts-expect-error no type declarations
import { Client as CastClient, DefaultMediaReceiver } from "castv2-client";

export interface CastMediaStatus {
  host: string;
  appName: string;
  title: string;
  artist: string;
  contentType: string;
  playerState: string;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
}

export class CastBridge extends EventEmitter {
  private clients = new Map<string, InstanceType<typeof CastClient>>();
  private pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private lastStatus = new Map<string, CastMediaStatus>();

  connectDevice(host: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.clients.has(host)) {
        resolve(true);
        return;
      }

      const client = new CastClient();
      client.setMaxListeners(30);

      client.connect(host, () => {
        console.log(`[Cast] Connected to ${host}`);
        this.clients.set(host, client);
        resolve(true);
      });

      client.on("error", (err: Error) => {
        console.error(`[Cast] Error for ${host}:`, err.message);
        this.clients.delete(host);
        client.close();
        resolve(false);
      });

      setTimeout(() => {
        if (!this.clients.has(host)) {
          client.close();
          resolve(false);
        }
      }, 5000);
    });
  }

  startPolling(host: string, intervalMs = 5000): void {
    if (this.pollingIntervals.has(host)) return;

    const poll = async () => {
      try {
        const status = await this.getMediaStatus(host);
        if (status) {
          const prev = this.lastStatus.get(host);
          const changed =
            !prev ||
            prev.title !== status.title ||
            prev.playerState !== status.playerState ||
            prev.appName !== status.appName;

          if (changed) {
            this.lastStatus.set(host, status);
            this.emit("cast_status", host, status);
          }
        } else if (this.lastStatus.has(host)) {
          this.lastStatus.delete(host);
        }
      } catch {
        // device may be unreachable
      }
    };

    poll();
    this.pollingIntervals.set(host, setInterval(poll, intervalMs));
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
    for (const client of this.clients.values()) {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }

  getLastStatus(host: string): CastMediaStatus | undefined {
    return this.lastStatus.get(host);
  }

  clearLastStatus(host: string): void {
    this.lastStatus.delete(host);
  }

  private getMediaStatus(host: string): Promise<CastMediaStatus | null> {
    return new Promise((resolve) => {
      const client = this.clients.get(host);
      if (!client) {
        resolve(null);
        return;
      }

      client.getSessions((err: Error | null, sessions: Array<{ appId: string; displayName: string; transportId?: string; sessionId?: string }>) => {
        if (err || !sessions || sessions.length === 0) {
          resolve(null);
          return;
        }

        const session = sessions.find(
          (s) => s.transportId && s.sessionId
        );
        if (!session) {
          resolve(null);
          return;
        }

        try {
          client.join(session, DefaultMediaReceiver, (err2: Error | null, player: {
            getStatus: (cb: (err: Error | null, status: {
              media?: { metadata?: { title?: string; artist?: string }; contentType?: string; duration?: number };
              playerState?: string;
              currentTime?: number;
              volume?: { level?: number; muted?: boolean };
            } | null) => void) => void;
          }) => {
            if (err2) {
              resolve(null);
              return;
            }

            player.getStatus((err3: Error | null, status) => {
              if (err3 || !status) {
                resolve(null);
                return;
              }

              resolve({
                host,
                appName: session.displayName ?? "",
                title: status.media?.metadata?.title ?? "",
                artist: status.media?.metadata?.artist ?? "",
                contentType: status.media?.contentType ?? "",
                playerState: status.playerState ?? "IDLE",
                currentTime: status.currentTime ?? 0,
                duration: status.media?.duration ?? 0,
                volume: status.volume?.level ?? 0,
                muted: status.volume?.muted ?? false,
              });
            });
          });
        } catch (joinErr) {
          console.error(`[Cast] Join error for ${host}:`, joinErr instanceof Error ? joinErr.message : joinErr);
          resolve(null);
        }
      });
    });
  }
}
