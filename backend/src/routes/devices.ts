import { Router, type Request, type Response } from "express";
import type { DeviceManager } from "../deviceManager.js";
// @ts-expect-error no type declarations
import { RemoteKeyCode, RemoteDirection } from "androidtv-remote";

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export function createDeviceRoutes(manager: DeviceManager): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.json(manager.getDevices());
  });

  router.get("/:id", (req: Request, res: Response) => {
    const device = manager.getDevice(paramId(req));
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json(device);
  });

  router.post("/add", async (req: Request, res: Response) => {
    const { host, name } = req.body;
    if (!host) {
      res.status(400).json({ error: "host is required" });
      return;
    }
    try {
      const device = await manager.addManualDevice(host, name);
      res.json(device);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/pair/start", async (req: Request, res: Response) => {
    const { host } = req.body;
    if (!host) {
      res.status(400).json({ error: "host is required" });
      return;
    }
    try {
      const id = await manager.startPairing(host);
      res.json({ id, message: "Enter the code shown on your TV" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/pair/finish", async (req: Request, res: Response) => {
    const { host, code } = req.body;
    if (!host || !code) {
      res.status(400).json({ error: "host and code are required" });
      return;
    }
    try {
      const device = await manager.finishPairing(host, code);
      res.json(device);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/:id/key", (req: Request, res: Response) => {
    const { key, direction } = req.body;
    if (!key) {
      res.status(400).json({ error: "key is required" });
      return;
    }

    try {
      const keyCode =
        typeof key === "number"
          ? key
          : RemoteKeyCode[key as keyof typeof RemoteKeyCode] ?? parseInt(key);

      if (isNaN(keyCode)) {
        res.status(400).json({ error: `Unknown key: ${key}` });
        return;
      }

      const dir = direction
        ? RemoteDirection[direction as keyof typeof RemoteDirection] ?? direction
        : RemoteDirection.SHORT;
      manager.sendKey(paramId(req), keyCode, dir);
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/:id/launch", (req: Request, res: Response) => {
    const { appLink } = req.body;
    if (!appLink) {
      res.status(400).json({ error: "appLink is required" });
      return;
    }
    try {
      manager.sendAppLink(paramId(req), appLink);
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/:id/power", async (req: Request, res: Response) => {
    try {
      const result = await manager.sendPower(paramId(req));
      res.json({
        ok: result.ok,
        method: result.method,
        message: result.ok
          ? result.method === "wol"
            ? "Device woken via Wake-on-LAN"
            : "Power toggled"
          : "WOL packet sent but device did not reconnect in time — it may still be waking up",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/:id/adb/enable", async (req: Request, res: Response) => {
    try {
      const device = manager.getDevice(paramId(req));
      if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
      }
      if (!manager.isADBAvailable()) {
        res.json({ ok: false, message: "ADB not available — adb binary not installed on server" });
        return;
      }
      const ok = await manager.enableADB(device.host);
      res.json({ ok, message: ok ? "ADB connected" : "ADB connection failed — is ADB debugging enabled on the device?" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/:id/cast/enable", async (req: Request, res: Response) => {
    try {
      const device = manager.getDevice(paramId(req));
      if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
      }
      const ok = await manager.enableCast(device.host);
      res.json({ ok, message: ok ? "Cast connected" : "Cast connection failed" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.delete("/:id", (req: Request, res: Response) => {
    try {
      manager.removeDevice(paramId(req));
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}

export const KEY_MAP: Record<string, string> = {
  POWER: "KEYCODE_POWER",
  HOME: "KEYCODE_HOME",
  BACK: "KEYCODE_BACK",
  UP: "KEYCODE_DPAD_UP",
  DOWN: "KEYCODE_DPAD_DOWN",
  LEFT: "KEYCODE_DPAD_LEFT",
  RIGHT: "KEYCODE_DPAD_RIGHT",
  CENTER: "KEYCODE_DPAD_CENTER",
  ENTER: "KEYCODE_DPAD_CENTER",
  VOLUME_UP: "KEYCODE_VOLUME_UP",
  VOLUME_DOWN: "KEYCODE_VOLUME_DOWN",
  MUTE: "KEYCODE_VOLUME_MUTE",
  PLAY_PAUSE: "KEYCODE_MEDIA_PLAY_PAUSE",
  PLAY: "KEYCODE_MEDIA_PLAY",
  PAUSE: "KEYCODE_MEDIA_PAUSE",
  STOP: "KEYCODE_MEDIA_STOP",
  NEXT: "KEYCODE_MEDIA_NEXT",
  PREVIOUS: "KEYCODE_MEDIA_PREVIOUS",
  CHANNEL_UP: "KEYCODE_CHANNEL_UP",
  CHANNEL_DOWN: "KEYCODE_CHANNEL_DOWN",
  KEY_0: "KEYCODE_0",
  KEY_1: "KEYCODE_1",
  KEY_2: "KEYCODE_2",
  KEY_3: "KEYCODE_3",
  KEY_4: "KEYCODE_4",
  KEY_5: "KEYCODE_5",
  KEY_6: "KEYCODE_6",
  KEY_7: "KEYCODE_7",
  KEY_8: "KEYCODE_8",
  KEY_9: "KEYCODE_9",
};
