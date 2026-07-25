"use client";
import { useState, useRef, useEffect } from "react";

// Avatar: cuando gabycontrol pase el archivo, ponelo en /public/chef-avatar.png
// y esto lo usa automaticamente; si no existe, cae al emoji.
const AVATAR_SRC = "/chef-avatar.png";

export function ChefAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarOk, setAvatarOk] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const next = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const text = res.ok ? data.text : (data.error || "Ups, algo falló.");
      setMessages((m) => [...m, { role: "assistant", content: text }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "No pude conectar. Revisá tu internet e intentá de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const Avatar = ({ size }) => (
    avatarOk ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={AVATAR_SRC}
        alt="Asistente"
        onError={() => setAvatarOk(false)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
      />
    ) : (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "#F0ECE6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.55 }}>
        👩‍🍳
      </div>
    )
  );

  return (
    <>
      {/* Boton flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente de cocina"
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 500,
            width: 60, height: 60, borderRadius: "50%",
            border: "3px solid #fff", padding: 0, cursor: "pointer",
            boxShadow: "0 6px 20px rgba(0,0,0,0.28)", background: "var(--app-primary)",
            overflow: "hidden",
          }}
          title="Preguntale a la asistente"
        >
          <Avatar size={54} />
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 500,
            width: "min(380px, calc(100vw - 24px))", height: "min(560px, calc(100vh - 40px))",
            background: "#fff", borderRadius: 16, overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0 16px 50px rgba(0,0,0,0.35)", border: "1px solid #E0D8CE",
          }}
        >
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontFamily: "Georgia,serif", fontSize: 15 }}>Asistente Don Telmo</div>
              <div style={{ color: "#C9D6E0", fontSize: 11 }}>Pregunta sobre recetas y la app</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>×</button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, background: "#FDFAF6" }}>
            {messages.length === 0 && (
              <div style={{ color: "#8a7a68", fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>¡Hola! 👋</div>
                Preguntame lo que quieras, por ejemplo:
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  <li>¿Qué lleva la Hawaiana (C)?</li>
                  <li>¿Cuánto queso tiene la lasagna?</li>
                  <li>¿Cómo creo una receta nueva?</li>
                  <li>¿Qué es Recetas Bodega?</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                <div style={{
                  maxWidth: "82%", padding: "9px 12px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.45,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  background: m.role === "user" ? "var(--app-primary)" : "#fff",
                  color: m.role === "user" ? "#fff" : "#333",
                  border: m.role === "user" ? "none" : "1px solid #EbE3D8",
                  borderBottomRightRadius: m.role === "user" ? 3 : 12,
                  borderBottomLeftRadius: m.role === "user" ? 12 : 3,
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                <div style={{ padding: "9px 14px", borderRadius: 12, background: "#fff", border: "1px solid #EbE3D8", color: "#999", fontSize: 13 }}>
                  escribiendo…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 10, borderTop: "1px solid #F0ECE6", display: "flex", gap: 8, background: "#fff" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribí tu pregunta…"
              style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #E0D8CE", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit" }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{ background: (loading || !input.trim()) ? "#ccc" : "var(--app-primary)", border: "none", borderRadius: 10, color: "#fff", padding: "0 16px", cursor: (loading || !input.trim()) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14 }}
            >➤</button>
          </div>
        </div>
      )}
    </>
  );
}
