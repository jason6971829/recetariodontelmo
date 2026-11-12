"use client";
import { useState, useRef } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useIsMobile } from "@/hooks/useIsMobile";

export function VoiceTextarea({ value, onChange, placeholder, minHeight = "110px", fieldColor = "#F7F3EE" }) {
  const [interim, setInterim] = useState(false);
  const baseRef = useRef(value);
  const isMobile = useIsMobile();

  const { listening, supported, start, stop } = useSpeechRecognition({
    onResult: (text, isInterim) => {
      setInterim(isInterim);
      onChange(text);
    },
    onEnd: () => setInterim(false),
  });

  const handleMic = () => {
    if (listening) { stop(); return; }
    baseRef.current = value;
    start(value);
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 58px 12px 14px",
          border: listening ? "2px solid #C8423B" : "1.5px solid #E7E1D7",
          borderRadius: 14, fontSize: 16, color: "#14213D", outline: "none",
          boxSizing: "border-box", fontFamily: "inherit",
          background: interim ? "#FFF5F0" : "#fff",
          minHeight, resize: "vertical", lineHeight: "1.6",
          transition: "border-color 0.2s, background 0.2s"
        }}
      />
      {supported && (
        <button
          type="button"
          onClick={handleMic}
          title={listening ? "Detener grabación" : "Dictar con voz"}
          style={{
            position: "absolute", right: 8, top: 8,
            width: isMobile ? 44 : 40, height: isMobile ? 44 : 40,
            borderRadius: "50%",
            border: "none", cursor: "pointer",
            background: listening ? "#C8423B" : "#0E2240",
            color: "#fff", transition: "background .2s",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: listening ? "0 0 0 4px rgba(231,76,60,0.25)" : "none",
            animation: listening ? "pulse 1.2s ease-in-out infinite" : "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {listening
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></svg>}
        </button>
      )}
      {listening && (
        <div style={{
          position: "absolute", bottom: isMobile ? "10px" : "8px", right: isMobile ? "10px" : "8px",
          background: "#e74c3c", color: "#fff", fontSize: isMobile ? "12px" : "10px",
          fontWeight: "700", borderRadius: "10px", padding: isMobile ? "4px 12px" : "2px 8px",
          letterSpacing: "1px", animation: "pulse 1.2s ease-in-out infinite"
        }}>● GRABANDO</div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
