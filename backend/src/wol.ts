import { createSocket } from "dgram";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function createMagicPacket(mac: string): Buffer {
  const normalized = mac.replace(/[:-]/g, "");
  if (normalized.length !== 12 || /[^0-9a-fA-F]/.test(normalized)) {
    throw new Error(`Malformed MAC address: ${mac}`);
  }

  const macBytes = Buffer.alloc(6);
  for (let i = 0; i < 6; i++) {
    macBytes[i] = parseInt(normalized.substr(i * 2, 2), 16);
  }

  // Magic packet: 6 bytes of 0xFF followed by 16 repetitions of the MAC
  const packet = Buffer.alloc(6 + 16 * 6);
  for (let i = 0; i < 6; i++) packet[i] = 0xff;
  for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6);

  return packet;
}

/**
 * Resolve a device IP to its MAC address using the OS ARP table.
 * Returns null if the MAC cannot be determined.
 */
export async function resolveMAC(host: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`arp -a ${host}`);

    // Windows:  192.168.1.10  aa-bb-cc-dd-ee-ff  dynamic
    // Linux:    ? (192.168.1.10) at aa:bb:cc:dd:ee:ff [ether] on eth0
    // macOS:    ? (192.168.1.10) at aa:bb:cc:dd:ee:ff on en0
    const macRegex = /([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i;
    const match = stdout.match(macRegex);
    if (match) {
      return match[0].replace(/-/g, ":").toLowerCase();
    }
  } catch {
    // ARP lookup failed — device might be unreachable
  }
  return null;
}

/**
 * Pre-populate the ARP table by pinging the host once.
 */
export async function pingHost(host: string): Promise<void> {
  const isWin = process.platform === "win32";
  const cmd = isWin ? `ping -n 1 -w 1000 ${host}` : `ping -c 1 -W 1 ${host}`;
  try {
    await execAsync(cmd);
  } catch {
    // Ping may fail if device is off — expected
  }
}

/**
 * Derive the subnet-directed broadcast address from a device IP.
 * Assumes /24 subnet (e.g., 192.168.178.x → 192.168.178.255).
 */
function subnetBroadcast(host: string): string {
  const parts = host.split(".");
  if (parts.length === 4) {
    parts[3] = "255";
    return parts.join(".");
  }
  return "255.255.255.255";
}

function sendSingleWOL(
  packet: Buffer,
  port: number,
  address: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    socket.once("error", (err) => {
      console.error(`[WOL] Socket error for ${address}:${port}:`, err.message);
      socket.close();
      resolve(false);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, port, address, (err) => {
        socket.close();
        resolve(!err);
      });
    });
  });
}

/**
 * Send Wake-on-LAN magic packets to the given MAC address.
 * Sends multiple packets to both global and subnet broadcast on ports 7 and 9
 * for maximum reliability.
 */
export async function sendWOL(
  mac: string,
  deviceHost?: string
): Promise<boolean> {
  try {
    const packet = createMagicPacket(mac);
    const addresses = ["255.255.255.255"];
    if (deviceHost) {
      const sub = subnetBroadcast(deviceHost);
      if (sub !== "255.255.255.255") addresses.push(sub);
    }

    const ports = [9, 7];
    const WOL_SEND_ROUNDS = 3;
    let anySent = false;

    for (let round = 0; round < WOL_SEND_ROUNDS; round++) {
      for (const addr of addresses) {
        for (const port of ports) {
          const ok = await sendSingleWOL(packet, port, addr);
          if (ok) anySent = true;
        }
      }
      if (round < WOL_SEND_ROUNDS - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (anySent) {
      console.log(
        `[WOL] Magic packets sent to ${mac} via ${addresses.join(", ")}`
      );
    }
    return anySent;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[WOL] Failed to create magic packet for ${mac}:`, msg);
    return false;
  }
}

/**
 * Attempt to wake a device: resolve its MAC (or use a cached one),
 * then send the WOL packet. Returns the MAC used, or null on failure.
 */
export async function wakeDevice(
  host: string,
  cachedMAC?: string
): Promise<string | null> {
  let mac: string | undefined = cachedMAC;

  if (!mac) {
    await pingHost(host);
    mac = (await resolveMAC(host)) ?? undefined;
  }

  if (!mac) {
    console.warn(`[WOL] Could not resolve MAC for ${host}`);
    return null;
  }

  const ok = await sendWOL(mac, host);
  return ok ? mac : null;
}
