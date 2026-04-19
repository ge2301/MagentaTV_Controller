import { Router, type Request, type Response } from "express";
import { getAlexaSettings, saveAlexaSettings, type AlexaSettings } from "../settings.js";

export function createSettingsRoutes(): Router {
  const router = Router();

  router.get("/alexa", (_req: Request, res: Response) => {
    res.json(getAlexaSettings());
  });

  router.put("/alexa", (req: Request, res: Response) => {
    const { enabled, deviceId, skillId, tunnelUrl } = req.body;

    if (typeof enabled !== "boolean" || typeof deviceId !== "string") {
      res.status(400).json({ error: "enabled (boolean) and deviceId (string) are required" });
      return;
    }

    const settings: AlexaSettings = {
      enabled,
      deviceId,
      skillId: skillId || undefined,
      tunnelUrl: tunnelUrl || undefined,
    };

    saveAlexaSettings(settings);
    res.json(settings);
  });

  return router;
}
