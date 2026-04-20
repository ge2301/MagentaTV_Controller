import { Router, type Request, type Response } from "express";
import {
  getAlexaSettings,
  saveAlexaSettings,
  getDefaultChannelMap,
  type AlexaSettings,
} from "../settings.js";

export function createSettingsRoutes(): Router {
  const router = Router();

  router.get("/alexa", (_req: Request, res: Response) => {
    res.json(getAlexaSettings());
  });

  router.put("/alexa", (req: Request, res: Response) => {
    const { enabled, deviceId, skillId, tunnelUrl, channelMap } = req.body;

    if (typeof enabled !== "boolean" || typeof deviceId !== "string") {
      res.status(400).json({ error: "enabled (boolean) and deviceId (string) are required" });
      return;
    }

    const current = getAlexaSettings();
    const settings: AlexaSettings = {
      enabled,
      deviceId,
      skillId: skillId || undefined,
      tunnelUrl: tunnelUrl || undefined,
      channelMap: channelMap ?? current.channelMap,
    };

    saveAlexaSettings(settings);
    res.json(settings);
  });

  router.get("/alexa/channels/defaults", (_req: Request, res: Response) => {
    res.json(getDefaultChannelMap());
  });

  return router;
}
