"use client";
import { useEffect, useState } from "react";

export function ScreenProtection({ userName }) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Blurear al perder foco (cambiar de app / herramientas de captura)
    const handleVisibility = () => {
      if (document.hidden) {
        setBlurred(true);
      } else {
        // Delay para que la captura no alcance a tomar el contenido
        setTimeout(() => setBlurred(false), 300);
      }
    };

    const handleBlur = () => setBlurred(true);
    const handleFocus = () => setTimeout(() => setBlurred(false), 300);

    // 2. Detectar PrintScreen y combinaciones de captura
    const handleKeyDown = (e) => {
      // PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        setBlurred(true);
        setTimeout(() => setBlurred(false), 2000);
      }
      // Ctrl+Shift+S (Snipping Tool Windows)
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setBlurred(true);
        setTimeout(() => setBlurred(false), 2000);
      }
      // Cmd+Shift+3/4/5 (Mac screenshots) - can't fully prevent but blur
      if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key)) {
        setBlurred(true);
        setTimeout(() => setBlurred(false), 2000);
      }
      // Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
      }
    };

    // 3. Bloquear clic derecho
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 4. Bloquear arrastrar imágenes
    const handleDragStart = (e) => {
      if (e.target.tagName === "IMG") {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, []);

  return (
    <>
      {/* Overlay de blur cuando intentan capturar */}
      {blurred && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(13,35,64,0.95)",
          backdropFilter: "blur(30px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "12px",
        }}>
          <div style={{ fontSize: "48px" }}>🔒</div>
          <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "18px", fontWeight: "700", textAlign: "center" }}>
            Contenido Protegido
          </div>
          <div style={{ color: "#8BAACC", fontSize: "13px", textAlign: "center", maxWidth: "280px", lineHeight: "1.6" }}>
            Las capturas de pantalla están restringidas.
            {userName && <><br />Actividad registrada: <strong>{userName}</strong></>}
          </div>
        </div>
      )}

      {/* CSS global de protección */}
      <style jsx global>{`
        /* Bloquear selección de texto en toda la app */
        body {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }

        /* Permitir selección solo en inputs y textareas */
        input, textarea, [contenteditable="true"] {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }

        /* Proteger imágenes */
        img {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          user-drag: none;
          pointer-events: none;
        }

        /* Bloquear impresión */
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
