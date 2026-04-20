const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  addDevice(host: string, name?: string) {
    return request("/devices/add", {
      method: "POST",
      body: JSON.stringify({ host, name }),
    });
  },

  startPairing(host: string) {
    return request<{ id: string; message: string }>("/devices/pair/start", {
      method: "POST",
      body: JSON.stringify({ host }),
    });
  },

  finishPairing(host: string, code: string) {
    return request("/devices/pair/finish", {
      method: "POST",
      body: JSON.stringify({ host, code }),
    });
  },

  sendKey(id: string, key: string, direction?: string) {
    return request(`/devices/${id}/key`, {
      method: "POST",
      body: JSON.stringify({ key, direction }),
    });
  },

  launchApp(id: string, appLink: string) {
    return request(`/devices/${id}/launch`, {
      method: "POST",
      body: JSON.stringify({ appLink }),
    });
  },

  togglePower(id: string) {
    return request<{ ok: boolean; method: string; message: string }>(
      `/devices/${id}/power`,
      { method: "POST" }
    );
  },

  removeDevice(id: string) {
    return request(`/devices/${id}`, { method: "DELETE" });
  },

  getAlexaSettings() {
    return request<{
      enabled: boolean;
      deviceId: string;
      skillId?: string;
      tunnelUrl?: string;
      channelMap?: Record<string, string>;
    }>("/settings/alexa");
  },

  saveAlexaSettings(settings: {
    enabled: boolean;
    deviceId: string;
    skillId?: string;
    tunnelUrl?: string;
    channelMap?: Record<string, string>;
  }) {
    return request<{
      enabled: boolean;
      deviceId: string;
      skillId?: string;
      tunnelUrl?: string;
      channelMap?: Record<string, string>;
    }>("/settings/alexa", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  getDefaultChannelMap() {
    return request<Record<string, string>>("/settings/alexa/channels/defaults");
  },
};
