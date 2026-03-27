"use client";

const DEFAULT_LOGO = "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/branding/watermark-logo.png";

export function Watermark({ username }) {
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:5 }}>
      {Array.from({length:6}).map((_,i) => (
        <div key={i} style={{
          position:"absolute",
          top:`${(i % 3)*35 + 5}%`,
          left:`${Math.floor(i/3)*50 + 10}%`,
          transform:"rotate(-25deg)",
          opacity: 0.06,
          userSelect:"none",
        }}>
          <img src={DEFAULT_LOGO} alt="" style={{ width:"120px", height:"120px", objectFit:"contain" }} />
        </div>
      ))}
    </div>
  );
}

// Marca de agua global con logo que cubre toda la pantalla
export function GlobalWatermark({ username, sede }) {
  const rows = 5;
  const cols = 4;

  return (
    <div style={{
      position:"fixed", inset:0, overflow:"hidden",
      pointerEvents:"none", zIndex:9990,
      userSelect:"none", WebkitUserSelect:"none",
    }}>
      {Array.from({ length: rows * cols }).map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return (
          <div key={i} style={{
            position:"absolute",
            top: `${(row / rows) * 100 + 2}%`,
            left: `${(col / cols) * 100}%`,
            transform: "rotate(-25deg)",
            opacity: 0.04,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}>
            <img src={DEFAULT_LOGO} alt="" style={{ width:"100px", height:"100px", objectFit:"contain" }} />
          </div>
        );
      })}
    </div>
  );
}
