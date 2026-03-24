"use client";
import { useState, useRef, useEffect } from "react";

const SPEED_OPTIONS = [
  { label: "0.5×", value: 0.5 },
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
];

export function TextToSpeech({ text, label }) {
  const [status, setStatus] = useState("idle"); // idle | loading | playing | paused
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const cacheRef = useRef({}); // Cache audio blobs por texto

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const fetchAudio = async (txt) => {
    // Revisar cache
    const cacheKey = txt.slice(0, 100);
    if (cacheRef.current[cacheKey]) return cacheRef.current[cacheKey];

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: txt }),
    });

    if (!res.ok) throw new Error("TTS failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cacheRef.current[cacheKey] = url;
    return url;
  };

  const handlePlay = async () => {
    if (!text) return;

    // Si está pausado, reanudar
    if (status === "paused" && audioRef.current) {
      audioRef.current.play();
      setStatus("playing");
      return;
    }

    // Si ya está reproduciendo, ignorar
    if (status === "loading") return;

    setStatus("loading");

    try {
      // Detener audio anterior si existe
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audioUrl = await fetchAudio(text);
      const audio = new Audio(audioUrl);
      audio.playbackRate = speed;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setStatus("idle");
        setProgress(0);
      };

      audio.onerror = () => {
        setStatus("idle");
        setProgress(0);
      };

      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
    } catch (err) {
      console.error("TTS error:", err);
      setStatus("idle");
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus("paused");
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setStatus("idle");
    setProgress(0);
  };

  const changeSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    setShowSpeedMenu(false);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  if (!text) return null;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", position:"relative" }}>

      {/* Play */}
      {(status === "idle" || status === "paused") && (
        <button
          onClick={handlePlay}
          title={status === "paused" ? "Reanudar" : `Escuchar ${label}`}
          style={{
            background: status === "paused"
              ? "linear-gradient(135deg,#27ae60,#1e8449)"
              : "linear-gradient(135deg,#27ae60,#1e8449)",
            border:"none", borderRadius:"50%", width:"32px", height:"32px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(39,174,96,0.3)", transition:"transform 0.15s",
            color:"#fff", fontSize:"14px",
            animation: status === "paused" ? "pulse 1.5s infinite" : "none",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          {status === "paused" ? "▶️" : "🔊"}
        </button>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div
          style={{
            width:"32px", height:"32px", borderRadius:"50%",
            border:"3px solid #E0D8CE", borderTopColor:"#27ae60",
            animation:"spin 0.8s linear infinite",
          }}
        />
      )}

      {/* Pause (cuando está reproduciendo) */}
      {status === "playing" && (
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

      {/* Stop */}
      {(status === "playing" || status === "paused") && (
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
      {(status === "playing" || status === "paused") && (
        <div style={{
          flex:1, height:"4px", background:"#E0D8CE", borderRadius:"2px",
          overflow:"hidden", minWidth:"40px", maxWidth:"80px",
        }}>
          <div style={{
            height:"100%",
            background: status === "playing" ? "#27ae60" : "#f39c12",
            borderRadius:"2px", transition:"width 0.3s",
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

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
