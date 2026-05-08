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

// Estilos compartidos consistentes con el resto del recetario
const inp = {
  padding: "9px 12px",
  border: "1.5px solid #E0D8CE",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  width: "110px",
  textAlign: "right",
  fontWeight: "700",
  color: "#5a4a42",
  background: "#fff",
  fontFamily: "'Poppins', sans-serif",
};

const sectionTitle = {
  fontFamily: "Georgia, serif",
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "2px",
  color: "var(--app-primary, #1B3A5C)",
  textTransform: "uppercase",
  marginTop: "20px",
  marginBottom: "10px",
  paddingBottom: "6px",
  borderBottom: "1.5px solid #D4721A",
};

const inputRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 0",
  borderBottom: "1px solid #f0ebe5",
};

const inputLabel = {
  flex: 1,
  fontSize: "13px",
  color: "#5a4a42",
  fontWeight: "600",
  lineHeight: "1.4",
};

const inputLabelSmall = {
  display: "block",
  fontSize: "11px",
  color: "#aaa",
  fontWeight: "400",
  marginTop: "2px",
};

const inputUnit = {
  fontSize: "11px",
  color: "#888",
  width: "56px",
  textAlign: "right",
  flexShrink: 0,
  fontWeight: "600",
};

const presetBtn = (active, color = "#D4721A") => ({
  background: active ? color : "#F7F3EE",
  color: active ? "#fff" : "#888",
  border: `1.5px solid ${active ? color : "#E0D8CE"}`,
  borderRadius: "8px",
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "700",
  fontFamily: "'Poppins', sans-serif",
  transition: "all 0.15s",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const resultCard = {
  background: "#fff",
  border: "1.5px solid #f0ebe5",
  borderRadius: "10px",
  padding: "12px 16px",
  marginBottom: "8px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const resultLabel = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#888",
  fontWeight: "600",
};

const resultSub = {
  fontSize: "11px",
  color: "#bbb",
  marginTop: "3px",
};

const resultValue = {
  fontSize: "17px",
  fontWeight: "700",
  color: "#5a4a42",
  fontFamily: "Georgia, serif",
};

const CSS = `
  .calc3d-root input[type="number"]::-webkit-outer-spin-button,
  .calc3d-root input[type="number"]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
  .calc3d-root input[type="number"] { -moz-appearance:textfield; }
  .calc3d-root input[type="number"]:focus {
    outline:none; border-color:#D4721A;
    box-shadow:0 0 0 3px rgba(212,114,26,0.15);
  }
  .calc3d-root input[type="range"] {
    -webkit-appearance:none; width:100%; height:5px;
    background:#E0D8CE; border-radius:3px; margin:8px 0 4px; outline:none;
  }
  .calc3d-root input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance:none; width:18px; height:18px;
    background:#D4721A; border-radius:50%; cursor:pointer;
    box-shadow:0 2px 6px rgba(212,114,26,0.4);
  }
  .calc3d-root input[type="range"]::-moz-range-thumb {
    width:18px; height:18px; background:#D4721A; border:none;
    border-radius:50%; cursor:pointer;
  }
  .calc3d-root .preset-btn:hover { transform:translateY(-1px); }
  .calc3d-root .result-card:hover { transform:translateX(3px); }
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
      <div style={sectionTitle}>🖨️ Impresora</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PRINTER_PRESETS.map((p, i) => (
          <button
            key={i}
            className="preset-btn"
            onClick={() => apply(i)}
            style={presetBtn(active === i, "#1B3A5C")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={{
        background: "#F7F3EE",
        border: "1.5px solid #E0D8CE",
        borderRadius: "10px",
        padding: "10px 14px",
        margin: "4px 0 4px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, color: "#5a4a42", fontWeight: 600 }}>Consumo promedio real</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number" value={watts} min="10" max="500" step="5"
            onChange={e => { setActive(-1); setWatts(parseFloat(e.target.value) || 95); }}
            style={{ ...inp, width: 80 }}
          />
          <strong style={{ color: "#D4721A", fontSize: 13 }}>W</strong>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#bbb", textAlign: "right", marginBottom: 8 }}>
        Fuente: Bambu Lab Wiki oficial
      </div>
    </div>
  );
}

function IndividualTab() {
  const [watts, setWatts] = useState(95);
  const [inputs, setInputs] = useState({
    peso: 50, tiempo: 2, filamento: 57000, electricidad: 1150,
    desperdicio: 5, mantenimiento: 200, multiplicador: 4,
  });
  const [results, setResults] = useState({});
  const [activePreset, setActivePreset] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: parseFloat(v) || 0 }));

  useEffect(() => {
    const kw = watts / 1000;
    const costoMaterial = (inputs.peso / 1000) * inputs.filamento;
    const costoEnergia = inputs.tiempo * kw * inputs.electricidad;
    const costoBase = costoMaterial + costoEnergia + inputs.mantenimiento;
    const costoDesperdicio = costoBase * (inputs.desperdicio / 100);
    const costoTotal = costoBase + costoDesperdicio;
    const precioVenta = costoTotal * inputs.multiplicador;
    setResults({ costoMaterial, costoEnergia, costoDesperdicio, costoTotal, precioVenta });
    setAnimKey(k => k + 1);
  }, [inputs, watts]);

  const applyPreset = (i) => {
    setActivePreset(i);
    setInputs(p => ({ ...p, filamento: PRESETS[i].filamento, electricidad: PRESETS[i].electricidad }));
  };

  const margenPct = results.precioVenta > 0
    ? ((results.precioVenta - results.costoTotal) / results.precioVenta) * 100
    : 0;

  return (
    <div>
      <PrinterSelector watts={watts} setWatts={setWatts} />

      <div style={sectionTitle}>Material</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PRESETS.map((p, i) => (
          <button key={i} className="preset-btn" onClick={() => applyPreset(i)} style={presetBtn(activePreset === i)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#F7F3EE", border: "1.5px solid #E0D8CE", borderRadius: "12px", padding: "8px 18px 16px" }}>
        <div style={sectionTitle}>Parámetros de impresión</div>
        <div style={inputRow}>
          <span style={inputLabel}>Peso de la pieza<small style={inputLabelSmall}>Desde Bambu Studio</small></span>
          <input type="number" value={inputs.peso} onChange={e => set("peso", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>g</span>
        </div>
        <div style={{ ...inputRow, borderBottom: "none" }}>
          <span style={inputLabel}>Tiempo de impresión</span>
          <input type="number" value={inputs.tiempo} onChange={e => set("tiempo", e.target.value)} step="0.5" min="0" style={inp} />
          <span style={inputUnit}>h</span>
        </div>
      </div>

      <div style={{ background: "#F7F3EE", border: "1.5px solid #E0D8CE", borderRadius: "12px", padding: "8px 18px 16px", marginTop: 10 }}>
        <div style={sectionTitle}>Costos base</div>
        <div style={inputRow}>
          <span style={inputLabel}>Filamento por rollo (1 kg)</span>
          <input type="number" value={inputs.filamento} onChange={e => { set("filamento", e.target.value); setActivePreset(-1); }} min="0" style={inp} />
          <span style={inputUnit}>COP</span>
        </div>
        <div style={inputRow}>
          <span style={inputLabel}>Electricidad — Estrato 6</span>
          <input type="number" value={inputs.electricidad} onChange={e => set("electricidad", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>COP/kWh</span>
        </div>
        <div style={{ ...inputRow, borderBottom: "none" }}>
          <span style={inputLabel}>Mantenimiento por pieza</span>
          <input type="number" value={inputs.mantenimiento} onChange={e => set("mantenimiento", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>COP</span>
        </div>
      </div>

      <div style={{ background: "#F7F3EE", border: "1.5px solid #E0D8CE", borderRadius: "12px", padding: "12px 18px", marginTop: 10 }}>
        <div style={sectionTitle}>Ajustes</div>
        <div style={{ padding: "6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#5a4a42", fontWeight: 600 }}>Margen de desperdicio</span>
            <span style={{ color: "#D4721A", fontWeight: 700, fontSize: 14 }}>{inputs.desperdicio}%</span>
          </div>
          <input type="range" min="0" max="30" step="1" value={inputs.desperdicio} onChange={e => set("desperdicio", e.target.value)} />
          <div style={{ fontSize: 10, color: "#bbb", display: "flex", justifyContent: "space-between" }}>
            <span>0%</span><span>15%</span><span>30%</span>
          </div>
        </div>
        <div style={{ padding: "6px 0 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#5a4a42", fontWeight: 600 }}>Multiplicador de venta</span>
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>{inputs.multiplicador}x</span>
          </div>
          <input type="range" min="1" max="10" step="0.5" value={inputs.multiplicador} onChange={e => set("multiplicador", e.target.value)} />
          <div style={{ fontSize: 10, color: "#bbb", display: "flex", justifyContent: "space-between" }}>
            <span>1x</span><span>5x</span><span>10x</span>
          </div>
        </div>
      </div>

      <div style={sectionTitle}>Resultados</div>
      <div key={animKey} className="animate-in">
        <div className="result-card" style={resultCard}>
          <div>
            <div style={resultLabel}>Costo de Material</div>
            <div style={resultSub}>{inputs.peso}g × ${(inputs.filamento / 1000).toFixed(0)}/g</div>
          </div>
          <div style={resultValue}>{formatCOP(results.costoMaterial || 0)}</div>
        </div>
        <div className="result-card" style={resultCard}>
          <div>
            <div style={resultLabel}>Costo de Energía</div>
            <div style={resultSub}>{inputs.tiempo}h × {watts}W × ${inputs.electricidad}/kWh</div>
          </div>
          <div style={resultValue}>{formatCOP(results.costoEnergia || 0)}</div>
        </div>
        <div className="result-card" style={resultCard}>
          <div>
            <div style={resultLabel}>Mantenimiento</div>
            <div style={resultSub}>Valor fijo por pieza</div>
          </div>
          <div style={resultValue}>{formatCOP(inputs.mantenimiento)}</div>
        </div>
        <div className="result-card" style={resultCard}>
          <div>
            <div style={resultLabel}>Costo de Desperdicio</div>
            <div style={resultSub}>{inputs.desperdicio}% sobre costo base</div>
          </div>
          <div style={resultValue}>{formatCOP(results.costoDesperdicio || 0)}</div>
        </div>

        {/* COSTO TOTAL - color naranja Don Telmo */}
        <div style={{
          background: "linear-gradient(135deg, #fff5e6, #ffe4cc)",
          border: "2px solid #D4721A",
          borderRadius: "12px",
          padding: "16px 18px",
          marginTop: 12, marginBottom: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ ...resultLabel, color: "#a05010", fontSize: 12 }}>COSTO TOTAL DE PRODUCCIÓN</div>
          <div style={{ ...resultValue, color: "#D4721A", fontSize: 22 }}>{formatCOP(results.costoTotal || 0)}</div>
        </div>

        {/* PRECIO VENTA - verde */}
        <div style={{
          background: "linear-gradient(135deg, #e8f8e8, #d0f0d0)",
          border: "2px solid #22c55e",
          borderRadius: "12px",
          padding: "18px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ ...resultLabel, color: "#15803d", fontSize: 12 }}>
            PRECIO DE VENTA SUGERIDO ({inputs.multiplicador}x)
          </div>
          <div style={{ ...resultValue, color: "#22c55e", fontSize: 24 }}>{formatCOP(results.precioVenta || 0)}</div>
        </div>

        {/* Barra de margen */}
        <div style={{ background: "#fff", border: "1.5px solid #E0D8CE", borderRadius: "12px", padding: "14px 16px", marginTop: 10 }}>
          <div style={{ ...resultLabel, marginBottom: 8 }}>Margen bruto sobre venta</div>
          <div style={{ height: 8, background: "#F7F3EE", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #D4721A, #22c55e)",
              borderRadius: 4,
              width: `${Math.min(margenPct, 100)}%`,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span>Costo: {formatCOP(results.costoTotal || 0)}</span>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>{margenPct.toFixed(1)}% margen</span>
            <span>Venta: {formatCOP(results.precioVenta || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoteTab() {
  const [watts, setWatts] = useState(95);
  const [inputs, setInputs] = useState({
    pesoUnJuguete: 33, pesoDesperdicio: 10, unidades: 20, tiempoTotal: 33,
    filamento: 57000, electricidad: 1150, mantenimientoUnit: 200, multiplicador: 4,
  });
  const [results, setResults] = useState({});
  const [activePreset, setActivePreset] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: parseFloat(v) || 0 }));

  useEffect(() => {
    const kw = watts / 1000;
    const { pesoUnJuguete, pesoDesperdicio, unidades, tiempoTotal,
      filamento, electricidad, mantenimientoUnit, multiplicador } = inputs;
    const pesoProductoTotal = pesoUnJuguete * unidades;
    const pesoFilamentoTotal = pesoProductoTotal + pesoDesperdicio;
    const pctDesperdicio = pesoFilamentoTotal > 0 ? (pesoDesperdicio / pesoFilamentoTotal) * 100 : 0;
    const costoMaterialLote = (pesoFilamentoTotal / 1000) * filamento;
    const costoEnergiaLote = tiempoTotal * kw * electricidad;
    const costoMantenimientoLote = mantenimientoUnit * unidades;
    const costoTotalLote = costoMaterialLote + costoEnergiaLote + costoMantenimientoLote;
    const costoMaterialUnit = unidades > 0 ? costoMaterialLote / unidades : 0;
    const costoEnergiaUnit = unidades > 0 ? costoEnergiaLote / unidades : 0;
    const costoTotalUnit = unidades > 0 ? costoTotalLote / unidades : 0;
    const precioVentaUnit = costoTotalUnit * multiplicador;
    setResults({
      pesoProductoTotal, pesoFilamentoTotal, pctDesperdicio,
      costoMaterialLote, costoEnergiaLote, costoMantenimientoLote, costoTotalLote,
      costoMaterialUnit, costoEnergiaUnit, costoTotalUnit, precioVentaUnit,
    });
    setAnimKey(k => k + 1);
  }, [inputs, watts]);

  const applyPreset = (i) => {
    setActivePreset(i);
    setInputs(p => ({ ...p, filamento: PRESETS[i].filamento, electricidad: PRESETS[i].electricidad }));
  };

  const pctProduct = results.pesoFilamentoTotal > 0
    ? (results.pesoProductoTotal / results.pesoFilamentoTotal) * 100 : 80;
  const pctWaste = 100 - pctProduct;

  const margenPct = results.precioVentaUnit > 0
    ? ((results.precioVentaUnit - results.costoTotalUnit) / results.precioVentaUnit) * 100
    : 0;

  const statPill = (label, value, color = "#5a4a42") => (
    <div style={{
      background: "#fff", border: "1.5px solid #E0D8CE", borderRadius: 10,
      padding: "10px 12px", textAlign: "center", flex: 1,
    }}>
      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>{value}</div>
    </div>
  );

  const miniCard = (label, value) => (
    <div style={{
      flex: 1, background: "#fff", border: "1.5px solid #f0ebe5", borderRadius: 10,
      padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ ...resultLabel, fontSize: 10 }}>{label}</div>
      <div style={{ ...resultValue, fontSize: 14 }}>{value}</div>
    </div>
  );

  return (
    <div>
      <PrinterSelector watts={watts} setWatts={setWatts} />

      <div style={sectionTitle}>Material</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PRESETS.map((p, i) => (
          <button key={i} className="preset-btn" onClick={() => applyPreset(i)} style={presetBtn(activePreset === i)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#F7F3EE", border: "1.5px solid #E0D8CE", borderRadius: 12, padding: "8px 18px 16px" }}>
        <div style={sectionTitle}>📦 Datos del lote</div>
        <div style={{
          background: "#e8f8e8", border: "1px solid #c0e8c0", borderRadius: 8,
          padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#15803d", lineHeight: 1.6,
        }}>
          Ingresa el peso de <strong style={{ color: "#22c55e" }}>UN juguete</strong> y el desperdicio <strong style={{ color: "#22c55e" }}>total</strong> del lote. La calculadora multiplica automáticamente.
        </div>
        <div style={inputRow}>
          <span style={inputLabel}>Peso de UN juguete<small style={inputLabelSmall}>Peso de una sola pieza terminada</small></span>
          <input type="number" value={inputs.pesoUnJuguete} onChange={e => set("pesoUnJuguete", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>g</span>
        </div>
        <div style={inputRow}>
          <span style={inputLabel}>Unidades producidas<small style={inputLabelSmall}>Piezas buenas que salieron</small></span>
          <input type="number" value={inputs.unidades} onChange={e => set("unidades", e.target.value)} min="1" style={inp} />
          <span style={inputUnit}>uds</span>
        </div>
        <div style={{
          background: "#fff8ee", border: "1px dashed #D4721A", borderRadius: 8,
          padding: "8px 12px", margin: "8px 0", fontSize: 12, color: "#a05010",
        }}>
          Producto total: <strong style={{ color: "#D4721A" }}>{(inputs.pesoUnJuguete * inputs.unidades).toFixed(0)}g</strong>
          <span style={{ color: "#bbb", margin: "0 8px" }}>({inputs.pesoUnJuguete}g × {inputs.unidades} uds)</span>
        </div>
        <div style={inputRow}>
          <span style={inputLabel}>Desperdicio total del lote<small style={inputLabelSmall}>Soportes + purgas + fallas (todo junto)</small></span>
          <input type="number" value={inputs.pesoDesperdicio} onChange={e => set("pesoDesperdicio", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>g</span>
        </div>
        <div style={{ ...inputRow, borderBottom: "none" }}>
          <span style={inputLabel}>Tiempo total del lote</span>
          <input type="number" value={inputs.tiempoTotal} onChange={e => set("tiempoTotal", e.target.value)} step="0.5" min="0" style={inp} />
          <span style={inputUnit}>h</span>
        </div>

        {/* Distribucion */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E0D8CE" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>Distribución de filamento</span>
            <span>Total: <strong style={{ color: "#5a4a42" }}>{(results.pesoFilamentoTotal || 0).toFixed(0)}g</strong></span>
          </div>
          <div style={{ height: 8, background: "#fff", border: "1px solid #E0D8CE", borderRadius: 4, overflow: "hidden", display: "flex" }}>
            <div style={{ height: "100%", background: "#1B3A5C", width: `${pctProduct}%`, transition: "width 0.4s ease" }} />
            <div style={{ height: "100%", background: "#ef4444", width: `${pctWaste}%`, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#888", marginTop: 6 }}>
            <span><span style={{ color: "#1B3A5C" }}>■</span> Producto {fmt(pctProduct)}%</span>
            <span><span style={{ color: "#ef4444" }}>■</span> Desperdicio {fmt(results.pctDesperdicio)}%</span>
          </div>
        </div>
      </div>

      <div style={{ background: "#F7F3EE", border: "1.5px solid #E0D8CE", borderRadius: 12, padding: "8px 18px 16px", marginTop: 10 }}>
        <div style={sectionTitle}>Costos base</div>
        <div style={inputRow}>
          <span style={inputLabel}>Filamento por rollo (1 kg)</span>
          <input type="number" value={inputs.filamento} onChange={e => { set("filamento", e.target.value); setActivePreset(-1); }} min="0" style={inp} />
          <span style={inputUnit}>COP</span>
        </div>
        <div style={inputRow}>
          <span style={inputLabel}>Electricidad — Estrato 6</span>
          <input type="number" value={inputs.electricidad} onChange={e => set("electricidad", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>COP/kWh</span>
        </div>
        <div style={{ ...inputRow, borderBottom: "none" }}>
          <span style={inputLabel}>Mantenimiento por pieza</span>
          <input type="number" value={inputs.mantenimientoUnit} onChange={e => set("mantenimientoUnit", e.target.value)} min="0" style={inp} />
          <span style={inputUnit}>COP</span>
        </div>
        <div style={{ padding: "12px 0 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#5a4a42", fontWeight: 600 }}>Multiplicador de venta</span>
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>{inputs.multiplicador}x</span>
          </div>
          <input type="range" min="1" max="10" step="0.5" value={inputs.multiplicador} onChange={e => set("multiplicador", e.target.value)} />
          <div style={{ fontSize: 10, color: "#bbb", display: "flex", justifyContent: "space-between" }}>
            <span>1x</span><span>5x</span><span>10x</span>
          </div>
        </div>
      </div>

      {/* Stats pills */}
      <div style={{ display: "flex", gap: 6, margin: "16px 0 6px" }}>
        {statPill("Unidades", inputs.unidades, "#D4721A")}
        {statPill("Filamento", `${(results.pesoFilamentoTotal || 0).toFixed(0)}g`)}
        {statPill("Desperdicio", `${fmt(results.pctDesperdicio)}%`, (results.pctDesperdicio || 0) > 20 ? "#ef4444" : "#5a4a42")}
        {statPill("g/juguete", fmt(inputs.pesoUnJuguete, 1), "#1B3A5C")}
      </div>

      <div style={sectionTitle}>Resultados del lote</div>
      <div key={animKey} className="animate-in">
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {miniCard("Material lote", formatCOP(results.costoMaterialLote || 0))}
          {miniCard("Energía lote", formatCOP(results.costoEnergiaLote || 0))}
          {miniCard("Mant. lote", formatCOP(results.costoMantenimientoLote || 0))}
        </div>

        {/* COSTO TOTAL LOTE */}
        <div style={{
          background: "linear-gradient(135deg, #fff5e6, #ffe4cc)",
          border: "2px solid #D4721A",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ ...resultLabel, color: "#a05010" }}>COSTO TOTAL DEL LOTE ({inputs.unidades} uds)</div>
          <div style={{ ...resultValue, color: "#D4721A", fontSize: 22 }}>{formatCOP(results.costoTotalLote || 0)}</div>
        </div>

        <div style={{ borderTop: "1.5px solid #E0D8CE", margin: "16px 0 12px" }} />

        <div style={{
          fontSize: 11, color: "#888", textTransform: "uppercase",
          letterSpacing: "1px", marginBottom: 10, textAlign: "center", fontWeight: 700,
        }}>
          ↓ Costo real por juguete ↓
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {miniCard("Material", formatCOP(results.costoMaterialUnit || 0))}
          {miniCard("Energía", formatCOP(results.costoEnergiaUnit || 0))}
          {miniCard("Mant.", formatCOP(inputs.mantenimientoUnit))}
        </div>

        {/* COSTO REAL POR JUGUETE - azul navy */}
        <div style={{
          background: "linear-gradient(135deg, #e8eef5, #d0dde8)",
          border: "2px solid #1B3A5C",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ ...resultLabel, color: "#1B3A5C" }}>COSTO REAL POR JUGUETE</div>
            <div style={{ ...resultSub, color: "#5a7090", marginTop: 4 }}>
              {inputs.pesoUnJuguete}g × {inputs.unidades} uds + {inputs.pesoDesperdicio}g desp · {inputs.tiempoTotal}h × {watts}W
            </div>
          </div>
          <div style={{ ...resultValue, color: "#1B3A5C", fontSize: 22 }}>{formatCOP(results.costoTotalUnit || 0)}</div>
        </div>

        {/* PRECIO VENTA - verde */}
        <div style={{
          background: "linear-gradient(135deg, #e8f8e8, #d0f0d0)",
          border: "2px solid #22c55e",
          borderRadius: 12,
          padding: "18px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ ...resultLabel, color: "#15803d" }}>
            PRECIO DE VENTA POR JUGUETE ({inputs.multiplicador}x)
          </div>
          <div style={{ ...resultValue, color: "#22c55e", fontSize: 26 }}>{formatCOP(results.precioVentaUnit || 0)}</div>
        </div>

        {/* Margen */}
        <div style={{ background: "#fff", border: "1.5px solid #E0D8CE", borderRadius: 12, padding: "14px 16px", marginTop: 10 }}>
          <div style={{ ...resultLabel, marginBottom: 8 }}>Margen bruto por juguete</div>
          <div style={{ height: 8, background: "#F7F3EE", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "linear-gradient(90deg, #D4721A, #22c55e)",
              borderRadius: 4, width: `${Math.min(margenPct, 100)}%`, transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span>Costo: {formatCOP(results.costoTotalUnit || 0)}</span>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>{margenPct.toFixed(1)}% margen</span>
            <span>Venta: {formatCOP(results.precioVentaUnit || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Calculadora3D({ onClose }) {
  const [tab, setTab] = useState("lote");

  const tabBtnStyle = (active) => ({
    flex: 1,
    padding: "13px 10px",
    border: "none",
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#D4721A" : "#888",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "Georgia, serif",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderBottom: active ? "3px solid #D4721A" : "3px solid transparent",
    transition: "all 0.2s",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(10,15,25,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div className="calc3d-root" style={{
        background: "#fff", borderRadius: "16px",
        width: "100%", maxWidth: "780px", maxHeight: "92vh",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        fontFamily: "'Poppins', sans-serif",
      }}>
        <style>{CSS}</style>

        {/* Header con estilo Don Telmo */}
        <div style={{
          background: "linear-gradient(135deg, var(--app-primary, #1B3A5C), var(--app-primary-dark, #122845))",
          padding: "18px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia, serif" }}>
              DON TELMO® · 1958 · COMPANY
            </div>
            <div style={{ color: "#fff", fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: "700", marginTop: "3px", letterSpacing: "0.5px" }}>
              🖨️ Calculadora 3D · Bambu A1
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginTop: "2px", letterSpacing: "0.5px" }}>
              Costo de producción
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px",
              color: "#fff", width: "36px", height: "36px", cursor: "pointer",
              fontSize: "20px", flexShrink: 0,
            }}
            title="Cerrar"
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1.5px solid #E0D8CE", background: "#FDFAF6", flexShrink: 0 }}>
          <button onClick={() => setTab("individual")} style={tabBtnStyle(tab === "individual")}>
            Pieza Individual
          </button>
          <button onClick={() => setTab("lote")} style={tabBtnStyle(tab === "lote")}>
            🏭 Lote de Producción
          </button>
        </div>

        {/* Body scrolleable */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 22px 28px", background: "#fff" }}>
          {tab === "individual" ? <IndividualTab /> : <LoteTab />}
          <div style={{
            fontSize: 10, color: "#bbb", textAlign: "center", marginTop: 24,
            letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 600,
          }}>
            Bambu A1 · 95W · v2.2
          </div>
        </div>
      </div>
    </div>
  );
}
