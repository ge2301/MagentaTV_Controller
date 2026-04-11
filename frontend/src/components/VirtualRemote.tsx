import { api } from "../hooks/useApi";
import { useToast } from "./Toast";
import type { DeviceState } from "../types";
import { APP_LINKS } from "../types";

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
}: {
  label: string;
  keyName: string;
  deviceId: string;
  className?: string;
  size?: "small" | "normal" | "large";
  onError?: (msg: string) => void;
}) {
  const sizeClasses = {
    small: "w-10 h-10 text-xs",
    normal: "w-12 h-12 text-sm",
    large: "w-14 h-14 text-base",
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
      {label}
    </button>
  );
}

export function VirtualRemote({ device }: Props) {
  const id = device.id;
  const toast = useToast();
  const onErr = (msg: string) => toast.show(msg);

  return (
    <div className="space-y-6">
      {/* D-Pad */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
          Navigation
        </p>
        <div className="grid grid-cols-3 gap-1.5 w-fit">
          <div />
          <RemoteButton label="▲" keyName="KEYCODE_DPAD_UP" deviceId={id} size="large" onError={onErr} />
          <div />
          <RemoteButton label="◀" keyName="KEYCODE_DPAD_LEFT" deviceId={id} size="large" onError={onErr} />
          <RemoteButton
            label="OK"
            keyName="KEYCODE_DPAD_CENTER"
            deviceId={id}
            size="large"
            className="!bg-magenta-500/20 hover:!bg-magenta-500/40 !text-magenta-300"
            onError={onErr}
          />
          <RemoteButton label="▶" keyName="KEYCODE_DPAD_RIGHT" deviceId={id} size="large" onError={onErr} />
          <div />
          <RemoteButton label="▼" keyName="KEYCODE_DPAD_DOWN" deviceId={id} size="large" onError={onErr} />
          <div />
        </div>
      </div>

      {/* Back / Home */}
      <div className="flex justify-center gap-3">
        <RemoteButton label="← Back" keyName="KEYCODE_BACK" deviceId={id} className="!w-auto px-5" onError={onErr} />
        <RemoteButton label="⌂ Home" keyName="KEYCODE_HOME" deviceId={id} className="!w-auto px-5" onError={onErr} />
      </div>

      {/* Media Transport */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
          Media
        </p>
        <div className="flex items-center gap-2">
          <RemoteButton label="⏮" keyName="KEYCODE_MEDIA_PREVIOUS" deviceId={id} onError={onErr} />
          <RemoteButton label="⏪" keyName="KEYCODE_MEDIA_REWIND" deviceId={id} onError={onErr} />
          <RemoteButton
            label="⏯"
            keyName="KEYCODE_MEDIA_PLAY_PAUSE"
            deviceId={id}
            size="large"
            className="!bg-magenta-500/20 hover:!bg-magenta-500/40 !text-magenta-300"
            onError={onErr}
          />
          <RemoteButton label="⏩" keyName="KEYCODE_MEDIA_FAST_FORWARD" deviceId={id} onError={onErr} />
          <RemoteButton label="⏭" keyName="KEYCODE_MEDIA_NEXT" deviceId={id} onError={onErr} />
        </div>
      </div>

      {/* Volume & Channel */}
      <div className="flex justify-center gap-8">
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs text-white/30 uppercase tracking-wider mb-1 font-medium">
            Volume
          </p>
          <RemoteButton label="+" keyName="KEYCODE_VOLUME_UP" deviceId={id} onError={onErr} />
          <RemoteButton label="🔇" keyName="KEYCODE_VOLUME_MUTE" deviceId={id} size="small" onError={onErr} />
          <RemoteButton label="−" keyName="KEYCODE_VOLUME_DOWN" deviceId={id} onError={onErr} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs text-white/30 uppercase tracking-wider mb-1 font-medium">
            Channel
          </p>
          <RemoteButton label="▲" keyName="KEYCODE_CHANNEL_UP" deviceId={id} onError={onErr} />
          <div className="w-10 h-10" />
          <RemoteButton label="▼" keyName="KEYCODE_CHANNEL_DOWN" deviceId={id} onError={onErr} />
        </div>
      </div>

      {/* Number Pad */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
          Number Pad
        </p>
        <div className="grid grid-cols-3 gap-1.5 w-fit">
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

      {/* App Launchers */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
          Apps
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {APP_LINKS.map((app) => (
            <button
              key={app.label}
              onClick={() =>
                api.launchApp(id, app.link).catch((err: Error) => onErr(err.message))
              }
              className="
                flex items-center gap-1.5 px-3 py-2 rounded-xl
                bg-white/8 hover:bg-white/15 active:bg-white/20
                text-white/70 hover:text-white text-sm
                transition-all duration-150 active:scale-95
              "
            >
              <span>{app.icon}</span>
              <span>{app.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
