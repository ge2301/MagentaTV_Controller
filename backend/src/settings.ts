import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve("data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export interface AlexaSettings {
  enabled: boolean;
  deviceId: string;
  skillId?: string;
  tunnelUrl?: string;
}

interface AppSettings {
  alexa: AlexaSettings;
}

const DEFAULTS: AppSettings = {
  alexa: {
    enabled: false,
    deviceId: "",
  },
};

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): AppSettings {
  if (!existsSync(SETTINGS_FILE)) return structuredClone(DEFAULTS);
  try {
    const raw = readFileSync(SETTINGS_FILE, "utf-8");
    return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(settings: AppSettings): void {
  ensureDataDir();
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function getAlexaSettings(): AlexaSettings {
  return load().alexa;
}

export function saveAlexaSettings(alexa: AlexaSettings): void {
  const settings = load();
  settings.alexa = alexa;
  save(settings);
}
