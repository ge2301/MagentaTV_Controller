import { Router, type Request, type Response } from "express";
import type { DeviceManager } from "../deviceManager.js";
import { getAlexaSettings } from "../settings.js";
// @ts-expect-error no type declarations
import { RemoteKeyCode, RemoteDirection } from "androidtv-remote";

const APP_LINK_MAP: Record<string, string> = {
  netflix: "https://www.netflix.com/title",
  youtube: "https://www.youtube.com",
  "disney plus": "https://www.disneyplus.com",
  "disney+": "https://www.disneyplus.com",
  disney: "https://www.disneyplus.com",
  "prime video": "https://app.primevideo.com",
  prime: "https://app.primevideo.com",
  amazon: "https://app.primevideo.com",
  spotify: "spotify://",
  zdf: "market://launch?id=com.zdf.android.mediathek",
  "zdf mediathek": "market://launch?id=com.zdf.android.mediathek",
  ard: "market://launch?id=de.ard.audiothek",
  "ard mediathek": "market://launch?id=de.ard.audiothek",
  magentatv: "market://launch?id=de.telekom.magentatv.androidtv",
  magenta: "market://launch?id=de.telekom.magentatv.androidtv",
  fernsehen: "market://launch?id=de.telekom.magentatv.androidtv",
  "live tv": "market://launch?id=de.telekom.magentatv.androidtv",
};

const DIRECTION_KEY_MAP: Record<string, string> = {
  oben: "KEYCODE_DPAD_UP",
  hoch: "KEYCODE_DPAD_UP",
  rauf: "KEYCODE_DPAD_UP",
  unten: "KEYCODE_DPAD_DOWN",
  runter: "KEYCODE_DPAD_DOWN",
  links: "KEYCODE_DPAD_LEFT",
  rechts: "KEYCODE_DPAD_RIGHT",
};

const DIGIT_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendDigits(
  manager: DeviceManager,
  deviceId: string,
  digits: string,
): Promise<void> {
  for (let i = 0; i < digits.length; i++) {
    const kc = resolveKeyCode(`KEYCODE_${digits[i]}`);
    if (kc !== null) {
      manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
      if (i < digits.length - 1) await sleep(DIGIT_DELAY_MS);
    }
  }
}

function alexaResponse(speechText: string, endSession = true) {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: speechText },
      shouldEndSession: endSession,
    },
  };
}

function resolveKeyCode(keyName: string): number | null {
  const code = RemoteKeyCode[keyName as keyof typeof RemoteKeyCode];
  return typeof code === "number" ? code : null;
}

