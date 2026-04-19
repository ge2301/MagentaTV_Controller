import type { DeviceState } from "../types";
import { getAppLabel, getAppEmoji } from "../types";
import { api } from "../hooks/useApi";
import { useToast } from "./Toast";
import { VirtualRemote } from "./VirtualRemote";
import { AppIcon, MagentaTVIcon, BackIcon, HomeIcon, PowerIcon, VolumeUpIcon, VolumeMuteIcon } from "./AppIcons";
import { useState } from "react";

interface Props {
  device: DeviceState;
  onClose: () => void;
}

export function DeviceDetail({ device, onClose }: Props) {
  const [showPairing, setShowPairing] = useState(false);
  const [pairingHost] = useState(device.host);
  const [pin, setPin] = useState("");
  const [pairingStatus, setPairingStatus] = useState<
    "idle" | "waiting" | "entering" | "done" | "error"
  >("idle");
  const [pairingError, setPairingError] = useState("");

  const toast = useToast();

  const appLabel = device.currentApp
    ? getAppLabel(device.currentApp)
    : "—";
  const appEmoji = device.currentApp ? getAppEmoji(device.currentApp) : "";
  const isOn = device.isPowered && device.isAvailable;
  const volumePct =
    device.volume.max > 0
      ? Math.round((device.volume.level / device.volume.max) * 100)
      : 0;

  const handleStartPairing = async () => {
    setShowPairing(true);
    setPairingStatus("waiting");
    setPairingError("");
    try {
      await api.startPairing(pairingHost);
      setPairingStatus("entering");
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : String(err));
      setPairingStatus("error");
    }
  };

  const handleFinishPairing = async () => {
    if (!pin.trim()) return;
    setPairingStatus("waiting");
    try {
      await api.finishPairing(pairingHost, pin.trim());
      setPairingStatus("done");
      setShowPairing(false);
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : String(err));
      setPairingStatus("error");
    }
  };

  const handlePower = async () => {
    try {
      const res = await api.togglePower(device.id);
      if (res.method === "wol") {
        toast.show(res.message, res.ok ? "success" : "error");
      }
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : "Power toggle failed");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-md">
      <div className="w-full h-full sm:h-auto sm:max-w-lg sm:mx-4 sm:my-8 bg-surface sm:rounded-3xl shadow-2xl sm:ring-1 sm:ring-white/10 overflow-hidden flex flex-col sm:block">
        {/* Header */}
        <div className="relative px-4 py-4 pt-[env(safe-area-inset-top)] sm:p-6 sm:pb-4 border-b border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center ${
                isOn
                  ? "bg-magenta-500/20 shadow-lg shadow-magenta-500/10"
                  : "bg-white/5"
              }`}
            >
              <MagentaTVIcon className="w-8 h-8 sm:w-8 sm:h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                {device.name}
              </h2>
              <p className="text-xs sm:text-sm text-white/40">{device.host}</p>
            </div>
          </div>

          {/* Quick status */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  isOn ? "bg-green-400 shadow shadow-green-400/50" : "bg-white/20"
                }`}
              />
              <span className="text-white/50">
                {isOn ? "On" : device.isAvailable ? "Standby" : "Offline"}
              </span>
            </div>
            {isOn && (
              <>
                <div className="flex items-center gap-1.5">
                  <AppIcon label={appLabel} fallbackEmoji={appEmoji} className="w-4 h-4 shrink-0" />
                  <span className="text-white/50">{appLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {device.volume.muted
                    ? <VolumeMuteIcon className="w-4 h-4 text-white/30 shrink-0" />
                    : <VolumeUpIcon className="w-4 h-4 text-white/30 shrink-0" />
                  }
                  <span className="text-white/50">
                    {device.volume.muted ? "Muted" : `${volumePct}%`}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Back / Home / Power row */}
          {device.paired && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() =>
                  api.sendKey(device.id, "KEYCODE_BACK").catch((err: Error) => toast.show(err.message))
                }
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 active:bg-white/20 text-white/70 hover:text-white text-sm font-medium transition-all active:scale-95"
              >
                <BackIcon className="w-5 h-5" /> Back
              </button>
              <button
                onClick={() =>
                  api.sendKey(device.id, "KEYCODE_HOME").catch((err: Error) => toast.show(err.message))
                }
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 active:bg-white/20 text-white/70 hover:text-white text-sm font-medium transition-all active:scale-95"
              >
                <HomeIcon className="w-5 h-5" /> Home
              </button>
              <div className="flex-1" />
              <button
                onClick={handlePower}
                className={`
                  flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all
                  ${
                    isOn
                      ? "bg-red-500/15 hover:bg-red-500/25 text-red-400 ring-1 ring-red-500/20"
                      : "bg-green-500/15 hover:bg-green-500/25 text-green-400 ring-1 ring-green-500/20"
                  }
                `}
              >
                <PowerIcon className="w-5 h-5" />
                {isOn ? "Turn Off" : "Turn On"}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1">
          {!device.paired ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl opacity-40">🔐</div>
              <p className="text-white/50">This device needs to be paired before you can control it.</p>

              {!showPairing ? (
                <button
                  onClick={handleStartPairing}
                  className="px-6 py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 text-white font-medium transition-colors"
                >
                  Start Pairing
                </button>
              ) : (
                <div className="max-w-xs mx-auto space-y-3">
                  {pairingStatus === "waiting" && (
                    <p className="text-white/40 text-sm">Connecting to TV...</p>
                  )}
                  {pairingStatus === "entering" && (
                    <>
                      <p className="text-white/60 text-sm">
                        Enter the PIN shown on your TV:
                      </p>
                      <input
                        type="text"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.3em] font-mono placeholder-white/20 focus:outline-none focus:border-magenta-500/50"
                        autoFocus
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleFinishPairing()
                        }
                      />
                      <button
                        onClick={handleFinishPairing}
                        disabled={!pin.trim()}
                        className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-40 text-white font-medium transition-colors"
                      >
                        Confirm
                      </button>
                    </>
                  )}
                  {pairingStatus === "error" && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {pairingError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Now Playing */}
              {device.media?.title && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-2xl bg-white/5 ring-1 ring-white/5">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-2 font-medium">
                    Now Playing
                  </p>
                  <p className="text-base text-white/90 font-semibold">
                    {device.media.title}
                  </p>
                  {device.media.artist && (
                    <p className="text-sm text-white/50 mt-0.5">
                      {device.media.artist}
                    </p>
                  )}
                  {device.media.album && (
                    <p className="text-xs text-white/30 mt-0.5">
                      {device.media.album}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
                    <span
                      className={
                        device.media.playbackState === "PLAYING"
                          ? "text-green-400"
                          : ""
                      }
                    >
                      {device.media.playbackState === "PLAYING"
                        ? "▶ Playing"
                        : device.media.playbackState === "PAUSED"
                          ? "⏸ Paused"
                          : device.media.playbackState}
                    </span>
                    <span className="text-white/20">
                      via {device.media.source === "adb" ? "ADB" : "Cast"}
                    </span>
                  </div>
                </div>
              )}

              {/* Remote Controls */}
              <VirtualRemote device={device} />

              {/* Enhanced Metadata */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
                  Enhanced Metadata
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/devices/${device.id}/adb/enable`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                        });
                        const data = await res.json();
                        toast.show(data.message ?? (data.ok ? "ADB enabled" : "ADB failed"), data.ok ? "success" : "error");
                      } catch (err) {
                        toast.show(err instanceof Error ? err.message : "ADB connection failed");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm transition-all"
                  >
                    Enable ADB
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/devices/${device.id}/cast/enable`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                        });
                        const data = await res.json();
                        toast.show(data.message ?? (data.ok ? "Cast enabled" : "Cast failed"), data.ok ? "success" : "error");
                      } catch (err) {
                        toast.show(err instanceof Error ? err.message : "Cast connection failed");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm transition-all"
                  >
                    Enable Cast
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
