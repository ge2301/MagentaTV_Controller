import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: string;
  type: "error" | "success" | "info";
}

interface ToastContextValue {
  show: (text: string, type?: ToastMessage["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((text: string, type: ToastMessage["type"] = "error") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg backdrop-blur-xl
              animate-[fadeInUp_0.2s_ease-out]
              pointer-events-auto
              ${t.type === "error" ? "bg-red-500/90 text-white" : ""}
              ${t.type === "success" ? "bg-green-500/90 text-white" : ""}
              ${t.type === "info" ? "bg-white/20 text-white/90" : ""}
            `}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
