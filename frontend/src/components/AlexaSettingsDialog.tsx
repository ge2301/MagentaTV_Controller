import { useState, useEffect } from "react";
import { api } from "../hooks/useApi";
import { useToast } from "./Toast";
import type { DeviceState } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  devices: DeviceState[];
}

const INTERACTION_MODEL = JSON.stringify(
  {
    interactionModel: {
      languageModel: {
        invocationName: "magenta",
        intents: [
          {
            name: "LaunchAppIntent",
            slots: [{ name: "appName", type: "APP_NAME" }],
            samples: [
              "starte {appName}",
              "öffne {appName}",
              "mach {appName} an",
              "{appName} starten",
              "wechsle zu {appName}",
            ],
          },
          {
            name: "ChannelUpIntent",
            samples: [
              "nächster kanal",
              "kanal hoch",
              "umschalten",
              "kanal weiter",
            ],
          },
          {
            name: "ChannelDownIntent",
            samples: [
              "vorheriger kanal",
              "kanal runter",
              "kanal zurück",
            ],
          },
          {
            name: "VolumeUpIntent",
            samples: ["lauter", "lautstärke hoch", "ton lauter"],
          },
          {
            name: "VolumeDownIntent",
            samples: ["leiser", "lautstärke runter", "ton leiser"],
          },
          {
            name: "MuteIntent",
            samples: ["stumm", "stumm schalten", "ton aus", "mute"],
          },
          {
            name: "PowerIntent",
            samples: [
              "einschalten",
              "ausschalten",
              "an machen",
              "aus machen",
            ],
          },
          {
            name: "PlayPauseIntent",
            samples: [
              "pause",
              "abspielen",
              "play",
              "weiter",
              "anhalten",
            ],
          },
          {
            name: "NavigateIntent",
            slots: [{ name: "direction", type: "DIRECTION" }],
            samples: [
              "gehe nach {direction}",
              "navigiere {direction}",
              "{direction}",
              "drücke {direction}",
            ],
          },
          {
            name: "HomeIntent",
            samples: [
              "home",
              "startseite",
              "hauptmenü",
              "zurück zum start",
            ],
          },
          {
            name: "BackIntent",
            samples: ["zurück", "geh zurück", "back"],
          },
          {
            name: "ChannelNumberIntent",
            slots: [{ name: "channelNumber", type: "AMAZON.NUMBER" }],
            samples: [
              "kanal {channelNumber}",
              "programm {channelNumber}",
              "wechsle auf kanal {channelNumber}",
              "schalte auf {channelNumber}",
              "sender {channelNumber}",
            ],
          },
          {
            name: "ChannelNameIntent",
            slots: [{ name: "channelName", type: "AMAZON.SearchQuery" }],
            samples: [
              "schalte auf {channelName}",
              "wechsle auf {channelName}",
              "zeige {channelName}",
              "schalte um auf {channelName}",
              "ich möchte {channelName}",
              "mach an {channelName}",
            ],
          },
          {
            name: "SelectIntent",
            samples: [
              "auswählen",
              "bestätigen",
              "ok",
              "enter",
              "drücke ok",
            ],
          },
          { name: "AMAZON.HelpIntent", samples: [] },
          { name: "AMAZON.CancelIntent", samples: [] },
          { name: "AMAZON.StopIntent", samples: [] },
        ],
        types: [
          {
            name: "APP_NAME",
            values: [
              { name: { value: "Netflix" } },
              { name: { value: "YouTube" } },
              {
                name: {
                  value: "Disney Plus",
                  synonyms: ["Disney+", "Disney"],
                },
              },
              {
                name: {
                  value: "Prime Video",
                  synonyms: ["Amazon", "Prime"],
                },
              },
              { name: { value: "Spotify" } },
              {
                name: {
                  value: "ZDF",
                  synonyms: ["ZDF Mediathek"],
                },
              },
              {
                name: {
                  value: "ARD",
                  synonyms: ["ARD Mediathek"],
                },
              },
              {
                name: {
                  value: "MagentaTV",
                  synonyms: ["Magenta", "Fernsehen", "Live TV"],
                },
              },
            ],
          },
          {
            name: "DIRECTION",
            values: [
              {
                name: { value: "oben", synonyms: ["hoch", "rauf"] },
              },
              {
                name: { value: "unten", synonyms: ["runter"] },
              },
              { name: { value: "links" } },
              { name: { value: "rechts" } },
            ],
          },
        ],
      },
    },
  },
  null,
  2,
);