export function createAlexaRoutes(manager: DeviceManager): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const settings = getAlexaSettings();

    if (!settings.enabled) {
      res.json(alexaResponse("Alexa-Steuerung ist deaktiviert."));
      return;
    }

    if (!settings.deviceId) {
      res.json(alexaResponse("Kein Gerät für die Alexa-Steuerung konfiguriert."));
      return;
    }

    if (settings.skillId) {
      const appId =
        req.body?.session?.application?.applicationId ??
        req.body?.context?.System?.application?.applicationId;
      if (appId && appId !== settings.skillId) {
        res.status(403).json({ error: "Invalid application ID" });
        return;
      }
    }

    const requestType: string = req.body?.request?.type ?? "";
    const intent = req.body?.request?.intent;
    const deviceId = settings.deviceId;

    if (requestType === "LaunchRequest") {
      res.json(alexaResponse("Magenta Steuerung bereit. Was soll ich tun?", false));
      return;
    }

    if (requestType === "SessionEndedRequest") {
      res.json(alexaResponse(""));
      return;
    }

    if (requestType !== "IntentRequest" || !intent) {
      res.json(alexaResponse("Bis bald!"));
      return;
    }

    try {
      const intentName: string = intent.name;

      switch (intentName) {
        case "LaunchAppIntent": {
          const appSlot = (intent.slots?.appName?.value ?? "").toLowerCase();
          const link = APP_LINK_MAP[appSlot];
          if (!link) {
            res.json(alexaResponse(`Ich kenne die App ${appSlot} nicht.`));
            return;
          }
          manager.sendAppLink(deviceId, link);
          res.json(alexaResponse(`${intent.slots.appName.value} wird gestartet.`));
          return;
        }

        case "ChannelUpIntent": {
          const kc = resolveKeyCode("KEYCODE_DPAD_UP");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Nächster Kanal."));
          return;
        }

        case "ChannelDownIntent": {
          const kc = resolveKeyCode("KEYCODE_DPAD_DOWN");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Vorheriger Kanal."));
          return;
        }

        case "ChannelNumberIntent": {
          const num = intent.slots?.channelNumber?.value;
          if (!num || !/^\d+$/.test(String(num))) {
            res.json(alexaResponse("Ich habe die Kanalnummer nicht verstanden."));
            return;
          }
          await sendDigits(manager, deviceId, String(num));
          res.json(alexaResponse(`Kanal ${num}.`));
          return;
        }

        case "ChannelNameIntent": {
          const name = (intent.slots?.channelName?.value ?? "").toLowerCase().trim();
          if (!name) {
            res.json(alexaResponse("Ich habe den Sendernamen nicht verstanden."));
            return;
          }
          const channelMap = settings.channelMap ?? {};
          const channelNum = channelMap[name];
          if (!channelNum) {
            res.json(alexaResponse(`Ich kenne den Sender ${intent.slots.channelName.value} nicht. Du kannst die Senderliste in den Einstellungen anpassen.`));
            return;
          }
          await sendDigits(manager, deviceId, channelNum);
          res.json(alexaResponse(`${intent.slots.channelName.value}.`));
          return;
        }

        case "VolumeUpIntent": {
          const kc = resolveKeyCode("KEYCODE_VOLUME_UP");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Lauter."));
          return;
        }

        case "VolumeDownIntent": {
          const kc = resolveKeyCode("KEYCODE_VOLUME_DOWN");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Leiser."));
          return;
        }

        case "MuteIntent": {
          const kc = resolveKeyCode("KEYCODE_VOLUME_MUTE");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Stumm geschaltet."));
          return;
        }

        case "PowerIntent": {
          await manager.sendPower(deviceId);
          res.json(alexaResponse("Ein- oder ausgeschaltet."));
          return;
        }

        case "PlayPauseIntent": {
          const kc = resolveKeyCode("KEYCODE_MEDIA_PLAY_PAUSE");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Wiedergabe umgeschaltet."));
          return;
        }

        case "NavigateIntent": {
          const dir = (intent.slots?.direction?.value ?? "").toLowerCase();
          const keyName = DIRECTION_KEY_MAP[dir];
          if (!keyName) {
            res.json(alexaResponse(`Richtung ${dir} nicht erkannt.`));
            return;
          }
          const kc = resolveKeyCode(keyName);
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse(`${dir}.`));
          return;
        }

        case "HomeIntent": {
          const kc = resolveKeyCode("KEYCODE_HOME");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Home."));
          return;
        }

        case "BackIntent": {
          const kc = resolveKeyCode("KEYCODE_BACK");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Zurück."));
          return;
        }

        case "SelectIntent": {
          const kc = resolveKeyCode("KEYCODE_DPAD_CENTER");
          if (kc !== null) manager.sendKey(deviceId, kc, RemoteDirection.SHORT);
          res.json(alexaResponse("Ausgewählt."));
          return;
        }

        case "AMAZON.HelpIntent": {
          res.json(alexaResponse(
            "Du kannst sagen: starte Netflix, Kanal 5, schalte auf ARD, nächster Kanal, lauter, leiser, pause, oder einschalten.",
            false,
          ));
          return;
        }

        case "AMAZON.CancelIntent":
        case "AMAZON.StopIntent": {
          res.json(alexaResponse("Bis bald!"));
          return;
        }

        default:
          res.json(alexaResponse("Das habe ich nicht verstanden."));
      }
    } catch (err) {
      console.error("[Alexa] Intent handling error:", err);
      res.json(alexaResponse("Verbindung zum Gerät fehlgeschlagen."));
    }
  });

  return router;
}
