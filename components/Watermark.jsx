"use client";

export function Watermark({ username }) {
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:5 }}>
      {Array.from({length:18}).map((_,i) => (
        <div key={i} style={{
          position:"absolute",
          top:`${(i % 6)*18}%`,
          left:`${Math.floor(i/6)*38 - 10}%`,
          transform:"rotate(-35deg)",
          fontSize:"12px", fontWeight:"700",
          color:"rgba(180,100,20,0.09)",
          whiteSpace:"nowrap", letterSpacing:"2px",
          fontFamily:"Georgia,serif", userSelect:"none"
        }}>DON TELMO • {username.toUpperCase()}</div>
      ))}
    </div>
  );
}

// Marca de agua global que cubre toda la pantalla - más visible para disuadir capturas
export function GlobalWatermark({ username, sede }) {
  const text = `CONFIDENCIAL • ${username.toUpperCase()}${sede ? ` • ${sede.toUpperCase()}` : ""} • DON TELMO®`;
  const rows = 12;
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
            top: `${(row / rows) * 100}%`,
            left: `${(col / cols) * 100 - 15}%`,
            transform: "rotate(-30deg)",
            fontSize: "13px",
            fontWeight: "700",
            color: "rgba(27,58,92,0.06)",
            whiteSpace: "nowrap",
            letterSpacing: "3px",
            fontFamily: "Georgia,serif",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}>
            {text}
          </div>
        );
      })}
    </div>
  );
}
