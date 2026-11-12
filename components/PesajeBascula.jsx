"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ── Pesaje guiado con báscula SAT CS30 (cable USB-serial CH340) ──────────────
// Protocolo comprobado (9600 8N1): se envía "W" y la báscula responde
//   "\n00.290kg\r\nS00"  → peso neto en kg + estado S<d1><d2>
//   d1: 0 = quieta con peso · 1 = moviéndose · 2 = en cero quieta · 3 = en cero moviéndose
//   Mientras se mueve manda 0.000: esas lecturas NO se usan como peso.
// Conexión:
//   - Computador (Chrome/Edge): Web Serial (el chip ya tiene driver del sistema).
//   - Android (Chrome): WebUSB con driver CH340 propio (Web Serial en Android no lista estos cables).

const C = { navy: "var(--app-primary, #1B3A5C)", gold: "#D4721A", line: "#E0D8CE", cream: "#FDFAF6", ink: "#3a2f29", ok: "#1e8e4e", bad: "#c0392b" };
const fmt = (v) => Math.round(v).toLocaleString("es-CO");
const HIST_KEY = "calcpan_pesajes_v1";
export const GRAMERA_MAX = 100; // la SAT CS30 no es confiable debajo de 100 g (Min 100 g, e = 5 g)
export const tolFor = (t) => Math.max(5, Math.round((t * 0.005) / 5) * 5); // ±0,5 %, nunca menos de 5 g

const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "");

// ── parser de tramas ──
// "W"        → "\n00.290kg\r\nS00"  (mientras se mueve manda 0.000: no sirve como peso)
// ENQ + DC1  → "\x01\x02U 0.325KG?\x03\x04"  (S = quieta, U = moviéndose, CON el peso: se ve subir en vivo)
const FRAME_W = /(-?\s*\d+(?:\.\d+)?)\s*kg[^S\x02]*S(\d)(\d)/;
const FRAME_LIVE = /\x02([SU])\s*(-?\d+(?:\.\d+)?)\s*KG/;
export function parseFrames(text) {
  const out = [];
  let rest = text;
  for (;;) {
    const a = FRAME_W.exec(rest), b = FRAME_LIVE.exec(rest);
    const m = a && (!b || a.index <= b.index) ? a : b;
    if (!m) break;
    if (m === a) {
      const kg = parseFloat(a[1].replace(/\s+/g, ""));
      const d1 = parseInt(a[2], 10);
      out.push({ g: Math.round(kg * 1000), motion: (d1 & 1) === 1, zero: (d1 & 2) === 2, live: false });
    } else {
      const g = Math.round(parseFloat(b[2]) * 1000);
      out.push({ g, motion: b[1] === "U", zero: g === 0, live: true });
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return { frames: out, rest: rest.slice(-200) };
}

// ── transporte Web Serial (computador) ──
async function openSerial(port) {
  await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
  try { await port.setSignals({ dataTerminalReady: true, requestToSend: true }); } catch { /* opcional */ }
  const writer = port.writable.getWriter();
  let reader = null, closed = false;
  return {
    kind: "serial",
    write: (bytes) => writer.write(bytes),
    async read(onChunk) {
      while (!closed && port.readable) {
        reader = port.readable.getReader();
        try {
          for (;;) { const { value, done } = await reader.read(); if (done) break; if (value) onChunk(value); }
        } catch { /* se corta al cerrar o desconectar */ } finally { try { reader.releaseLock(); } catch { /* */ } }
        if (closed) break;
      }
    },
    async close() {
      closed = true;
      try { await reader?.cancel(); } catch { /* */ }
      try { writer.releaseLock(); } catch { /* */ }
      try { await port.close(); } catch { /* */ }
    },
  };
}

// ── transporte WebUSB con driver CH340 (Android) ──
// Secuencia de inicio tomada de usb-serial-for-android (Ch34xSerialDriver).
async function openCh340(dev) {
  await dev.open();
  if (dev.configuration === null) await dev.selectConfiguration(1);
  const iface = dev.configuration.interfaces[0];
  await dev.claimInterface(iface.interfaceNumber);
  const eps = iface.alternate.endpoints;
  const epIn = eps.find(e => e.direction === "in" && e.type === "bulk")?.endpointNumber ?? 2;
  const epOut = eps.find(e => e.direction === "out" && e.type === "bulk")?.endpointNumber ?? 2;
  const out = (request, value, index = 0) => dev.controlTransferOut({ requestType: "vendor", recipient: "device", request, value: value & 0xffff, index: index & 0xffff });
  const inp = (request, value, index = 0) => dev.controlTransferIn({ requestType: "vendor", recipient: "device", request, value, index }, 2);
  const setBaud = async (baud) => {
    let factor = Math.floor(1532620800 / baud), divisor = 3;
    while (factor > 0xfff0 && divisor > 0) { factor >>= 3; divisor--; }
    factor = 0x10000 - factor;
    divisor |= 0x0080;
    await out(0x9a, 0x1312, (factor & 0xff00) | divisor);
    await out(0x9a, 0x0f2c, factor & 0xff);
  };
  await inp(0x5f, 0);
  await out(0xa1, 0, 0);
  await setBaud(9600);
  await inp(0x95, 0x2518);
  await out(0x9a, 0x2518, 0x00c3); // RX + TX + 8 bits
  await inp(0x95, 0x0706);
  await out(0xa1, 0x501f, 0xd90a);
  await setBaud(9600);
  await out(0xa4, ~(0x20 | 0x40)); // DTR + RTS activos
  let closed = false;
  return {
    kind: "usb",
    write: (bytes) => dev.transferOut(epOut, bytes),
    async read(onChunk) {
      while (!closed) {
        try {
          const r = await dev.transferIn(epIn, 64);
          if (r.data && r.data.byteLength) onChunk(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength));
        } catch { if (closed) break; await new Promise(res => setTimeout(res, 200)); if (!dev.opened) break; }
      }
    },
    async close() {
      closed = true;
      try { await dev.releaseInterface(iface.interfaceNumber); } catch { /* */ }
      try { await dev.close(); } catch { /* */ }
    },
  };
}

const USB_FILTERS = [{ vendorId: 0x1a86 }]; // QinHeng CH340/CH341

function beep(ok = true) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = beep.ctx || (beep.ctx = new Ctx());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = ok ? 880 : 300; g.gain.value = 0.15;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.15 : 0.35));
  } catch { /* sin audio */ }
  try { navigator.vibrate?.(ok ? 120 : [80, 60, 80]); } catch { /* */ }
}

