"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const SPEED_OPTIONS = [
  { label: "0.5×", value: 0.5 },
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
];

export function TextToSpeech({ text, label }) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [voices, setVoices] = useState([]);
  const [progress, setProgress] = useState(0);
  const utterRef = useRef(null);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationEstRef = useRef(0);

  // Cargar voces disponibles
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = speechSynthesis.getVoices();
      setVoices(v);
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.cancel();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Seleccionar la mejor voz femenina en español
  const getBestVoice = useCallback(() => {
    if (voices.length === 0) return null;

    // Prioridad: voces de Google/Microsoft en español que suenen natural
    const spanishVoices = voices.filter(v =>
      v.lang.startsWith("es")
    );

    // Preferir voces femeninas (nombres comunes de voces femeninas)
    const femaleKeywords = [
      "female", "mujer", "femenin",
      "elena", "paulina", "monica", "mónica", "lucia", "lucía",
      "conchita", "lupe", "penelope", "penélope", "miren",
      "sabina", "elvira", "ines", "inés", "silvia",
      "google español", "microsoft sabina", "microsoft elvira",
      "microsoft helena", "helena",
    ];

    // Buscar voz femenina en español
    let best = spanishVoices.find(v => {
      const name = v.name.toLowerCase();
      return femaleKeywords.some(k => name.includes(k));
    });

    // Si no encuentra femenina específica, usar cualquier voz española
    if (!best && spanishVoices.length > 0) {
      // Preferir voces de Google o Microsoft (suenan más natural)
      best = spanishVoices.find(v =>
        v.name.toLowerCase().includes("google") || v.name.toLowerCase().includes("microsoft")
      ) || spanishVoices[0];
    }

    // Fallback a cualquier voz
    return best || voices[0];
  }, [voices]);

  const handlePlay = () => {
    if (!window.speechSynthesis || !text) return;

    // Si está pausada, reanudar
    if (paused) {
      speechSynthesis.resume();
      setPaused(false);
      setPlaying(true);
      startProgressTracker();
      return;
    }

    // Cancelar cualquier lectura previa
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = getBestVoice();
    if (voice) utter.voice = voice;
    utter.lang = "es-ES";
    utter.rate = speed;
    utter.pitch = 1.1; // Ligeramente más alto para voz femenina

    // Estimar duración (aprox 150 palabras por minuto a velocidad 1x)
    const wordCount = text.split(/\s+/).length;
    durationEstRef.current = (wordCount / 150) * 60 * 1000 / speed;

    utter.onstart = () => {
      startTimeRef.current = Date.now();
      startProgressTracker();
    };

    utter.onend = () => {
      setPlaying(false);
      setPaused(false);
      setProgress(0);
      stopProgressTracker();
    };

    utter.onerror = () => {
      setPlaying(false);
      setPaused(false);
      setProgress(0);
      stopProgressTracker();
    };

    utterRef.current = utter;
    speechSynthesis.speak(utter);
    setPlaying(true);
    setPaused(false);
  };

  const handlePause = () => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      setPaused(true);
      setPlaying(false);
      stopProgressTracker();
    }
  };

  const handleStop = () => {
    speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
    setProgress(0);
    stopProgressTracker();
  };

  const changeSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    setShowSpeedMenu(false);
    // Si está reproduciéndose, reiniciar con nueva velocidad
    if (playing || paused) {
      speechSynthesis.cancel();
      setPlaying(false);
      setPaused(false);
      setProgress(0);
      stopProgressTracker();
      // Reiniciar con nueva velocidad después de un tick
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(text);
        const voice = getBestVoice();
        if (voice) utter.voice = voice;
        utter.lang = "es-ES";
        utter.rate = newSpeed;
        utter.pitch = 1.1;

        const wordCount = text.split(/\s+/).length;
        durationEstRef.current = (wordCount / 150) * 60 * 1000 / newSpeed;

        utter.onstart = () => {
          startTimeRef.current = Date.now();
          startProgressTracker();
        };
        utter.onend = () => { setPlaying(false); setPaused(false); setProgress(0); stopProgressTracker(); };
        utter.onerror = () => { setPlaying(false); setPaused(false); setProgress(0); stopProgressTracker(); };

        utterRef.current = utter;
        speechSynthesis.speak(utter);
        setPlaying(true);
        setPaused(false);
      }, 100);
    }
  };

  const startProgressTracker = () => {
    stopProgressTracker();
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current && durationEstRef.current > 0) {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min((elapsed / durationEstRef.current) * 100, 100);
        setProgress(pct);
      }
    }, 200);
  };

  const stopProgressTracker = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  if (typeof window === "undefined" || !window.speechSynthesis || !text) return null;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", position:"relative" }}>
      {/* Play / Pause */}
      {!playing && !paused && (
        <button
          onClick={handlePlay}
          title={`Escuchar ${label}`}
          style={{
            background:"linear-gradient(135deg,#27ae60,#1e8449)",
            border:"none", borderRadius:"50%", width:"32px", height:"32px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(39,174,96,0.3)", transition:"transform 0.15s",
            color:"#fff", fontSize:"14px",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          🔊
        </button>
      )}

      {playing && (
        <button
          onClick={handlePause}
          title="Pausar"
          style={{
            background:"linear-gradient(135deg,#f39c12,#e67e22)",
            border:"none", borderRadius:"50%", width:"32px", height:"32px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(243,156,18,0.3)",
            color:"#fff", fontSize:"14px",
          }}
        >
          ⏸️
        </button>
      )}

      {paused && (
        <button
          onClick={handlePlay}
          title="Reanudar"
          style={{
            background:"linear-gradient(135deg,#27ae60,#1e8449)",
            border:"none", borderRadius:"50%", width:"32px", height:"32px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(39,174,96,0.3)",
            color:"#fff", fontSize:"14px", animation:"pulse 1.5s infinite",
          }}
        >
          ▶️
        </button>
      )}

      {/* Stop */}
      {(playing || paused) && (
        <button
          onClick={handleStop}
          title="Detener"
          style={{
            background:"linear-gradient(135deg,#e74c3c,#c0392b)",
            border:"none", borderRadius:"50%", width:"28px", height:"28px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize:"11px",
          }}
        >
          ⏹️
        </button>
      )}

      {/* Barra de progreso */}
      {(playing || paused) && (
        <div style={{
          flex:1, height:"4px", background:"#E0D8CE", borderRadius:"2px",
          overflow:"hidden", minWidth:"40px", maxWidth:"80px",
        }}>
          <div style={{
            height:"100%", background: playing ? "#27ae60" : "#f39c12",
            borderRadius:"2px", transition:"width 0.2s",
            width: `${progress}%`,
          }} />
        </div>
      )}

      {/* Velocidad */}
      <div style={{ position:"relative" }}>
        <button
          onClick={() => setShowSpeedMenu(s => !s)}
          title="Velocidad de lectura"
          style={{
            background: showSpeedMenu ? "#1B3A5C" : "#F0ECE6",
            color: showSpeedMenu ? "#fff" : "#1B3A5C",
            border:"none", borderRadius:"6px", padding:"3px 7px",
            cursor:"pointer", fontSize:"11px", fontWeight:"700",
            fontFamily:"monospace", transition:"all 0.15s",
          }}
        >
          {speed}×
        </button>

        {showSpeedMenu && (
          <div style={{
            position:"absolute", bottom:"110%", left:"50%", transform:"translateX(-50%)",
            background:"#fff", borderRadius:"10px", boxShadow:"0 8px 30px rgba(0,0,0,0.2)",
            padding:"6px", zIndex:100, minWidth:"60px",
            border:"1px solid #E0D8CE",
          }}>
            {SPEED_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeSpeed(opt.value)}
                style={{
                  display:"block", width:"100%", textAlign:"center",
                  padding:"6px 10px", border:"none", borderRadius:"6px",
                  cursor:"pointer", fontSize:"12px", fontWeight:"600",
                  fontFamily:"monospace",
                  background: speed === opt.value ? "#1B3A5C" : "transparent",
                  color: speed === opt.value ? "#fff" : "#333",
                  transition:"all 0.1s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
