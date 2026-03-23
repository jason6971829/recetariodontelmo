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
