import { useState } from "react";
import { useDeviceState } from "./hooks/useDeviceState";
import { DeviceCard } from "./components/DeviceCard";
import { DeviceDetail } from "./components/DeviceDetail";
import { AddDeviceDialog } from "./components/AddDeviceDialog";
import { AlexaSettingsDialog } from "./components/AlexaSettingsDialog";
import { ToastProvider } from "./components/Toast";
import { MagentaTVIcon } from "./components/AppIcons";
import type { DeviceState } from "./types";

function AppContent() {
  const { devices, connected } = useDeviceState();
  const [selectedDevice, setSelectedDevice] = useState<DeviceState | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const activeSelected = selectedDevice
    ? devices.find((d) => d.id === selectedDevice.id) ?? null
    : null;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/5 pt-[env(safe-area-inset-top)]">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <MagentaTVIcon className="w-[4.5rem] h-[4.5rem] mb-4 opacity-40" />
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

      {/* Alexa Settings Dialog */}
      <AlexaSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        devices={devices}
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
