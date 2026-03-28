"use client";
import { useEffect, useState, useRef } from "react";

export function ScreenProtection({ userName }) {
  const [blurred, setBlurred] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const showProtection = (duration = 3000) => {
      setBlurred(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBlurred(false), duration);
    };

    // 1. Blurear al perder foco
    const handleVisibility = () => {
      if (document.hidden) setBlurred(true);
      else setTimeout(() => setBlurred(false), 500);
    };

    const handleBlur = () => setBlurred(true);
    const handleFocus = () => setTimeout(() => setBlurred(false), 500);

    // 2. Detectar teclas de captura
    const handleKeyDown = (e) => {
      if (e.key === "PrintScreen") { e.preventDefault(); showProtection(); }
      if (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s")) { e.preventDefault(); showProtection(); }
      if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key)) { showProtection(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); }
      // Windows Game Bar (Win+G) and Win+Alt+PrintScreen
      if (e.metaKey && (e.key === "g" || e.key === "G")) { showProtection(); }
    };

    // 3. Bloquear clic derecho
    const handleContextMenu = (e) => { e.preventDefault(); return false; };

    // 4. Bloquear arrastrar imágenes
    const handleDragStart = (e) => { if (e.target.tagName === "IMG") e.preventDefault(); };

    // 5. Detectar herramientas de desarrollo abiertas (intento de inspección)
    const handleDevTools = (e) => {
      if (e.key === "F12") { e.preventDefault(); }
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) { e.preventDefault(); }
      if (e.ctrlKey && (e.key === "U" || e.key === "u")) { e.preventDefault(); }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleDevTools, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleDevTools, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {blurred && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(13,35,64,0.97)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "12px",
        }}>
          <div style={{ fontSize: "48px" }}>🔒</div>
          <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "18px", fontWeight: "700", textAlign: "center" }}>
            Contenido Protegido
          </div>
          <div style={{ color: "var(--app-primary-light)", fontSize: "13px", textAlign: "center", maxWidth: "280px", lineHeight: "1.6" }}>
            Las capturas de pantalla están restringidas.
            {userName && <><br />Usuario: <strong style={{ color: "#D4721A" }}>{userName}</strong></>}
          </div>
        </div>
      )}

      <style jsx global>{`
        body {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        input, textarea, [contenteditable="true"] {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
        img {
          -webkit-user-drag: none;
          user-drag: none;
          pointer-events: none;
        }
        @media print {
          body { display: none !important; }
        }
      `}</style>
    </>
  );
}
