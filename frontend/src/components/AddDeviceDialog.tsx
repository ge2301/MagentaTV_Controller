import { useState } from "react";
import { api } from "../hooks/useApi";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "add" | "pairing" | "pin" | "done" | "error";

export function AddDeviceDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>("add");
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep("add");
    setHost("");
    setName("");
    setPin("");
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = async () => {
    if (!host.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.addDevice(host.trim(), name.trim() || undefined);
      setStep("pairing");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPairing = async () => {
    setLoading(true);
    setError("");
    try {
      await api.startPairing(host.trim());
      setStep("pin");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPin = async () => {
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.finishPairing(host.trim(), pin.trim());
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-elevated rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            {step === "add" && "Add Device"}
            {step === "pairing" && "Pair Device"}
            {step === "pin" && "Enter PIN"}
            {step === "done" && "Device Paired"}
            {step === "error" && "Error"}
          </h2>
          <button
            onClick={handleClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step: Add IP */}
        {step === "add" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/50 mb-1.5">
                IP Address
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/30"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1.5">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Living Room TV"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/30"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={loading || !host.trim()}
              className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-40 text-white font-medium transition-colors"
            >
              {loading ? "Adding..." : "Add Device"}
            </button>
          </div>
        )}

        {/* Step: Start pairing */}
        {step === "pairing" && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              Device added. Start pairing to control it. Make sure the TV is on.
            </p>
            <button
              onClick={handleStartPairing}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-40 text-white font-medium transition-colors"
            >
              {loading ? "Connecting..." : "Start Pairing"}
            </button>
            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-medium transition-colors"
            >
              Pair Later
            </button>
          </div>
        )}

        {/* Step: Enter PIN */}
        {step === "pin" && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              A PIN code is displayed on your TV. Enter it below:
            </p>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.3em] font-mono placeholder-white/20 focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/30"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmitPin()}
            />
            <button
              onClick={handleSubmitPin}
              disabled={loading || !pin.trim()}
              className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-40 text-white font-medium transition-colors"
            >
              {loading ? "Pairing..." : "Confirm"}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <p className="text-white/70">Device paired successfully!</p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 text-white font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