// ── Conexión con la báscula (compartida por el pesaje guiado y el pesaje en la lista de la receta) ──
export function useBascula() {
  const [conn, setConn] = useState("off"); // off | connecting | on | sim | error
  const [err, setErr] = useState("");
  const [reading, setReading] = useState(null); // { g, motion, zero, at }
  const [moving, setMoving] = useState(false);
  const [simG, setSimG] = useState(0);
  const [now, setNow] = useState(Date.now());
  const tr = useRef(null);
  const buf = useRef("");
  const poll = useRef(null);
  const tryRef = useRef(0); // cada intento de conexion; uno viejo no pisa el estado de uno nuevo

  const onFrame = useCallback((f) => {
    setMoving(f.motion);
    if (f.motion && !f.live) return; // el formato "W" manda 0 mientras se mueve: se ignora ese peso
    setReading({ ...f, at: Date.now() });
  }, []);

  const disconnect = useCallback(async () => {
    clearInterval(poll.current); poll.current = null;
    const t = tr.current; tr.current = null;
    if (t) await t.close();
  }, []);

  const start = useCallback(async (t) => {
    tr.current = t;
    buf.current = "";
    const dec = new TextDecoder("latin1");
    t.read(chunk => {
      buf.current += dec.decode(chunk);
      const { frames, rest } = parseFrames(buf.current);
      buf.current = rest;
      frames.forEach(onFrame);
    }).then(() => { if (tr.current === t) { setConn("error"); setErr("Se desconectó la pesa."); clearInterval(poll.current); } });
    const W = new Uint8Array([0x57]);
    // se alternan los dos pedidos: "W" (estado rápido) y ENQ+DC1 (peso en vivo mientras se mueve)
    const ENQ = new Uint8Array([0x05]), DC1 = new Uint8Array([0x11]);
    let tick = 0;
    poll.current = setInterval(() => {
      const t = tr.current; if (!t) return;
      if (tick++ % 2 === 0) t.write(W).catch(() => {});
      else { t.write(ENQ).catch(() => {}); setTimeout(() => tr.current?.write(DC1).catch(() => {}), 60); }
    }, 350);
    setConn("on"); setErr("");
  }, [onFrame]);

  const connect = useCallback(async (mode, silent = false) => {
    const my = ++tryRef.current;
    const live = () => my === tryRef.current;
    setConn("connecting"); setErr("");
    try {
      await disconnect();
      let useUsb = mode === "usb" || (mode !== "serial" && (isAndroid() || !("serial" in navigator)));
      if (useUsb && !("usb" in navigator)) useUsb = false;
      if (useUsb) {
        let dev = (await navigator.usb.getDevices()).find(d => d.vendorId === 0x1a86);
        if (!dev) { if (silent) { if (live()) setConn("off"); return; } dev = await navigator.usb.requestDevice({ filters: USB_FILTERS }); }
        const t = await openCh340(dev);
        if (!live()) { t.close(); return; }
        await start(t);
      } else if ("serial" in navigator) {
        let port = (await navigator.serial.getPorts())[0];
        if (!port) { if (silent) { if (live()) setConn("off"); return; } port = await navigator.serial.requestPort(); }
        const t = await openSerial(port);
        if (!live()) { t.close(); return; }
        await start(t);
      } else {
        if (!live()) return;
        setConn("error");
        setErr("Este navegador no puede leer la pesa. Usá Chrome en un computador o en Android (en iPad no se puede).");
      }
    } catch (e) {
      if (!live()) return;
      setConn(silent ? "off" : "error");
      if (!silent) setErr(e?.name === "NotFoundError" ? "No elegiste la pesa." : `No se pudo conectar: ${e?.message || e}`);
    }
  }, [disconnect, start]);

  const startSim = useCallback(() => { tryRef.current++; disconnect(); setConn("sim"); setErr(""); }, [disconnect]);
  const stop = useCallback(async () => { tryRef.current++; await disconnect(); setConn("off"); setReading(null); }, [disconnect]);

  // reconectar solo si ya se dio permiso antes
  useEffect(() => { connect("auto", true); return () => { tryRef.current++; disconnect(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  // modo prueba sin pesa
  useEffect(() => { if (conn === "sim") setReading({ g: simG, motion: false, zero: simG === 0, at: Date.now() }); }, [simG, conn]);

  const live = conn === "on" || conn === "sim";
  const stale = conn === "on" && (!reading || now - reading.at > 2500) && !moving;
  const scaleG = reading ? reading.g : 0;
  const stable = !!(live && reading && !moving && !stale);
  return { conn, err, live, stale, moving, stable, scaleG, reading, connect, disconnect, startSim, stop, simG, setSimG };
}

export function BasculaStatus({ b, compact = false }) {
  const smallBtn = { border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, borderRadius: 10, padding: "7px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", font: "inherit" };
  const chip = b.conn === "on" ? (b.stale ? { t: "⚠️ Sin señal de la pesa", c: C.bad } : b.moving ? { t: "⏳ Pesa moviéndose…", c: "#b7791f" } : { t: "🟢 Pesa conectada", c: C.ok })
    : b.conn === "sim" ? { t: "🧪 Modo prueba (sin pesa)", c: "#6b46c1" }
    : b.conn === "connecting" ? { t: "Conectando…", c: "#8a7a6e" } : { t: "⚪ Pesa sin conectar", c: "#8a7a6e" };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: compact ? "6px 0" : "8px 14px", background: compact ? "transparent" : C.cream, borderBottom: compact ? "none" : `1px solid ${C.line}` }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: chip.c, flex: 1, minWidth: 120 }}>{chip.t}</span>
        {b.conn !== "on" && b.conn !== "connecting" && (
          <button style={{ ...smallBtn, background: C.gold, borderColor: C.gold, color: "#fff" }} onClick={() => b.connect("auto")}>🔌 Conectar pesa</button>
        )}
        {b.conn === "on" && <button style={smallBtn} onClick={b.stop}>Desconectar</button>}
        {b.conn !== "sim" && b.conn !== "on" && <button style={smallBtn} onClick={b.startSim}>🧪 Probar sin pesa</button>}
      </div>
      {b.err && <div style={{ padding: "8px 14px", background: "#FDECEA", color: "#8e2b20", fontSize: 13, fontWeight: 600, borderRadius: compact ? 8 : 0 }}>{b.err}
        {b.conn === "error" && (
          <span> · <button style={{ ...smallBtn, padding: "3px 8px", fontSize: 12 }} onClick={() => b.connect(isAndroid() ? "serial" : "usb")}>Probar otro modo de conexión</button></span>
        )}
      </div>}
    </>
  );
}

