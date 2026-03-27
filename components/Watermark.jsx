"use client";

const DEFAULT_LOGO = "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png";

export function Watermark({ username }) {
  return (
    <div style={{
      position:"absolute", inset:0, overflow:"hidden",
      pointerEvents:"none", zIndex:5,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <img
        src={DEFAULT_LOGO}
        alt=""
        style={{
          width:"45%",
          maxWidth:"800px",
          height:"auto",
          objectFit:"contain",
          opacity: 0.07,
          userSelect:"none",
          WebkitUserSelect:"none",
        }}
      />
    </div>
  );
}

// Marca de agua global — un solo logo grande centrado
export function GlobalWatermark({ username, sede }) {
  return (
    <div style={{
      position:"fixed", inset:0, overflow:"hidden",
      pointerEvents:"none", zIndex:9990,
      userSelect:"none", WebkitUserSelect:"none",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <img
        src={DEFAULT_LOGO}
        alt=""
        style={{
          width:"45vw",
          maxWidth:"800px",
          height:"auto",
          objectFit:"contain",
          opacity: 0.06,
          userSelect:"none",
          WebkitUserSelect:"none",
        }}
      />
    </div>
  );
}
