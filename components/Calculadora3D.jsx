"use client";
import { useState, useEffect } from "react";

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

const fmt = (n, dec = 1) => (isFinite(n) && n > 0 ? n.toFixed(dec) : "—");

const PRESETS = [
  { label: "PLA básico",   filamento: 57000, electricidad: 1150 },
  { label: "PETG",         filamento: 72000, electricidad: 1150 },
  { label: "ABS/ASA",      filamento: 65000, electricidad: 1150 },
  { label: "TPU flexible", filamento: 95000, electricidad: 1150 },
];

const PRINTER_PRESETS = [
  { label: "Bambu A1",      watts: 95 },
  { label: "Bambu A1 Mini", watts: 70 },
  { label: "Bambu P1S",     watts: 120 },
  { label: "Bambu X1C",     watts: 140 },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
  .calc3d-root * { box-sizing: border-box; }
  .calc3d-root .input-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #1e1e1e; }
  .calc3d-root .input-label { flex:1; font-size:12px; color:#888; letter-spacing:0.05em; text-transform:uppercase; line-height:1.4; }
  .calc3d-root .input-label small { display:block; font-size:10px; color:#444; text-transform:none; letter-spacing:0; margin-top:2px; }
  .calc3d-root .input-unit { font-size:11px; color:#555; width:56px; text-align:right; flex-shrink:0; }
  .calc3d-root input[type="number"] {
    background:#1a1a1a; border:1px solid #333; border-radius:4px;
    color:#ff9500; font-family:'Space Mono',monospace;
    font-size:14px; font-weight:700; padding:6px 10px;
    width:100px; text-align:right; transition:border-color 0.2s;
    -moz-appearance:textfield; flex-shrink:0;
  }
  .calc3d-root input[type="number"]::-webkit-outer-spin-button,
  .calc3d-root input[type="number"]::-webkit-inner-spin-button { -webkit-appearance:none; }
  .calc3d-root input[type="number"]:focus { outline:none; border-color:#ff9500; box-shadow:0 0 0 2px rgba(255,149,0,0.12); }
  .calc3d-root input[type="range"] {
    -webkit-appearance:none; width:100%; height:3px;
    background:#2a2a2a; border-radius:2px; margin:8px 0 4px;
  }
  .calc3d-root input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance:none; width:14px; height:14px;
    background:#ff9500; border-radius:50%; cursor:pointer;
  }
  .calc3d-root .result-card {
    background:#141414; border:1px solid #222; border-radius:6px;
    padding:12px 16px; margin-bottom:6px;
    display:flex; justify-content:space-between; align-items:center;
    transition:transform 0.1s,border-color 0.2s;
  }
  .calc3d-root .result-card:hover { transform:translateX(3px); border-color:#333; }
  .calc3d-root .result-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#555; }
  .calc3d-root .result-sub { font-size:10px; color:#333; margin-top:3px; }
  .calc3d-root .result-value { font-size:17px; font-weight:700; color:#e8e0d0; }
  .calc3d-root .result-total {
    background:linear-gradient(135deg,#1a1200,#2a1800);
    border:1px solid #ff9500; border-radius:6px;
    padding:16px 18px; margin-bottom:6px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .calc3d-root .result-total .result-label { color:#cc7700; font-size:11px; }
  .calc3d-root .result-total .result-value { font-size:22px; color:#ff9500; }
  .calc3d-root .result-unit {
    background:linear-gradient(135deg,#001220,#002040);
    border:1px solid #2288cc; border-radius:6px;
    padding:16px 18px; margin-bottom:6px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .calc3d-root .result-unit .result-label { color:#1a88cc; font-size:11px; }
  .calc3d-root .result-unit .result-value { font-size:22px; color:#44aaff; }
  .calc3d-root .result-venta {
    background:linear-gradient(135deg,#0a180a,#0e2a0e);
    border:1px solid #44dd44; border-radius:6px;
    padding:18px 20px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .calc3d-root .result-venta .result-label { color:#33aa33; font-size:11px; }
  .calc3d-root .result-venta .result-value { font-size:26px; color:#44dd44; }
  .calc3d-root .preset-btn {
    background:#1a1a1a; border:1px solid #2a2a2a; border-radius:4px;
    color:#777; font-family:'Space Mono',monospace; font-size:10px;
    padding:5px 10px; cursor:pointer; transition:all 0.15s; text-transform:uppercase;
  }
  .calc3d-root .preset-btn.active,
  .calc3d-root .preset-btn:hover { background:#2a1800; border-color:#ff9500; color:#ff9500; }
  .calc3d-root .printer-btn {
    background:#1a1a1a; border:1px solid #2a2a2a; border-radius:4px;
    color:#777; font-family:'Space Mono',monospace; font-size:10px;
    padding:5px 10px; cursor:pointer; transition:all 0.15s; text-transform:uppercase;
  }
  .calc3d-root .printer-btn.active,
  .calc3d-root .printer-btn:hover { background:#001a2a; border-color:#44aaff; color:#44aaff; }
  .calc3d-root .section-title {
    font-family:'Bebas Neue',sans-serif; font-size:12px;
    letter-spacing:0.2em; color:#444; text-transform:uppercase; margin:20px 0 6px;
  }
  .calc3d-root .tab-btn {
    flex:1; padding:11px 8px; border:none; cursor:pointer;
    font-family:'Space Mono',monospace; font-size:11px;
    text-transform:uppercase; letter-spacing:0.06em;
    transition:all 0.2s; border-bottom:2px solid transparent;
  }
  .calc3d-root .tab-btn.active { background:#0d0d0d; color:#ff9500; border-bottom-color:#ff9500; }
  .calc3d-root .tab-btn:not(.active) { background:#111; color:#444; }
  .calc3d-root .tab-btn:not(.active):hover { color:#777; }
  .calc3d-root .stat-pill {
    background:#141414; border:1px solid #222; border-radius:4px;
    padding:8px 10px; text-align:center; flex:1;
  }
  .calc3d-root .stat-pill-label { font-size:9px; color:#444; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
  .calc3d-root .stat-pill-value { font-size:14px; font-weight:700; color:#e8e0d0; }
  .calc3d-root .waste-bar-wrap { height:6px; background:#1a1a1a; border-radius:3px; overflow:hidden; margin:8px 0 4px; display:flex; }
  .calc3d-root .waste-bar-product { height:100%; background:#44aaff; transition:width 0.4s ease; }
  .calc3d-root .waste-bar-waste   { height:100%; background:#ff5533; transition:width 0.4s ease; }
  .calc3d-root .margin-bar  { height:4px; background:#1a1a1a; border-radius:2px; margin-top:12px; overflow:hidden; }
  .calc3d-root .margin-fill { height:100%; background:linear-gradient(90deg,#ff9500,#44dd44); border-radius:2px; transition:width 0.4s ease; }
  .calc3d-root .margin-label { font-size:10px; color:#444; margin-top:6px; display:flex; justify-content:space-between; }
  .calc3d-root .info-box {
    background:#0e1a0e; border:0.5px solid #1e3a1e; border-radius:6px;
    padding:9px 12px; margin-bottom:12px; font-size:10px; color:#3a7a3a; line-height:1.7;
  }
  .calc3d-root .info-box strong { color:#44dd44; }
  .calc3d-root .printer-box {
    background:#001a2a; border:0.5px solid #1a3a55; border-radius:6px;
    padding:8px 12px; margin:8px 0 4px; font-size:10px; color:#2a6a99; line-height:1.6;
    display:flex; align-items:center; justify-content:space-between; gap:8px;
  }
  .calc3d-root .printer-box strong { color:#44aaff; }
  @keyframes calc3dFadeUp {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .calc3d-root .animate-in { animation:calc3dFadeUp 0.3s ease forwards; }
`;

function PrinterSelector({ watts, setWatts }) {
  const [active, setActive] = useState(0);
  const apply = (i) => {
    setActive(i);
    setWatts(PRINTER_PRESETS[i].watts);
  };
  return (
    <div>
      <div className="section-title" style={{ color:"#336688" }}>🖨️ Impresora</div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
        {PRINTER_PRESETS.map((p,i) => (
          <button key={i} className={`printer-btn ${active===i?"active":""}`} onClick={() => apply(i)}>{p.label}</button>
        ))}
      </div>
      <div className="printer-box">
        <span>Consumo promedio real</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <input
            type="number" value={watts} min="10" max="500" step="5"
            onChange={e => { setActive(-1); setWatts(parseFloat(e.target.value)||95); }}
            style={{ background:"#001a2a", border:"1px solid #1a4a66", borderRadius:4, color:"#44aaff",
                     fontFamily:"'Space Mono',monospace", fontSize:13, fontWeight:700,
                     padding:"4px 8px", width:70, textAlign:"right", MozAppearance:"textfield" }}
          />
          <strong>W</strong>
        </div>
      </div>
      <div style={{ fontSize:9, color:"#1a3a4a", marginBottom:2, textAlign:"right" }}>
        Fuente: Bambu Lab Wiki oficial
      </div>
    </div>
  );
}

function IndividualTab() {
  const [watts, setWatts] = useState(95);
  const [inputs, setInputs] = useState({
    peso:50, tiempo:2, filamento:57000, electricidad:1150,
    desperdicio:5, mantenimiento:200, multiplicador:4,
  });
  const [results, setResults] = useState({});
  const [activePreset, setActivePreset] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const set = (k,v) => setInputs(p => ({ ...p, [k]: parseFloat(v)||0 }));

  useEffect(() => {
    const kw = watts / 1000;
    const costoMaterial    = (inputs.peso/1000)*inputs.filamento;
    const costoEnergia     = inputs.tiempo * kw * inputs.electricidad;
    const costoBase        = costoMaterial + costoEnergia + inputs.mantenimiento;
    const costoDesperdicio = costoBase*(inputs.desperdicio/100);
    const costoTotal       = costoBase + costoDesperdicio;
    const precioVenta      = costoTotal * inputs.multiplicador;
    setResults({ costoMaterial, costoEnergia, costoDesperdicio, costoTotal, precioVenta });
    setAnimKey(k => k+1);
  }, [inputs, watts]);

  const applyPreset = (i) => {
    setActivePreset(i);
    setInputs(p => ({ ...p, filamento:PRESETS[i].filamento, electricidad:PRESETS[i].electricidad }));
  };

  return (
    <div>
      <PrinterSelector watts={watts} setWatts={setWatts} />
      <div className="section-title">Material</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        {PRESETS.map((p,i) => (
          <button key={i} className={`preset-btn ${activePreset===i?"active":""}`} onClick={() => applyPreset(i)}>{p.label}</button>
        ))}
      </div>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:8, padding:"4px 16px 14px" }}>
        <div className="section-title" style={{ marginTop:14 }}>Parámetros de impresión</div>
        <div className="input-row">
          <span className="input-label">Peso de la pieza<small>Desde Bambu Studio</small></span>
          <input type="number" value={inputs.peso} onChange={e => set("peso",e.target.value)} min="0" />
          <span className="input-unit">g</span>
        </div>
        <div className="input-row">
          <span className="input-label">Tiempo de impresión</span>
          <input type="number" value={inputs.tiempo} onChange={e => set("tiempo",e.target.value)} step="0.5" min="0" />
          <span className="input-unit">h</span>
        </div>
        <div className="section-title">Costos base</div>
        <div className="input-row">
          <span className="input-label">Filamento por rollo (1 kg)</span>
          <input type="number" value={inputs.filamento} onChange={e => { set("filamento",e.target.value); setActivePreset(-1); }} min="0" />
          <span className="input-unit">COP</span>
        </div>
        <div className="input-row">
          <span className="input-label">Electricidad — Estrato 6</span>
          <input type="number" value={inputs.electricidad} onChange={e => set("electricidad",e.target.value)} min="0" />
          <span className="input-unit">COP/kWh</span>
        </div>
        <div className="input-row">
          <span className="input-label">Mantenimiento por pieza</span>
          <input type="number" value={inputs.mantenimiento} onChange={e => set("mantenimiento",e.target.value)} min="0" />
          <span className="input-unit">COP</span>
        </div>
        <div className="section-title">Ajustes</div>
        <div style={{ padding:"8px 0 10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span className="input-label" style={{ fontSize:11 }}>Margen de desperdicio</span>
            <span style={{ color:"#ff9500", fontWeight:700, fontSize:13 }}>{inputs.desperdicio}%</span>
          </div>
          <input type="range" min="0" max="30" step="1" value={inputs.desperdicio} onChange={e => set("desperdicio",e.target.value)} />
          <div style={{ fontSize:10, color:"#333", display:"flex", justifyContent:"space-between" }}><span>0%</span><span>15%</span><span>30%</span></div>
        </div>
        <div style={{ padding:"4px 0 8px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span className="input-label" style={{ fontSize:11 }}>Multiplicador de venta</span>
            <span style={{ color:"#44dd44", fontWeight:700, fontSize:13 }}>{inputs.multiplicador}x</span>
          </div>
          <input type="range" min="1" max="10" step="0.5" value={inputs.multiplicador} onChange={e => set("multiplicador",e.target.value)} />
          <div style={{ fontSize:10, color:"#333", display:"flex", justifyContent:"space-between" }}><span>1x</span><span>5x</span><span>10x</span></div>
        </div>
      </div>
      <div className="section-title">Resultados</div>
      <div key={animKey} className="animate-in">
        <div className="result-card">
          <div><div className="result-label">Costo de Material</div><div className="result-sub">{inputs.peso}g × ${(inputs.filamento/1000).toFixed(0)}/g</div></div>
          <div className="result-value">{formatCOP(results.costoMaterial||0)}</div>
        </div>
        <div className="result-card">
          <div><div className="result-label">Costo de Energía</div><div className="result-sub">{inputs.tiempo}h × {watts}W × ${inputs.electricidad}/kWh</div></div>
          <div className="result-value">{formatCOP(results.costoEnergia||0)}</div>
        </div>
        <div className="result-card">
          <div><div className="result-label">Mantenimiento</div><div className="result-sub">Valor fijo por pieza</div></div>
          <div className="result-value">{formatCOP(inputs.mantenimiento)}</div>
        </div>
        <div className="result-card">
          <div><div className="result-label">Costo de Desperdicio</div><div className="result-sub">{inputs.desperdicio}% sobre costo base</div></div>
          <div className="result-value">{formatCOP(results.costoDesperdicio||0)}</div>
        </div>
        <div style={{ borderTop:"1px solid #1e1e1e", margin:"10px 0 6px" }} />
        <div className="result-total">
          <div><div className="result-label">COSTO TOTAL DE PRODUCCIÓN</div></div>
          <div className="result-value">{formatCOP(results.costoTotal||0)}</div>
        </div>
        <div className="result-venta">
          <div><div className="result-label">PRECIO DE VENTA SUGERIDO ({inputs.multiplicador}x)</div></div>
          <div className="result-value">{formatCOP(results.precioVenta||0)}</div>
        </div>
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:8, padding:"14px 16px", marginTop:8 }}>
          <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Margen bruto sobre venta</div>
          <div className="margin-bar"><div className="margin-fill" style={{ width:`${Math.min(((results.precioVenta-results.costoTotal)/(results.precioVenta||1))*100,100)}%` }} /></div>
          <div className="margin-label">
            <span>Costo: {formatCOP(results.costoTotal||0)}</span>
            <span style={{ color:"#44dd44", fontWeight:700 }}>{results.precioVenta>0?(((results.precioVenta-results.costoTotal)/results.precioVenta)*100).toFixed(1):0}% margen</span>
            <span>Venta: {formatCOP(results.precioVenta||0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoteTab() {
  const [watts, setWatts] = useState(95);
  const [inputs, setInputs] = useState({
    pesoUnJuguete:33, pesoDesperdicio:10, unidades:20, tiempoTotal:33,
    filamento:57000, electricidad:1150, mantenimientoUnit:200, multiplicador:4,
  });
  const [results, setResults] = useState({});
  const [activePreset, setActivePreset] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const set = (k,v) => setInputs(p => ({ ...p, [k]: parseFloat(v)||0 }));

  useEffect(() => {
    const kw = watts / 1000;
    const { pesoUnJuguete, pesoDesperdicio, unidades, tiempoTotal,
            filamento, electricidad, mantenimientoUnit, multiplicador } = inputs;
    const pesoProductoTotal  = pesoUnJuguete * unidades;
    const pesoFilamentoTotal = pesoProductoTotal + pesoDesperdicio;
    const pctDesperdicio     = pesoFilamentoTotal>0 ? (pesoDesperdicio/pesoFilamentoTotal)*100 : 0;
    const costoMaterialLote      = (pesoFilamentoTotal/1000)*filamento;
    const costoEnergiaLote       = tiempoTotal * kw * electricidad;
    const costoMantenimientoLote = mantenimientoUnit * unidades;
    const costoTotalLote         = costoMaterialLote + costoEnergiaLote + costoMantenimientoLote;
    const costoMaterialUnit = unidades>0 ? costoMaterialLote/unidades : 0;
    const costoEnergiaUnit  = unidades>0 ? costoEnergiaLote/unidades  : 0;
    const costoTotalUnit    = unidades>0 ? costoTotalLote/unidades    : 0;
    const precioVentaUnit   = costoTotalUnit * multiplicador;
    setResults({ pesoProductoTotal, pesoFilamentoTotal, pctDesperdicio,
      costoMaterialLote, costoEnergiaLote, costoMantenimientoLote, costoTotalLote,
      costoMaterialUnit, costoEnergiaUnit, costoTotalUnit, precioVentaUnit });
    setAnimKey(k => k+1);
  }, [inputs, watts]);

  const applyPreset = (i) => {
    setActivePreset(i);
    setInputs(p => ({ ...p, filamento:PRESETS[i].filamento, electricidad:PRESETS[i].electricidad }));
  };

  const pctProduct = results.pesoFilamentoTotal>0 ? (results.pesoProductoTotal/results.pesoFilamentoTotal)*100 : 80;
  const pctWaste = 100 - pctProduct;

  return (
    <div>
      <PrinterSelector watts={watts} setWatts={setWatts} />
      <div className="section-title">Material</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
        {PRESETS.map((p,i) => (
          <button key={i} className={`preset-btn ${activePreset===i?"active":""}`} onClick={() => applyPreset(i)}>{p.label}</button>
        ))}
      </div>
      <div style={{ background:"#111", border:"1px solid #1e2a3a", borderRadius:8, padding:"4px 16px 16px" }}>
        <div className="section-title" style={{ marginTop:14, color:"#336688" }}>📦 Datos del lote</div>
        <div className="info-box">
          Ingresa el peso de <strong>UN juguete</strong> y el desperdicio <strong>total</strong> del lote. La calculadora multiplica automáticamente.
        </div>
        <div className="input-row">
          <span className="input-label">Peso de UN juguete<small>Peso de una sola pieza terminada</small></span>
          <input type="number" value={inputs.pesoUnJuguete} onChange={e => set("pesoUnJuguete",e.target.value)} min="0" />
          <span className="input-unit">g</span>
        </div>
        <div className="input-row">
          <span className="input-label">Unidades producidas<small>Piezas buenas que salieron</small></span>
          <input type="number" value={inputs.unidades} onChange={e => set("unidades",e.target.value)} min="1" />
          <span className="input-unit">uds</span>
        </div>
        <div style={{ background:"#0a1520", border:"1px dashed #1a3a55", borderRadius:5, padding:"8px 12px", margin:"7px 0 4px", fontSize:11, color:"#2a6a99" }}>
          Producto total: <strong style={{ color:"#44aaff" }}>{(inputs.pesoUnJuguete*inputs.unidades).toFixed(0)}g</strong>
          <span style={{ color:"#1a3a55", margin:"0 8px" }}>({inputs.pesoUnJuguete}g × {inputs.unidades} uds)</span>
        </div>
        <div className="input-row">
          <span className="input-label">Desperdicio total del lote<small>Soportes + purgas + fallas (todo junto)</small></span>
          <input type="number" value={inputs.pesoDesperdicio} onChange={e => set("pesoDesperdicio",e.target.value)} min="0" />
          <span className="input-unit">g</span>
        </div>
        <div className="input-row" style={{ borderBottom:"none" }}>
          <span className="input-label">Tiempo total del lote</span>
          <input type="number" value={inputs.tiempoTotal} onChange={e => set("tiempoTotal",e.target.value)} step="0.5" min="0" />
          <span className="input-unit">h</span>
        </div>
        <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid #1a1a1a" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#444", marginBottom:4 }}>
            <span>Distribución de filamento</span>
            <span>Total consumido: <strong style={{ color:"#777" }}>{(results.pesoFilamentoTotal||0).toFixed(0)}g</strong></span>
          </div>
          <div className="waste-bar-wrap">
            <div className="waste-bar-product" style={{ width:`${pctProduct}%` }} />
            <div className="waste-bar-waste"   style={{ width:`${pctWaste}%` }} />
          </div>
          <div style={{ display:"flex", gap:14, fontSize:10, color:"#555" }}>
            <span><span style={{ color:"#44aaff" }}>■</span> Producto {fmt(pctProduct)}%</span>
            <span><span style={{ color:"#ff5533" }}>■</span> Desperdicio {fmt(results.pctDesperdicio)}%</span>
          </div>
        </div>
      </div>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:8, padding:"4px 16px 14px", marginTop:8 }}>
        <div className="section-title" style={{ marginTop:14 }}>Costos base</div>
        <div className="input-row">
          <span className="input-label">Filamento por rollo (1 kg)</span>
          <input type="number" value={inputs.filamento} onChange={e => { set("filamento",e.target.value); setActivePreset(-1); }} min="0" />
          <span className="input-unit">COP</span>
        </div>
        <div className="input-row">
          <span className="input-label">Electricidad — Estrato 6</span>
          <input type="number" value={inputs.electricidad} onChange={e => set("electricidad",e.target.value)} min="0" />
          <span className="input-unit">COP/kWh</span>
        </div>
        <div className="input-row" style={{ borderBottom:"none" }}>
          <span className="input-label">Mantenimiento por pieza</span>
          <input type="number" value={inputs.mantenimientoUnit} onChange={e => set("mantenimientoUnit",e.target.value)} min="0" />
          <span className="input-unit">COP</span>
        </div>
        <div style={{ padding:"12px 0 4px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span className="input-label" style={{ fontSize:11 }}>Multiplicador de venta</span>
            <span style={{ color:"#44dd44", fontWeight:700, fontSize:13 }}>{inputs.multiplicador}x</span>
          </div>
          <input type="range" min="1" max="10" step="0.5" value={inputs.multiplicador} onChange={e => set("multiplicador",e.target.value)} />
          <div style={{ fontSize:10, color:"#333", display:"flex", justifyContent:"space-between" }}><span>1x</span><span>5x</span><span>10x</span></div>
        </div>
      </div>
      <div style={{ display:"flex", gap:5, margin:"16px 0 6px" }}>
        <div className="stat-pill"><div className="stat-pill-label">Unidades</div><div className="stat-pill-value" style={{ color:"#ff9500" }}>{inputs.unidades}</div></div>
        <div className="stat-pill"><div className="stat-pill-label">Filamento total</div><div className="stat-pill-value">{(results.pesoFilamentoTotal||0).toFixed(0)}g</div></div>
        <div className="stat-pill"><div className="stat-pill-label">Desperdicio</div><div className="stat-pill-value" style={{ color:(results.pctDesperdicio||0)>20?"#ff5533":"#888" }}>{fmt(results.pctDesperdicio)}%</div></div>
        <div className="stat-pill"><div className="stat-pill-label">g / juguete</div><div className="stat-pill-value" style={{ color:"#44aaff" }}>{fmt(inputs.pesoUnJuguete,1)}</div></div>
      </div>
      <div className="section-title">Resultados del lote</div>
      <div key={animKey} className="animate-in">
        <div style={{ display:"flex", gap:5, marginBottom:6 }}>
          <div className="result-card" style={{ flex:1, flexDirection:"column", alignItems:"flex-start", gap:2 }}><div className="result-label">Material lote</div><div className="result-value" style={{ fontSize:14 }}>{formatCOP(results.costoMaterialLote||0)}</div></div>
          <div className="result-card" style={{ flex:1, flexDirection:"column", alignItems:"flex-start", gap:2 }}><div className="result-label">Energía lote</div><div className="result-value" style={{ fontSize:14 }}>{formatCOP(results.costoEnergiaLote||0)}</div></div>
          <div className="result-card" style={{ flex:1, flexDirection:"column", alignItems:"flex-start", gap:2 }}><div className="result-label">Mant. lote</div><div className="result-value" style={{ fontSize:14 }}>{formatCOP(results.costoMantenimientoLote||0)}</div></div>
        </div>
        <div className="result-total">
          <div><div className="result-label">COSTO TOTAL DEL LOTE ({inputs.unidades} uds)</div></div>
          <div className="result-value">{formatCOP(results.costoTotalLote||0)}</div>
        </div>
        <div style={{ borderTop:"1px solid #1e1e1e", margin:"12px 0 8px" }} />
        <div style={{ fontSize:9, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:8 }}>↓ Costo real por juguete</div>
        <div style={{ display:"flex", gap:5, marginBottom:6 }}>
          <div className="result-card" style={{ flex:1, flexDirection:"column", alignItems:"flex-start", gap:2 }}><div className="result-label">Material</div><div className="result-value" style={{ fontSize:13 }}>{formatCOP(results.costoMaterialUnit||0)}</div></div>
          <div className="result-card" style={{ flex:1, flexDirection:"column", alignItems:"flex-start", gap:2 }}><div className="result-label">Energía</div><div className="result-value" style={{ fontSize:13 }}>{formatCOP(results.costoEnergiaUnit||0)}</div></div>
          <div className="result-card" style={{ flex:1, flexDirection:"column", alignItems:"flex-start", gap:2 }}><div className="result-label">Mant.</div><div className="result-value" style={{ fontSize:13 }}>{formatCOP(inputs.mantenimientoUnit)}</div></div>
        </div>
        <div className="result-unit">
          <div>
            <div className="result-label">COSTO REAL POR JUGUETE</div>
            <div className="result-sub" style={{ color:"#1a3a55", marginTop:3 }}>
              {inputs.pesoUnJuguete}g × {inputs.unidades} uds + {inputs.pesoDesperdicio}g desp = {(results.pesoFilamentoTotal||0).toFixed(0)}g total · {inputs.tiempoTotal}h × {watts}W
            </div>
          </div>
          <div className="result-value">{formatCOP(results.costoTotalUnit||0)}</div>
        </div>
        <div className="result-venta">
          <div><div className="result-label">PRECIO DE VENTA POR JUGUETE ({inputs.multiplicador}x)</div></div>
          <div className="result-value">{formatCOP(results.precioVentaUnit||0)}</div>
        </div>
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:8, padding:"14px 16px", marginTop:8 }}>
          <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Margen bruto por juguete</div>
          <div className="margin-bar"><div className="margin-fill" style={{ width:`${Math.min(((results.precioVentaUnit-results.costoTotalUnit)/(results.precioVentaUnit||1))*100,100)}%` }} /></div>
          <div className="margin-label">
            <span>Costo: {formatCOP(results.costoTotalUnit||0)}</span>
            <span style={{ color:"#44dd44", fontWeight:700 }}>{results.precioVentaUnit>0?(((results.precioVentaUnit-results.costoTotalUnit)/results.precioVentaUnit)*100).toFixed(1):0}% margen</span>
            <span>Venta: {formatCOP(results.precioVentaUnit||0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Calculadora3D({ onClose }) {
  const [tab, setTab] = useState("lote");

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:400,
      background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"12px",
    }}>
      <div className="calc3d-root" style={{
        background:"#0d0d0d", borderRadius:"12px",
        width:"100%", maxWidth:"720px", maxHeight:"94vh",
        overflow:"hidden", display:"flex", flexDirection:"column",
        boxShadow:"0 30px 80px rgba(0,0,0,0.7)",
        fontFamily:"'Space Mono','Courier New',monospace", color:"#e8e0d0",
      }}>
        <style>{CSS}</style>
        {/* Header */}
        <div style={{
          background:"#111", borderBottom:"1px solid #1e1e1e",
          padding:"14px 18px", display:"flex", alignItems:"center", gap:"12px",
          flexShrink:0,
        }}>
          <div style={{
            width:30, height:30, background:"#ff9500", borderRadius:"4px",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
              <line x1="12" y1="22" x2="12" y2="15.5"/>
              <polyline points="22 8.5 12 15.5 2 8.5"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"19px", letterSpacing:"0.1em", color:"#ff9500" }}>CALCULADORA 3D</div>
            <div style={{ fontSize:"9px", color:"#444", letterSpacing:"0.18em", textTransform:"uppercase" }}>Costo de producción · Don Telmo</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background:"#1a1a1a", border:"1px solid #333", borderRadius:"6px",
              color:"#aaa", width:"34px", height:"34px", cursor:"pointer",
              fontSize:"18px", flexShrink:0, fontFamily:"inherit",
            }}
            title="Cerrar"
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #1e1e1e", flexShrink:0 }}>
          <button className={`tab-btn ${tab==="individual"?"active":""}`} onClick={() => setTab("individual")}>Pieza individual</button>
          <button className={`tab-btn ${tab==="lote"?"active":""}`} onClick={() => setTab("lote")}>🏭 Lote de producción</button>
        </div>

        {/* Body scrolleable */}
        <div style={{ overflowY:"auto", flex:1, padding:"18px 16px 28px" }}>
          {tab==="individual" ? <IndividualTab /> : <LoteTab />}
          <div style={{ fontSize:9, color:"#222", textAlign:"center", marginTop:24, letterSpacing:"0.1em" }}>
            BAMBU A1: 95W · CALCULADORA_COSTOS_DON_TELMO v2.2
          </div>
        </div>
      </div>
    </div>
  );
}
