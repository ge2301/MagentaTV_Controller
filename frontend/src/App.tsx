import { useState } from "react";
import { useDeviceState } from "./hooks/useDeviceState";
import { DeviceCard } from "./components/DeviceCard";
import { DeviceDetail } from "./components/DeviceDetail";
import { AddDeviceDialog } from "./components/AddDeviceDialog";
import { ToastProvider } from "./components/Toast";
import type { DeviceState } from "./types";

function AppContent() {
  const { devices, connected } = useDeviceState();
  const [selectedDevice, setSelectedDevice] = useState<DeviceState | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const activeSelected = selectedDevice
    ? devices.find((d) => d.id === selectedDevice.id) ?? null
    : null;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-magenta-500 to-magenta-700 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-magenta-500/20">
              M
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">
                Magenta Home
              </h1>
              <p className="text-[11px] text-white/30 leading-tight">
                {devices.length} device{devices.length !== 1 ? "s" : ""}
                {" · "}
                <span className={connected ? "text-green-400/60" : "text-red-400/60"}>
                  {connected ? "Connected" : "Reconnecting..."}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddDialog(true)}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
            title="Add Device"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="text-6xl mb-4 opacity-40">📺</div>
            <h2 className="text-xl font-semibold text-white/50 mb-2">
              No Devices Found
            </h2>
            <p className="text-sm text-white/30 mb-6 max-w-xs">
              Devices on your network will appear automatically, or add one manually.
            </p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-5 py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 text-white font-medium transition-colors"
            >
              Add Device
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onSelect={setSelectedDevice}
              />
            ))}
          </div>
        )}
      </main>

      {/* Device Detail Overlay */}
      {activeSelected && (
        <DeviceDetail
          device={activeSelected}
          onClose={() => setSelectedDevice(null)}
        />
      )}

      {/* Add Device Dialog */}
      <AddDeviceDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