export function PesajeBascula({ title, subtitle, items, onClose }) {
  const b = useBascula();
  const { conn, live, stale, moving, stable, scaleG, connect, disconnect, simG, setSimG } = b;
  const [base, setBase] = useState(0);
  const [idx, setIdx] = useState(0);
  const [res, setRes] = useState(() => items.map(() => null)); // { actual, how }
  const [forceScale, setForceScale] = useState({}); // ingredientes chicos que se quieren pesar igual en la báscula
  const wasOk = useRef(false);

  const done = idx >= items.length;
  const item = items[idx];
  const cur = scaleG - base;
  // manual: lo que no se pesa (litros, unidades): solo se mide/cuenta y se marca
  const manual = !!(item && item.manual);
  const small = !!item && !manual && item.grams < GRAMERA_MAX && !forceScale[idx];
  const target = item && !manual ? item.grams : 0;
  const tol = tolFor(target);
  const diff = cur - target;
  const inRange = stable && Math.abs(diff) <= tol;

  useEffect(() => {
    if (!item || small || manual) { wasOk.current = false; return; }
    if (inRange && !wasOk.current) beep(true);
    wasOk.current = inRange;
  }, [inRange, item, small, manual]);

  const commit = (actual, how) => {
    setRes(r => r.map((x, k) => k === idx ? { actual, how } : x));
    if (how === "scale") setBase(scaleG); // el siguiente ingrediente arranca desde acá (mismo tazón)
    setIdx(i => i + 1);
  };
  const zeroHere = () => setBase(scaleG);
  const goBack = () => { if (idx > 0) { setIdx(i => i - 1); setBase(scaleG); } };

  // guardar historial al terminar
  const saved = useRef(false);
  useEffect(() => {
    if (!done || saved.current) return;
    saved.current = true;
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      h.unshift({ at: new Date().toISOString(), title, subtitle, items: items.map((it, k) => ({ name: it.name, meta: it.manual || it.grams, real: res[k]?.actual ?? null, how: res[k]?.how ?? "salteado" })) });
      localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 60)));
    } catch { /* */ }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI ──
  const big = { fontFamily: "'Poppins',sans-serif", fontWeight: 800, lineHeight: 1 };
  const bigBtn = { border: "none", borderRadius: 14, padding: "16px 14px", fontSize: 18, fontWeight: 800, cursor: "pointer", font: "inherit", width: "100%" };
  const smallBtn = { border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, borderRadius: 10, padding: "9px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", font: "inherit" };
  const dim = (off) => (off ? { opacity: 0.4, cursor: "not-allowed" } : null);

  let color = "#9a8a7e", msg = "";
  if (item && !small && !manual && live) {
    if (!stable) { msg = moving ? "Esperá que la pesa se quede quieta…" : ""; }
    else if (inRange) { color = C.ok; msg = diff === 0 ? "✅ Exacto" : `✅ Bien (${diff > 0 ? "+" : ""}${fmt(diff)} g)`; }
    else if (diff < 0) { color = C.gold; msg = `Faltan ${fmt(-diff)} g`; }
    else { color = C.bad; msg = `❌ Te pasaste: sacá ${fmt(diff)} g`; }
  }
  const pct = target > 0 ? Math.max(0, Math.min(1.15, cur / target)) : 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#fff", display: "flex", flexDirection: "column", fontFamily: "'Poppins',sans-serif", color: C.ink }}>
      {/* encabezado */}
      <div style={{ background: C.navy, color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>⚖️ {title}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{subtitle}</div>
        </div>
        <button onClick={async () => { await disconnect(); onClose(); }} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 40, height: 40, fontSize: 22, cursor: "pointer" }} title="Cerrar">×</button>
      </div>

      <BasculaStatus b={b} />

      {/* progreso */}
      <div style={{ display: "flex", gap: 3, padding: "8px 14px 0" }}>
        {items.map((_, k) => {
          const r = res[k];
          const bg = k === idx ? C.navy : r ? (r.how === "salteado" ? "#d9d2c9" : C.ok) : "#eee6dc";
          return <div key={k} style={{ flex: 1, height: 6, borderRadius: 3, background: bg }} />;
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 16px" }}>
        {!done && item && (<>
          <div style={{ fontSize: 12, color: "#8a7a6e", fontWeight: 700 }}>INGREDIENTE {idx + 1} DE {items.length}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.navy, lineHeight: 1.15, margin: "2px 0 2px" }}>{item.name}</div>
          {item.note && <div style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{item.note}</div>}

          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 10 }}>
            <span style={{ fontSize: 13, color: "#8a7a6e", fontWeight: 700 }}>META</span>
            <span style={{ ...big, fontSize: 30, color: C.ink }}>{manual ? item.manual : `${fmt(target)} g`}</span>
            {!small && !manual && <span style={{ fontSize: 13, color: "#8a7a6e" }}>± {tol} g</span>}
          </div>

          {manual ? (
            <div style={{ marginTop: 14, padding: 14, border: `2px dashed ${C.navy}`, borderRadius: 14, background: "#F4F7FB" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>📏 Medir o contar</div>
              <div style={{ fontSize: 13, margin: "6px 0 12px" }}>Esto no se pesa en la pesa (va en litros o unidades). Medilo o contalo y marcalo.</div>
              <button style={{ ...bigBtn, background: C.ok, color: "#fff" }} onClick={() => commit(null, "manual")}>✓ Listo</button>
            </div>
          ) : small ? (
            <div style={{ marginTop: 14, padding: 14, border: `2px dashed ${C.gold}`, borderRadius: 14, background: "#FBEFE3" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.gold }}>🥄 Pesar en la gramera</div>
              <div style={{ fontSize: 13, margin: "6px 0 12px" }}>Es menos de {GRAMERA_MAX} g: esta pesa marca de a 5 g y no es exacta acá. Pesalo en la gramera y marcalo.</div>
              <button style={{ ...bigBtn, background: C.ok, color: "#fff" }} onClick={() => commit(target, "gramera")}>✓ Ya lo pesé en la gramera</button>
              <button style={{ ...smallBtn, marginTop: 8, width: "100%" }} onClick={() => setForceScale(f => ({ ...f, [idx]: true }))}>Pesarlo igual en esta pesa</button>
            </div>
          ) : (<>
            {/* lectura */}
            <div style={{ marginTop: 12, borderRadius: 16, border: `3px solid ${color}`, padding: "14px 14px 12px", textAlign: "center", background: inRange ? "#E9F7EF" : "#fff", transition: "background .2s" }}>
              <div style={{ fontSize: 12, color: "#8a7a6e", fontWeight: 700 }}>EN LA PESA (este ingrediente)</div>
              <div style={{ ...big, fontSize: 64, color, opacity: live && !moving ? 1 : 0.45 }}>
                {live ? `${fmt(cur)} g` : "— g"}
              </div>
              <div style={{ minHeight: 24, fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{msg}</div>
              <div style={{ position: "relative", height: 18, background: "#f0ebe5", borderRadius: 9, overflow: "hidden", marginTop: 8 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(pct / 1.15) * 100}%`, background: color, transition: "width .25s" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(1 / 1.15) * 100}%`, width: 3, background: C.ink }} title="meta" />
              </div>
              {base !== 0 && live && <div style={{ fontSize: 11, color: "#8a7a6e", marginTop: 6 }}>La pesa marca {fmt(scaleG)} g en total · cero del sistema en {fmt(base)} g</div>}
            </div>

            {conn === "sim" && (
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6b46c1", fontWeight: 700 }}>Simular:</span>
                {[-100, -5, 5, 50, 500, 5000].map(d => <button key={d} style={smallBtn} onClick={() => setSimG(g => Math.max(0, g + d))}>{d > 0 ? "+" : ""}{d}</button>)}
                <button style={smallBtn} onClick={() => setSimG(base + target)}>= meta</button>
              </div>
            )}

            <button disabled={!inRange} style={{ ...bigBtn, marginTop: 14, background: inRange ? C.ok : "#d9d2c9", color: "#fff", cursor: inRange ? "pointer" : "not-allowed" }} onClick={() => commit(cur, "scale")}>
              {inRange ? "✓ Listo, siguiente" : "Siguiente (cuando esté en verde)"}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <button style={{ ...smallBtn, ...dim(!stable) }} disabled={!stable} onClick={zeroHere} title="Usalo al cambiar de recipiente: pone en cero lo que hay en la pesa">⓪ Cero aquí (otro recipiente)</button>
              <button style={{ ...smallBtn, ...dim(!stable || inRange) }} disabled={!stable || inRange} onClick={() => { beep(false); commit(cur, "aceptado"); }}>Aceptar así ({stable ? fmt(cur) : "—"} g)</button>
              <button style={{ ...smallBtn, ...dim(idx === 0) }} disabled={idx === 0} onClick={goBack}>← Anterior</button>
              <button style={smallBtn} onClick={() => commit(null, "salteado")}>Saltar →</button>
            </div>
            <p style={{ fontSize: 12, color: "#8a7a6e", marginTop: 10, lineHeight: 1.45 }}>
              Podés seguir echando en el <b>mismo tazón</b>: al tocar “Listo” el sistema toma ese peso como nuevo cero. Si cambiás de recipiente, poné el recipiente vacío y tocá <b>Cero aquí</b> (no hace falta tocar la pesa).
            </p>
          </>)}
        </>)}

        {done && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.ok, margin: "6px 0 10px" }}>✅ Pesaje terminado</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
              <thead><tr>{["Ingrediente", "Meta", "Real", "Dif."].map((h, k) => <th key={h} style={{ textAlign: k ? "right" : "left", fontSize: 11, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {items.map((it, k) => {
                  const r = res[k];
                  const d = r && r.actual != null ? r.actual - it.grams : null;
                  const bad = d != null && r.how !== "gramera" && Math.abs(d) > tolFor(it.grams);
                  return (
                    <tr key={k}>
                      <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", fontWeight: 600 }}>{it.name}{r?.how === "gramera" && <span style={{ fontSize: 11, color: C.gold }}> · gramera</span>}</td>
                      <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "right" }}>{it.manual || fmt(it.grams)}</td>
                      <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "right", fontWeight: 700 }}>{r?.actual != null ? fmt(r.actual) : "—"}</td>
                      <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "right", fontWeight: 700, color: r?.how === "salteado" ? "#9a8a7e" : bad ? C.bad : C.ok }}>
                        {r?.how === "salteado" ? "saltado" : !r ? "—" : d == null || r.how === "gramera" ? "✓" : `${d > 0 ? "+" : ""}${fmt(d)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
              <button style={smallBtn} onClick={() => { setIdx(0); setBase(scaleG); setRes(items.map(() => null)); saved.current = false; }}>↺ Pesar otra vez</button>
              <button style={{ ...smallBtn, background: C.navy, borderColor: C.navy, color: "#fff" }} onClick={async () => { await disconnect(); onClose(); }}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
