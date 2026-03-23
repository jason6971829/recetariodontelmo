"use client";
import { useState, useRef, useCallback } from "react";

export function useSpeechRecognition({ onResult, onEnd }) {
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported] = useState(() =>
    typeof window !== "undefined"
      ? !!(window.SpeechRecognition || window.webkitSpeechRecognition)
      : false
  );

  const start = useCallback((currentText) => {
    if (!supported) { alert("Tu navegador no soporta reconocimiento de voz.\nUsa Chrome o Safari."); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = "es-CO";
    r.interimResults = true;
    r.continuous = true;
    recogRef.current = r;
    const base = currentText ? currentText + " " : "";
    r.onresult = e => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      onResult(base + final + interim, !!interim);
    };
    r.onerror = () => { setListening(false); };
    r.onend = () => { setListening(false); onEnd && onEnd(); };
    r.start();
    setListening(true);
  }, [supported, onResult, onEnd]);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
