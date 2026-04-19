export interface VolumeInfo {
  level: number;
  max: number;
  muted: boolean;
}

export interface MediaMetadata {
  title: string;
  artist: string;
  album: string;
  playbackState: string;
  source: "adb" | "cast";
}

export interface DeviceState {
  id: string;
  name: string;
  host: string;
  isPowered: boolean;
  isAvailable: boolean;
  currentApp: string;
  volume: VolumeInfo;
  paired: boolean;
  model?: string;
  media?: MediaMetadata;
}

export interface PersistedDevice {
  id: string;
  name: string;
  host: string;
  manuallyAdded: boolean;
  cert?: string;
  key?: string;
  mac?: string;
}

export type WSMessageType =
  | "device:discovered"
  | "device:state"
  | "device:removed"
  | "device:pairing_required"
  | "device:pairing_started"
  | "device:paired"
  | "device:error"
  | "devices:list";

export interface WSMessage {
  type: WSMessageType;
  deviceId?: string;
  payload: unknown;
}

export interface SendKeyRequest {
  key: string;
  direction?: "SHORT" | "START_LONG" | "END_LONG";
}

export interface LaunchAppRequest {
  appLink: string;
}

export interface PairStartRequest {
  host: string;
  name?: string;
}

export interface PairFinishRequest {
  host: string;
  code: string;
}

export const APP_LABELS: Record<string, string> = {
  "de.telekom.magentatv.androidtv": "MagentaTV",
  "de.telekom.magentatv.mobile": "MagentaTV",
  "de.telekom.magentatv": "MagentaTV",
  "com.google.android.tvlauncher": "Home",
  "com.google.android.apps.tv.launcherx": "Google TV",
  "com.netflix.ninja": "Netflix",
  "com.google.android.youtube.tv": "YouTube",
  "com.disney.disneyplus": "Disney+",
  "com.amazon.amazonvideo.livingroom": "Prime Video",
  "com.apple.atve.androidtv.appletv": "Apple TV+",
  "de.zdf.android.mediathek": "ZDF",
  "de.ard.audiothek": "ARD",
  "com.dazn": "DAZN",
  "com.spotify.tv.android": "Spotify",
  "com.plexapp.android": "Plex",
  "org.xbmc.kodi": "Kodi",
};
