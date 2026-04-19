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

export interface WSMessage {
  type: string;
  deviceId?: string;
  payload: unknown;
}

export const APP_LABELS: Record<string, string> = {
  "de.telekom.magentatv.androidtv": "MagentaTV",
  "de.telekom.magentatv.mobile": "MagentaTV",
  "de.telekom.magentatv": "MagentaTV",
  "com.google.android.tvlauncher": "Home",
  "com.google.android.apps.tv.launcherx": "Google TV",
  "com.google.android.tvrecommendations": "Home",
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

/** Emoji fallbacks for apps that don't have an SVG icon */
export const APP_EMOJI_FALLBACK: Record<string, string> = {
  Home: "🏠",
  "Google TV": "📱",
  "Apple TV+": "🍎",
  DAZN: "⚽",
  Plex: "🎞️",
  Kodi: "🎞️",
};

export function getAppLabel(packageName: string): string {
  return APP_LABELS[packageName] ?? packageName.split(".").pop() ?? packageName;
}

export function getAppEmoji(packageName: string): string {
  const label = getAppLabel(packageName);
  return APP_EMOJI_FALLBACK[label] ?? "📦";
}

export const APP_LINKS = [
  { label: "MagentaTV", link: "market://launch?id=de.telekom.magentatv.androidtv" },
  { label: "Netflix", link: "https://www.netflix.com/title" },
  { label: "YouTube", link: "https://www.youtube.com" },
  { label: "Disney+", link: "https://www.disneyplus.com" },
  { label: "Prime Video", link: "https://app.primevideo.com" },
  { label: "Spotify", link: "spotify://" },
  { label: "ZDF", link: "market://launch?id=com.zdf.android.mediathek" },
  { label: "ARD", link: "market://launch?id=de.ard.audiothek" },
] as const;
