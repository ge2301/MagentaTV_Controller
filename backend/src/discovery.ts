import { Bonjour, type Service } from "bonjour-service";
import { EventEmitter } from "events";

export interface DiscoveredDevice {
  host: string;
  port: number;
  name: string;
  txt: Record<string, string>;
}

export class Discovery extends EventEmitter {
  private bonjour: Bonjour | null = null;
  private browser: ReturnType<Bonjour["find"]> | null = null;
  private discovered = new Map<string, DiscoveredDevice>();

  start(): void {
    if (this.bonjour) return;

    this.bonjour = new Bonjour();
    this.browser = this.bonjour.find(
      { type: "androidtvremote2", protocol: "tcp" },
      (service: Service) => {
        this.handleService(service);
      }
    );

    console.log("[Discovery] Browsing for _androidtvremote2._tcp.local.");
  }

  stop(): void {
    this.browser?.stop();
    this.bonjour?.destroy();
    this.browser = null;
    this.bonjour = null;
    console.log("[Discovery] Stopped");
  }

  getDiscovered(): DiscoveredDevice[] {
    return Array.from(this.discovered.values());
  }

  private handleService(service: Service): void {
    const addresses = service.addresses ?? [];
    const ipv4 = addresses.find(
      (a: string) => a.includes(".") && !a.startsWith("169.254")
    );
    if (!ipv4) return;

    const device: DiscoveredDevice = {
      host: ipv4,
      port: service.port,
      name: service.name || `Android TV (${ipv4})`,
      txt: (service.txt as Record<string, string>) ?? {},
    };

    if (!this.discovered.has(ipv4)) {
      console.log(`[Discovery] Found device: ${device.name} at ${ipv4}`);
      this.discovered.set(ipv4, device);
      this.emit("device", device);
    }
  }
}
