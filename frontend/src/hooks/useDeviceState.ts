import { useEffect, useRef, useState, useCallback } from "react";
import type { DeviceState, WSMessage } from "../types";

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws`;
}

export function useDeviceState() {
  const [devices, setDevices] = useState<Map<string, DeviceState>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = getWsUrl();
    console.log("[WS] Connecting to", url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] Connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "devices:list": {
        const list = msg.payload as DeviceState[];
        setDevices(new Map(list.map((d) => [d.id, d])));
        break;
      }
      case "device:discovered":
      case "device:state":
      case "device:paired": {
        const device = msg.payload as DeviceState;
        if (device) {
          setDevices((prev) => {
            const next = new Map(prev);
            next.set(device.id, device);
            return next;
          });
        }
        break;
      }
      case "device:removed": {
        const id = msg.deviceId;
        if (id) {
          setDevices((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }
        break;
      }
    }
  }, []);

  const fetchDevicesREST = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const list: DeviceState[] = await res.json();
        setDevices(new Map(list.map((d) => [d.id, d])));
      }
    } catch {
      /* REST fallback failed silently */
    }
  }, []);

  useEffect(() => {
    connect();
    fetchDevicesREST();

    const pollId = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchDevicesREST();
      }
    }, 5000);

    return () => {
      clearInterval(pollId);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, fetchDevicesREST]);

  return {
    devices: Array.from(devices.values()),
    devicesMap: devices,
    connected,
  };
}
