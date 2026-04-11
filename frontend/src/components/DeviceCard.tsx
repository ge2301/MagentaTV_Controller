import type { DeviceState } from "../types";
import { getAppLabel, getAppIcon } from "../types";
import { api } from "../hooks/useApi";
import { useToast } from "./Toast";

interface Props {
  device: DeviceState;
  onSelect: (device: DeviceState) => void;
}

export function DeviceCard({ device, onSelect }: Props) {
  const toast = useToast();
  const appLabel = device.currentApp
    ? getAppLabel(device.currentApp)
    : "—";
  const appIcon = device.currentApp ? getAppIcon(device.currentApp) : "";
  const volumePct =
    device.volume.max > 0
      ? Math.round((device.volume.level / device.volume.max) * 100)
      : 0;

  const isOn = device.isPowered && device.isAvailable;
  const needsPairing = !device.paired;

  return (
    <div
      onClick={() => onSelect(device)}
      className={`
        relative rounded-3xl p-5 cursor-pointer select-none
        transition-all duration-300 ease-out
        hover:scale-[1.02] active:scale-[0.98]
        ${
          isOn
            ? "bg-white/10 backdrop-blur-xl shadow-lg shadow-magenta-500/10 ring-1 ring-white/10"
            : "bg-white/5 backdrop-blur-md ring-1 ring-white/5"
        }
      `}
    >
      {/* Status indicator */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">
            {device.model === "manual" ? "📡" : "📺"}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white/90 leading-tight">
              {device.name}
            </h3>
            <p className="text-xs text-white/40 mt-0.5">{device.host}</p>
          </div>
        </div>

        {/* Power indicator */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (device.paired)
              api.togglePower(device.id).catch((err: Error) => toast.show(err.message));
          }}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-300
            ${
              isOn
                ? "bg-magenta-500 shadow-md shadow-magenta-500/40 text-white"
                : "bg-white/10 text-white/30"
            }
          `}
          title={isOn ? "Power Off" : "Power On"}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9"
            />
          </svg>
        </button>
      </div>

      {/* Status section */}
      {needsPairing ? (
        <div className="text-sm text-amber-400/80 font-medium">
          Pairing required
        </div>
      ) : isOn ? (
        <div className="space-y-3">
          {/* Current App */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{appIcon}</span>
            <span className="text-sm font-medium text-white/70">
              {appLabel}
            </span>
          </div>

          {/* Now Playing (from ADB/Cast) */}
          {device.media?.title && (
            <div className="px-2.5 py-2 rounded-xl bg-white/5">
              <p className="text-sm text-white/80 font-medium truncate">
                {device.media.title}
              </p>
              {device.media.artist && (
                <p className="text-xs text-white/40 truncate">
                  {device.media.artist}
                </p>
              )}
              <p className="text-[10px] text-white/25 mt-0.5">
                {device.media.playbackState === "PLAYING"
                  ? "▶ Playing"
                  : device.media.playbackState === "PAUSED"
                    ? "⏸ Paused"
                    : device.media.playbackState}
              </p>
            </div>
          )}

          {/* Volume bar */}
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 ${device.volume.muted ? "text-red-400/60" : "text-white/40"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {device.volume.muted ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.586 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15ZM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 0 1 0 7.072M17.95 6.05a8 8 0 0 1 0 11.9M6.586 15H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.586l4.707-4.707C11.923 3.663 13 4.109 13 5v14c0 .891-1.077 1.337-1.707.707L6.586 15Z"
                />
              )}
            </svg>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  device.volume.muted ? "bg-red-400/40" : "bg-magenta-500/60"
                }`}
                style={{ width: `${volumePct}%` }}
              />
            </div>
            <span className="text-xs text-white/30 min-w-[2rem] text-right">
              {device.volume.level}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-white/30">Off</div>
      )}
    </div>
  );
}