type Tab = "config" | "channels" | "guide";

export function AlexaSettingsDialog({ open, onClose, devices }: Props) {
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("config");
  const [enabled, setEnabled] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});
  const [newChName, setNewChName] = useState("");
  const [newChNum, setNewChNum] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .getAlexaSettings()
      .then((s) => {
        setEnabled(s.enabled);
        setDeviceId(s.deviceId);
        setSkillId(s.skillId ?? "");
        setTunnelUrl(s.tunnelUrl ?? "");
        setChannelMap(s.channelMap ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const pairedDevices = devices.filter((d) => d.paired);
  const endpointUrl = tunnelUrl
    ? `${tunnelUrl.replace(/\/+$/, "")}/api/alexa`
    : "https://<your-tunnel>/api/alexa";

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveAlexaSettings({
        enabled,
        deviceId,
        skillId: skillId || undefined,
        tunnelUrl: tunnelUrl || undefined,
        channelMap,
      });
      toast.show("Alexa settings saved", "success");
      onClose();
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddChannel = () => {
    const name = newChName.trim().toLowerCase();
    const num = newChNum.trim();
    if (!name || !num || !/^\d+$/.test(num)) return;
    setChannelMap((prev) => ({ ...prev, [name]: num }));
    setNewChName("");
    setNewChNum("");
  };

  const handleRemoveChannel = (name: string) => {
    setChannelMap((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleResetChannels = async () => {
    try {
      const defaults = await api.getDefaultChannelMap();
      setChannelMap(defaults);
      toast.show("Channel map reset to defaults", "info");
    } catch {
      toast.show("Failed to load defaults");
    }
  };

  const handleCopyModel = async () => {
    try {
      await navigator.clipboard.writeText(INTERACTION_MODEL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show("Copy failed — please select and copy manually");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-elevated rounded-2xl w-full max-w-lg mx-4 shadow-2xl ring-1 ring-white/10 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00CAFF]/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#00CAFF]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v-2h-2v2zm1-10c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 .88-.58 1.27-1.29 1.8C11.88 12.43 11 13.14 11 15h2c0-1.08.58-1.47 1.29-2C15.12 12.37 16 11.67 16 10c0-2.21-1.79-4-4-4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Alexa Voice Control</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mt-4 p-1 rounded-xl bg-white/5 shrink-0">
          {(["config", "channels", "guide"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === t
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "config" ? "Config" : t === "channels" ? "Channels" : "Guide"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-white/40 text-sm text-center py-8">Loading...</p>
          ) : tab === "config" ? (
            <div className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Enable Alexa Control</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Activates the /api/alexa endpoint
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enabled ? "bg-[#00CAFF]" : "bg-white/15"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Device selector */}
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  Target Device
                </label>
                {pairedDevices.length === 0 ? (
                  <p className="text-xs text-white/30 italic">
                    No paired devices found. Pair a device first.
                  </p>
                ) : (
                  <select
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/30 appearance-none"
                  >
                    <option value="" className="bg-zinc-900">
                      Select a device...
                    </option>
                    {pairedDevices.map((d) => (
                      <option key={d.id} value={d.id} className="bg-zinc-900">
                        {d.name} ({d.host})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tunnel URL */}
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  Tunnel URL
                </label>
                <input
                  type="url"
                  value={tunnelUrl}
                  onChange={(e) => setTunnelUrl(e.target.value)}
                  placeholder="https://your-tunnel.ngrok-free.app"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/30"
                />
                <p className="text-xs text-white/30 mt-1">
                  ngrok or Cloudflare Tunnel URL pointing to your backend
                </p>
              </div>

              {/* Skill ID */}
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  Alexa Skill ID <span className="text-white/20">(optional)</span>
                </label>
                <input
                  type="text"
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  placeholder="amzn1.ask.skill.xxxx-xxxx-xxxx"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/30"
                />
                <p className="text-xs text-white/30 mt-1">
                  For request validation — found in the Alexa Developer Console
                </p>
              </div>

              {/* Endpoint display */}
              {tunnelUrl && (
                <div className="p-3 rounded-xl bg-white/5 ring-1 ring-white/5">
                  <p className="text-xs text-white/40 mb-1 font-medium">
                    Skill Endpoint URL
                  </p>
                  <code className="text-sm text-[#00CAFF] break-all">
                    {endpointUrl}
                  </code>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-40 text-white font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          ) : tab === "channels" ? (
            /* Channels Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/50">
                  {Object.keys(channelMap).length} Sender konfiguriert
                </p>
                <button
                  onClick={handleResetChannels}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/40 hover:text-white/60 transition-all"
                >
                  Reset to Defaults
                </button>
              </div>

              {/* Add new channel */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChName}
                  onChange={(e) => setNewChName(e.target.value)}
                  placeholder="Sendername (z.B. RTL)"
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-magenta-500/50"
                  onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                />
                <input
                  type="text"
                  value={newChNum}
                  onChange={(e) => setNewChNum(e.target.value)}
                  placeholder="Nr."
                  className="w-16 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm text-center placeholder-white/20 focus:outline-none focus:border-magenta-500/50"
                  onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                />
                <button
                  onClick={handleAddChannel}
                  disabled={!newChName.trim() || !newChNum.trim()}
                  className="px-3 py-2 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-30 text-white text-sm font-medium transition-colors"
                >
                  +
                </button>
              </div>

              {/* Channel list */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {Object.entries(channelMap)
                  .sort(([, a], [, b]) => parseInt(a) - parseInt(b))
                  .map(([name, num]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/30 w-8 text-right font-mono">
                          {num}
                        </span>
                        <span className="text-sm text-white/70">{name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveChannel(name)}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
              </div>

              <p className="text-xs text-white/30">
                Sendernamen werden kleingeschrieben gespeichert. Die Nummern entsprechen deiner MagentaTV-Senderliste.
                Passe die Nummern an dein Gerät an.
              </p>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-magenta-500 hover:bg-magenta-600 disabled:opacity-40 text-white font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save Channels"}
              </button>
            </div>
          ) : (
            /* Setup Guide Tab */
            <div className="space-y-6">
              {/* Prerequisites */}
              <div className="p-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <p className="text-xs font-medium text-amber-400 mb-1">Voraussetzungen</p>
                <ul className="text-xs text-white/50 space-y-1">
                  <li>&#x2022; Ein Amazon-Konto (dasselbe wie auf deinen Echo Dots)</li>
                  <li>&#x2022; Magenta Control Backend muss laufen (:3001)</li>
                  <li>&#x2022; Mindestens ein gepairtes MagentaTV-Gerät</li>
                </ul>
              </div>

              <ol className="space-y-5 text-sm">
                {/* Step 1 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Amazon Developer Account erstellen</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Öffne{" "}
                        <a
                          href="https://developer.amazon.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00CAFF] underline underline-offset-2"
                        >
                          developer.amazon.com
                        </a>{" "}
                        und melde dich mit deinem Amazon-Konto an.
                      </p>
                      <p>
                        Wichtig: Verwende <strong className="text-white/60">dasselbe Amazon-Konto</strong>, das
                        auf deinen Echo Dots eingerichtet ist. Nur so erscheint der Skill automatisch auf deinen Geräten.
                      </p>
                    </div>
                  </div>
                </li>

                {/* Step 2 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Neuen Custom Skill anlegen</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Gehe zur{" "}
                        <a
                          href="https://developer.amazon.com/alexa/console/ask"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00CAFF] underline underline-offset-2"
                        >
                          Alexa Developer Console
                        </a>{" "}
                        und klicke <strong className="text-white/60">"Create Skill"</strong>.
                      </p>
                      <div className="p-2.5 rounded-lg bg-white/5 space-y-1.5 text-xs">
                        <p><strong className="text-white/60">Name:</strong> Magenta Control (oder frei wählbar)</p>
                        <p><strong className="text-white/60">Primary Locale:</strong> German (DE)</p>
                        <p><strong className="text-white/60">Model:</strong> Custom</p>
                        <p><strong className="text-white/60">Hosting:</strong> "Provision your own"</p>
                      </div>
                      <p>Klicke "Next" und dann "Create Skill". Wähle "Start from Scratch" als Template.</p>
                    </div>
                  </div>
                </li>

                {/* Step 3 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Invocation Name setzen</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Im Skill Builder links unter <strong className="text-white/60">"Invocations" &gt; "Skill Invocation Name"</strong>.
                      </p>
                      <p>
                        Setze den Namen auf:{" "}
                        <code className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-xs">
                          magenta
                        </code>
                      </p>
                      <p>
                        Damit aktivierst du den Skill mit <em className="text-white/60">"Alexa, sage Magenta ..."</em>
                      </p>
                    </div>
                  </div>
                </li>

                {/* Step 4 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    4
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Interaction Model importieren</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Gehe links zu <strong className="text-white/60">"Interaction Model" &gt; "JSON Editor"</strong>.
                        Lösche den gesamten bestehenden Inhalt und füge das folgende JSON ein.
                        Es definiert alle Sprachbefehle, App-Namen und Richtungen auf Deutsch.
                      </p>
                    </div>
                    <div className="mt-3 relative">
                      <button
                        onClick={handleCopyModel}
                        className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/60 hover:text-white transition-all z-10"
                      >
                        {copied ? "Kopiert!" : "Kopieren"}
                      </button>
                      <pre className="p-3 pr-20 rounded-xl bg-black/40 ring-1 ring-white/5 text-xs text-white/50 overflow-x-auto max-h-48 overflow-y-auto">
                        {INTERACTION_MODEL}
                      </pre>
                    </div>
                    <p className="text-white/40 mt-2 text-xs">
                      Klicke danach oben auf <strong className="text-white/60">"Save Model"</strong>.
                    </p>
                  </div>
                </li>

                {/* Step 5 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    5
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">HTTPS-Tunnel einrichten</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Alexa sendet Requests über das Internet. Dein lokales Backend muss per HTTPS erreichbar sein.
                        Nutze einen der folgenden Dienste:
                      </p>
                      <div className="p-2.5 rounded-lg bg-white/5 space-y-2 text-xs">
                        <div>
                          <p className="text-white/60 font-medium">Option A: ngrok (schnell zum Testen)</p>
                          <pre className="mt-1 p-2 rounded-lg bg-black/40 text-white/50">ngrok http 3001</pre>
                        </div>
                        <div>
                          <p className="text-white/60 font-medium">Option B: Cloudflare Tunnel (stabil, kostenlos)</p>
                          <pre className="mt-1 p-2 rounded-lg bg-black/40 text-white/50">cloudflared tunnel --url http://localhost:3001</pre>
                        </div>
                      </div>
                      <p>
                        Kopiere die resultierende HTTPS-URL (z.B.{" "}
                        <code className="px-1 py-0.5 rounded bg-white/10 text-white/50 text-xs">
                          https://abc123.ngrok-free.app
                        </code>
                        ) und trage sie im <strong className="text-white/60">Configuration</strong>-Tab unter "Tunnel URL" ein.
                      </p>
                    </div>
                  </div>
                </li>

                {/* Step 6 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    6
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Skill Endpoint konfigurieren</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Zurück in der Alexa Developer Console: Gehe links zu{" "}
                        <strong className="text-white/60">"Endpoint"</strong>.
                      </p>
                      <div className="p-2.5 rounded-lg bg-white/5 space-y-1.5 text-xs">
                        <p><strong className="text-white/60">Service Endpoint Type:</strong> HTTPS</p>
                        <p><strong className="text-white/60">Default Region:</strong></p>
                      </div>
                      <code className="block p-3 rounded-xl bg-black/40 ring-1 ring-white/5 text-xs text-[#00CAFF] break-all">
                        {endpointUrl}
                      </code>
                      <div className="p-2.5 rounded-lg bg-white/5 text-xs">
                        <p>
                          <strong className="text-white/60">SSL Certificate Type:</strong>{" "}
                          "My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority"
                        </p>
                      </div>
                      <p>Klicke auf <strong className="text-white/60">"Save Endpoints"</strong>.</p>
                    </div>
                  </div>
                </li>

                {/* Step 7 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    7
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Model bauen und testen</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Klicke oben auf <strong className="text-white/60">"Build Model"</strong> und warte
                        bis der Build abgeschlossen ist (ca. 30 Sekunden).
                      </p>
                      <p>
                        Wechsle dann zum <strong className="text-white/60">"Test"</strong>-Tab oben und
                        setze "Skill testing is enabled in:" auf <strong className="text-white/60">"Development"</strong>.
                      </p>
                    </div>
                  </div>
                </li>

                {/* Step 8 */}
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-magenta-500/20 text-magenta-400 flex items-center justify-center text-xs font-bold">
                    8
                  </span>
                  <div>
                    <p className="text-white/80 font-medium">Magenta Control konfigurieren</p>
                    <div className="text-white/40 mt-1 space-y-2">
                      <p>
                        Wechsle hier zum <strong className="text-white/60">Configuration</strong>-Tab und:
                      </p>
                      <ul className="space-y-1 text-xs pl-1">
                        <li>&#x2022; Aktiviere den Alexa-Control-Schalter</li>
                        <li>&#x2022; Wähle dein MagentaTV-Gerät aus</li>
                        <li>&#x2022; Trage deine Tunnel-URL ein</li>
                        <li>&#x2022; Optional: Trage die Skill ID ein (zu finden in der Alexa Console unter "Skill Information")</li>
                        <li>&#x2022; Klicke "Save Settings"</li>
                      </ul>
                    </div>
                  </div>
                </li>
              </ol>

              {/* Test commands */}
              <div className="p-4 rounded-xl bg-white/5 ring-1 ring-white/5">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-3 font-medium">
                  Sprachbefehle zum Testen
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { cmd: "Alexa, sage Magenta starte Netflix", desc: "App starten" },
                    { cmd: "Alexa, sage Magenta lauter", desc: "Lautstärke" },
                    { cmd: "Alexa, sage Magenta nächster Kanal", desc: "Umschalten" },
                    { cmd: "Alexa, sage Magenta einschalten", desc: "Ein/Aus" },
                    { cmd: "Alexa, sage Magenta pause", desc: "Wiedergabe" },
                    { cmd: "Alexa, sage Magenta zurück", desc: "Navigation" },
                    { cmd: "Alexa, sage Magenta home", desc: "Startseite" },
                    { cmd: "Alexa, sage Magenta ok", desc: "Auswählen" },
                  ].map((item) => (
                    <div key={item.cmd} className="flex items-center justify-between gap-2">
                      <p className="text-white/60 text-xs italic">"{item.cmd}"</p>
                      <span className="text-[10px] text-white/30 shrink-0">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Troubleshooting */}
              <div className="p-4 rounded-xl bg-white/5 ring-1 ring-white/5">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-3 font-medium">
                  Fehlerbehebung
                </p>
                <div className="space-y-2 text-xs text-white/40">
                  <p>
                    <strong className="text-white/60">Alexa sagt "Es gab ein Problem":</strong>{" "}
                    Prüfe ob der Tunnel läuft und die URL korrekt im Configuration-Tab eingetragen ist.
                  </p>
                  <p>
                    <strong className="text-white/60">Skill nicht auf Echo Dot verfügbar:</strong>{" "}
                    Stelle sicher, dass du denselben Amazon-Account verwendest. Der Skill ist im "Development"-Modus
                    automatisch auf allen Geräten deines Accounts aktiv.
                  </p>
                  <p>
                    <strong className="text-white/60">"Alexa-Steuerung ist deaktiviert":</strong>{" "}
                    Aktiviere den Schalter im Configuration-Tab und speichere.
                  </p>
                  <p>
                    <strong className="text-white/60">Gerät reagiert nicht:</strong>{" "}
                    Prüfe ob das ausgewählte Gerät gepairt und online ist (Magenta Home Dashboard).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
