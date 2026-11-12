"use client";

const DEFAULT_LOGO = "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png";

export function Watermark({ username, customLogo, opacity }) {
  const logo = customLogo || DEFAULT_LOGO;
  return (
    <div style={{
      position:"absolute", inset:0, overflow:"hidden",
      pointerEvents:"none", zIndex:5,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <img
        src={logo}
        alt=""
        style={{
          width:"45%",
          maxWidth:"800px",
          height:"auto",
          objectFit:"contain",
          opacity: opacity ?? 0.07,
          userSelect:"none",
          WebkitUserSelect:"none",
        }}
      />
    </div>
  );
}

// Marca de agua global (rediseño): fija, centrada al 54 %, DETRÁS del contenido (z-index 0).
// Logo circular + "DON TELMO" + "— 1958 —". Las tarjetas son semitransparentes para que se intuya detrás.
export function GlobalWatermark({ username, sede, customLogo, opacity, size }) {
  const logo = customLogo || DEFAULT_LOGO;
  return (
    <div aria-hidden="true" style={{
      position: "fixed", left: "50%", top: "54%", transform: "translate(-50%,-50%)",
      width: "min(78vw, 720px)", pointerEvents: "none", zIndex: 0,
      userSelect: "none", WebkitUserSelect: "none",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <img src={logo} alt="" style={{ width: "62%", height: "auto", objectFit: "contain", opacity: opacity != null ? Math.min(0.3, opacity * 1.25) : 0.075, mixBlendMode: "multiply" }} />
      <span style={{ fontFamily: "var(--dt-serif, Newsreader, Georgia, serif)", fontWeight: 700, fontSize: "min(13vw, 128px)", lineHeight: 1, color: "#0E2240", opacity: 0.045, letterSpacing: ".02em", whiteSpace: "nowrap", marginTop: "-2%" }}>DON TELMO</span>
      <span style={{ fontFamily: "var(--dt-serif, Newsreader, Georgia, serif)", fontWeight: 600, fontSize: "min(4vw, 34px)", color: "#D9731A", opacity: 0.09, letterSpacing: ".2em", marginTop: 6 }}>— 1958 —</span>
    </div>
  );
}
