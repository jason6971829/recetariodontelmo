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
          width: "100%", padding: "10px 44px 10px 12px",
          border: listening ? "2px solid #e74c3c" : "1.5px solid #E0D8CE",
          borderRadius: "8px", fontSize: "13px", outline: "none",
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
            position: "absolute", right: isMobile ? "10px" : "8px", top: isMobile ? "10px" : "8px",
            width: isMobile ? "44px" : "30px", height: isMobile ? "44px" : "30px",
            borderRadius: "50%",
            border: "none", cursor: "pointer",
            background: listening ? "#e74c3c" : "#1B3A5C",
            color: "#fff", fontSize: isMobile ? "20px" : "14px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: listening ? "0 0 0 4px rgba(231,76,60,0.25)" : "none",
            animation: listening ? "pulse 1.2s ease-in-out infinite" : "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {listening ? "⏹" : "🎙️"}
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
