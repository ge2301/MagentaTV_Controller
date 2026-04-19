import type { ReactNode } from "react";
import { api } from "../hooks/useApi";
import { useToast } from "./Toast";
import type { DeviceState } from "../types";
import { APP_LINKS } from "../types";
import { AppIcon, SkipPreviousIcon, PlayIcon, PauseIcon, SkipNextIcon, VolumeUpIcon, VolumeDownIcon, VolumeMuteIcon } from "./AppIcons";

interface Props {
  device: DeviceState;
}

function RemoteButton({
  label,
  keyName,
  deviceId,
  className = "",
  size = "normal",
  onError,
  children,
}: {
  label: string;
  keyName: string;
  deviceId: string;
  className?: string;
  size?: "small" | "normal" | "large";
  onError?: (msg: string) => void;
  children?: ReactNode;
}) {
  const sizeClasses = {
    small: "w-12 h-12 text-sm",
    normal: "w-14 h-14 text-base",
    large: "w-16 h-16 text-lg",
  };

  return (
    <button
      onClick={() =>
        api.sendKey(deviceId, keyName).catch((err: Error) => onError?.(err.message))
      }
      className={`
        ${sizeClasses[size]} rounded-2xl
        bg-white/8 hover:bg-white/15 active:bg-white/20
        text-white/70 hover:text-white
        flex items-center justify-center
        transition-all duration-150
        active:scale-90
        font-medium
        ${className}
      `}
      title={label}
    >
      {children ?? label}
    </button>
  );
}

function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs text-white/30 uppercase tracking-wider font-medium ${className}`}>
      {children}
    </p>
  );
}

export function VirtualRemote({ device }: Props) {
  const id = device.id;
  const toast = useToast();
  const onErr = (msg: string) => toast.show(msg);

  return (
    <div className="space-y-5">
      {/* === TOP ROW: Navigation (left) + Volume/Channels (right) === */}
      <div className="grid grid-cols-2 gap-x-3">
        {/* Navigation */}
        <div className="flex flex-col items-center">
          <SectionLabel className="mb-2">Navigation</SectionLabel>
          <div className="grid grid-cols-3 gap-2 w-fit">
            <div />
            <RemoteButton label="▲" keyName="KEYCODE_DPAD_UP" deviceId={id} onError={onErr} />
            <div />
            <RemoteButton label="◀" keyName="KEYCODE_DPAD_LEFT" deviceId={id} onError={onErr} />
            <RemoteButton
              label="OK"
              keyName="KEYCODE_DPAD_CENTER"
              deviceId={id}
              className="!bg-magenta-500/20 hover:!bg-magenta-500/40 !text-magenta-300"
              onError={onErr}
            />
            <RemoteButton label="▶" keyName="KEYCODE_DPAD_RIGHT" deviceId={id} onError={onErr} />
            <div />
            <RemoteButton label="▼" keyName="KEYCODE_DPAD_DOWN" deviceId={id} onError={onErr} />
            <div />
          </div>
        </div>

        {/* Volume + Channels side by side */}
        <div className="flex flex-col items-center">
          <div className="flex gap-4 w-full">
            <div className="flex-1 flex flex-col items-center">
              <SectionLabel className="mb-2">Volume</SectionLabel>
              <div className="flex flex-col items-center gap-2">
                <RemoteButton label="Volume Up" keyName="KEYCODE_VOLUME_UP" deviceId={id} onError={onErr}>
                  <VolumeUpIcon className="w-6 h-6" />
                </RemoteButton>
                <RemoteButton label="Mute" keyName="KEYCODE_VOLUME_MUTE" deviceId={id} onError={onErr}>
                  <VolumeMuteIcon className="w-6 h-6" />
                </RemoteButton>
                <RemoteButton label="Volume Down" keyName="KEYCODE_VOLUME_DOWN" deviceId={id} onError={onErr}>
                  <VolumeDownIcon className="w-6 h-6" />
                </RemoteButton>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <SectionLabel className="mb-2">Channels</SectionLabel>
              <div className="flex flex-col items-center gap-2">
                <RemoteButton label="▲" keyName="KEYCODE_DPAD_UP" deviceId={id} onError={onErr} />
                <div className="w-14 h-14" />
                <RemoteButton label="▼" keyName="KEYCODE_DPAD_DOWN" deviceId={id} onError={onErr} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MEDIA ROW: centered, full width === */}
      <div className="border-t border-white/10" />
      <div className="flex items-center justify-center gap-3">
        <RemoteButton label="Previous" keyName="KEYCODE_MEDIA_PREVIOUS" deviceId={id} onError={onErr}>
          <SkipPreviousIcon className="w-6 h-6" />
        </RemoteButton>
        <RemoteButton
          label="Play/Pause"
          keyName="KEYCODE_MEDIA_PLAY_PAUSE"
          deviceId={id}
          size="large"
          className="!bg-magenta-500/20 hover:!bg-magenta-500/40 !text-magenta-300"
          onError={onErr}
        >
          {device.media?.playbackState === "PLAYING"
            ? <PauseIcon className="w-7 h-7" />
            : <PlayIcon className="w-7 h-7" />
          }
        </RemoteButton>
        <RemoteButton label="Next" keyName="KEYCODE_MEDIA_NEXT" deviceId={id} onError={onErr}>
          <SkipNextIcon className="w-6 h-6" />
        </RemoteButton>
      </div>
      <div className="border-t border-white/10" />

      {/* === BOTTOM ROW: Number Pad (left) + Apps (right) === */}
      <div className="grid grid-cols-2 gap-x-3">
        {/* Number Pad */}
        <div className="flex flex-col items-center">
          <SectionLabel className="mb-2">Number Pad</SectionLabel>
          <div className="grid grid-cols-3 gap-2 w-fit">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <RemoteButton
                key={n}
                label={String(n)}
                keyName={`KEYCODE_${n}`}
                deviceId={id}
                size="normal"
                onError={onErr}
              />
            ))}
            <div />
            <RemoteButton label="0" keyName="KEYCODE_0" deviceId={id} size="normal" onError={onErr} />
            <div />
          </div>
        </div>

        {/* Apps */}
        <div className="flex flex-col items-center">
          <SectionLabel className="mb-2">Apps</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {APP_LINKS.map((app) => (
              <button
                key={app.label}
                onClick={() =>
                  api.launchApp(id, app.link).catch((err: Error) => onErr(err.message))
                }
                className="
                  w-14 h-14 rounded-2xl
                  bg-white/8 hover:bg-white/15 active:bg-white/20
                  flex items-center justify-center
                  transition-all duration-150 active:scale-90
                "
                title={app.label}
              >
                <AppIcon label={app.label} className={app.label === "Disney+" ? "w-12 h-12" : "w-9 h-9"} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
