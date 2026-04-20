import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve("data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export interface AlexaSettings {
  enabled: boolean;
  deviceId: string;
  skillId?: string;
  tunnelUrl?: string;
  channelMap?: Record<string, string>;
}

interface AppSettings {
  alexa: AlexaSettings;
}

const DEFAULT_CHANNEL_MAP: Record<string, string> = {
  "das erste": "1",
  "ard": "1",
  "zdf": "2",
  "rtl": "3",
  "sat 1": "4",
  "sat eins": "4",
  "pro 7": "5",
  "pro sieben": "5",
  "vox": "6",
  "rtl 2": "7",
  "rtl zwei": "7",
  "kabel eins": "8",
  "kabel 1": "8",
  "arte": "9",
  "3sat": "10",
  "wdr": "11",
  "ndr": "12",
  "br": "13",
  "hr": "14",
  "mdr": "15",
  "swr": "16",
  "rbb": "17",
  "phoenix": "18",
  "tagesschau 24": "19",
  "n tv": "20",
  "n-tv": "20",
  "welt": "21",
  "sport 1": "22",
  "sport eins": "22",
  "super rtl": "23",
  "kika": "24",
  "ki ka": "24",
  "tele 5": "25",
  "tele fünf": "25",
  "dmax": "26",
  "nitro": "27",
  "rtl nitro": "27",
  "sixx": "28",
  "pro sieben maxx": "29",
  "pro 7 maxx": "29",
  "sat 1 gold": "30",
  "disney channel": "31",
  "comedy central": "32",
  "zdf neo": "33",
  "zdf info": "34",
  "one": "35",
};

const DEFAULTS: AppSettings = {
  alexa: {
    enabled: false,
    deviceId: "",
    channelMap: DEFAULT_CHANNEL_MAP,
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
  const alexa = load().alexa;
  if (!alexa.channelMap) alexa.channelMap = DEFAULT_CHANNEL_MAP;
  return alexa;
}

export function saveAlexaSettings(alexa: AlexaSettings): void {
  const settings = load();
  settings.alexa = alexa;
  save(settings);
}

export function getDefaultChannelMap(): Record<string, string> {
  return structuredClone(DEFAULT_CHANNEL_MAP);
}
