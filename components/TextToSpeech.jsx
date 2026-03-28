"use client";
import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { logActivity } from "@/lib/storage";

const SPEED_OPTIONS = [
  { label: "0.5×", value: 0.5 },
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
];

export function TextToSpeech({ text, label, userId }) {
  const [status, setStatus] = useState("idle"); // idle | loading | playing | paused
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const cacheRef = useRef({}); // Cache audio blobs por texto
  const isMobile = useIsMobile();

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
      if (userId) logActivity(userId, "tts_play", label);
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

  const btnSize = isMobile ? "44px" : "32px";
  const btnFontSize = isMobile ? "18px" : "14px";
  const stopSize = isMobile ? "38px" : "28px";

  return (
    <div style={{ display:"flex", alignItems:"center", gap: isMobile ? "10px" : "6px", position:"relative" }}>

      {/* Play */}
      {(status === "idle" || status === "paused") && (
        <button
          onClick={handlePlay}
          title={status === "paused" ? "Reanudar" : `Escuchar ${label}`}
          style={{
            background:"linear-gradient(135deg,#27ae60,#1e8449)",
            border:"none", borderRadius:"50%", width: btnSize, height: btnSize,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(39,174,96,0.3)", transition:"transform 0.15s",
            color:"#fff", fontSize: btnFontSize,
            animation: status === "paused" ? "pulse 1.5s infinite" : "none",
            WebkitTapHighlightColor:"transparent",
          }}
          onMouseEnter={e => !isMobile && (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseLeave={e => !isMobile && (e.currentTarget.style.transform = "scale(1)")}
        >
          {status === "paused" ? "▶️" : "🔊"}
        </button>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div
          style={{
            width: btnSize, height: btnSize, borderRadius:"50%",
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
            border:"none", borderRadius:"50%", width: btnSize, height: btnSize,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(243,156,18,0.3)",
            color:"#fff", fontSize: btnFontSize,
            WebkitTapHighlightColor:"transparent",
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
            border:"none", borderRadius:"50%", width: stopSize, height: stopSize,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize: isMobile ? "14px" : "11px",
            WebkitTapHighlightColor:"transparent",
          }}
        >
          ⏹️
        </button>
      )}

      {/* Barra de progreso */}
      {(status === "playing" || status === "paused") && (
        <div style={{
          flex:1, height: isMobile ? "6px" : "4px", background:"#E0D8CE", borderRadius:"3px",
          overflow:"hidden", minWidth: isMobile ? "50px" : "40px", maxWidth: isMobile ? "120px" : "80px",
        }}>
          <div style={{
            height:"100%",
            background: status === "playing" ? "#27ae60" : "#f39c12",
            borderRadius:"3px", transition:"width 0.3s",
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
            background: showSpeedMenu ? "var(--app-primary)" : "#F0ECE6",
            color: showSpeedMenu ? "#fff" : "var(--app-primary)",
            border:"none", borderRadius:"8px",
            padding: isMobile ? "8px 12px" : "3px 7px",
            cursor:"pointer", fontSize: isMobile ? "14px" : "11px", fontWeight:"700",
            fontFamily:"monospace", transition:"all 0.15s",
            WebkitTapHighlightColor:"transparent",
          }}
        >
          {speed}×
        </button>

        {showSpeedMenu && (<>
          {/* Overlay para cerrar en móvil */}
          {isMobile && <div onClick={() => setShowSpeedMenu(false)} style={{ position:"fixed", inset:0, zIndex:99 }} />}
          <div style={{
            position:"absolute",
            bottom: isMobile ? "auto" : "110%",
            top: isMobile ? "110%" : "auto",
            right: isMobile ? 0 : "auto",
            left: isMobile ? "auto" : "50%",
            transform: isMobile ? "none" : "translateX(-50%)",
            background:"#fff", borderRadius:"12px", boxShadow:"0 8px 30px rgba(0,0,0,0.25)",
            padding:"8px", zIndex:100, minWidth: isMobile ? "80px" : "60px",
            border:"1px solid #E0D8CE",
          }}>
            {SPEED_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeSpeed(opt.value)}
                style={{
                  display:"block", width:"100%", textAlign:"center",
                  padding: isMobile ? "12px 14px" : "6px 10px",
                  border:"none", borderRadius:"8px",
                  cursor:"pointer", fontSize: isMobile ? "15px" : "12px", fontWeight:"600",
                  fontFamily:"monospace",
                  background: speed === opt.value ? "var(--app-primary)" : "transparent",
                  color: speed === opt.value ? "#fff" : "#333",
                  transition:"all 0.1s",
                  WebkitTapHighlightColor:"transparent",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>)}
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
