"use client";
import { useState, useEffect } from "react";
import { getCompras, getProveedores, getSupplies, saveCompra, deleteCompra, recibirCompra } from "@/lib/storage";

const ESTADOS_COLOR = {
  pendiente: { bg:"rgba(234,179,8,0.15)",  border:"rgba(234,179,8,0.4)",  text:"#eab308"  },
  parcial:   { bg:"rgba(249,115,22,0.15)", border:"rgba(249,115,22,0.4)", text:"#f97316"  },
  recibido:  { bg:"rgba(34,197,94,0.15)",  border:"rgba(34,197,94,0.4)",  text:"#22c55e"  },
  cancelado: { bg:"rgba(239,68,68,0.15)",  border:"rgba(239,68,68,0.4)",  text:"#ef4444"  },
};

function fmt(n) {
  return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n||0);
}
function fmtNum(n, dec=3) { return (parseFloat(n)||0).toFixed(dec).replace(/\.?0+$/,""); }

const EMPTY_ITEM = { supply_id:"", supply_name:"", unit:"", cantidad_pedida:"", cost_per_unit:"", subtotal:0 };

export function ComprasPanel({ onClose, currentUser }) {
  const [compras, setCompras]       = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [supplies, setSupplies]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [vista, setVista]           = useState("lista"); // lista | form | detalle | recibir
  const [selected, setSelected]     = useState(null);
  const [filterEstado, setFilterEstado] = useState("all");

  // Formulario nueva compra
  const [form, setForm] = useState({
    proveedor_id:"", fecha_pedido: new Date().toISOString().split("T")[0],
    notas:"", numero:""
  });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  // Recepción
  const [recepItems, setRecepItems] = useState([]);
  const [recibiendo, setRecibiendo] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, p, s] = await Promise.all([getCompras(), getProveedores(), getSupplies()]);
    setCompras(c);
    setProveedores(p.filter(x => x.activo !== false));
    setSupplies(s);
    setLoading(false);
  };

  const filtered = compras.filter(c =>
    filterEstado === "all" || c.estado === filterEstado
  );

  // ── Item helpers ──────────────────────────────────────────────────
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i, field, val) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      if (field === "supply_id") {
        const sup = supplies.find(s => s.id === val);
        updated.supply_name = sup?.name || "";
        updated.unit        = sup?.unit || "";
        updated.cost_per_unit = sup?.cost_per_unit || "";
      }
      if (field === "cantidad_pedida" || field === "cost_per_unit") {
        updated.subtotal = (parseFloat(updated.cantidad_pedida)||0) * (parseFloat(updated.cost_per_unit)||0);
      }
      return updated;
    }));
  };

  const totalCompra = items.reduce((s, it) => s + ((parseFloat(it.cantidad_pedida)||0) * (parseFloat(it.cost_per_unit)||0)), 0);

  const handleSave = async () => {
    if (!form.proveedor_id) { alert("Selecciona un proveedor"); return; }
    if (items.every(it => !it.supply_id)) { alert("Agrega al menos un insumo"); return; }
    setSaving(true);
    const validItems = items
      .filter(it => it.supply_id && parseFloat(it.cantidad_pedida) > 0)
      .map(it => ({
        supply_id: it.supply_id,
        cantidad_pedida: parseFloat(it.cantidad_pedida),
        cantidad_recibida: 0,
        cost_per_unit: parseFloat(it.cost_per_unit) || 0,
        subtotal: (parseFloat(it.cantidad_pedida)||0) * (parseFloat(it.cost_per_unit)||0),
        estado: "pendiente",
      }));
    const saved = await saveCompra({ ...form, estado:"pendiente", total: totalCompra }, validItems);
    if (saved) { await loadAll(); setVista("lista"); resetForm(); }
    else alert("Error al guardar la compra");
    setSaving(false);
  };

  const resetForm = () => {
    setForm({ proveedor_id:"", fecha_pedido: new Date().toISOString().split("T")[0], notas:"", numero:"" });
    setItems([{ ...EMPTY_ITEM }]);
  };

  const abrirRecepcion = (compra) => {
    setSelected(compra);
    setRecepItems(
      (compra.items || []).map(it => ({
        ...it,
        cantidad_recibida_new: it.cantidad_pedida - (it.cantidad_recibida || 0),
      }))
    );
    setVista("recibir");
  };

  const handleRecibir = async () => {
    setRecibiendo(true);
    const payload = recepItems.map(it => ({
      supply_id:         it.supply_id,
      cantidad_recibida: parseFloat(it.cantidad_recibida_new) || 0,
      cost_per_unit:     it.cost_per_unit,
    }));
    const ok = await recibirCompra(selected.id, payload, currentUser?.name || "admin");
    if (ok) { await loadAll(); setVista("lista"); }
    else alert("Error al registrar recepción");
    setRecibiendo(false);
  };

  // ── Estilos ───────────────────────────────────────────────────────
  const overlay = {
    position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000,
    display:"flex", alignItems:"flex-start", justifyContent:"center",
    padding:"16px 12px", overflowY:"auto"
  };
  const modal = {
    background:"#1A1A2E", borderRadius:"16px", width:"100%", maxWidth:"960px",
    boxShadow:"0 20px 60px rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)"
  };
  const inp = {
    width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:"8px", color:"#fff", padding:"9px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box"
  };
  const lbl = { color:"#9BBACC", fontSize:"12px", fontWeight:"600", marginBottom:"4px", display:"block" };
  const btnOrange = { background:"linear-gradient(135deg,#D4721A,#b85e14)", border:"none", borderRadius:"8px", color:"#fff", padding:"10px 20px", cursor:"pointer", fontSize:"14px", fontWeight:"700" };
  const btnGhost  = { background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"8px", color:"#fff", padding:"10px 16px", cursor:"pointer", fontSize:"13px" };

  const EstadoBadge = ({ estado }) => {
    const c = ESTADOS_COLOR[estado] || ESTADOS_COLOR.pendiente;
    return (
      <span style={{ background:c.bg, border:`1px solid ${c.border}`, color:c.text,
        borderRadius:"20px", padding:"3px 10px", fontSize:"11px", fontWeight:"700" }}>
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </span>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // VISTA: LISTA
  // ══════════════════════════════════════════════════════════════════
  if (vista === "lista") return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif", fontSize:"20px" }}>
              🛒 Órdenes de Compra
            </h2>
            <div style={{ color:"#9BBACC", fontSize:"13px", marginTop:"2px" }}>
              {compras.length} compras registradas
            </div>
          </div>
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={() => { resetForm(); setVista("form"); }} style={btnOrange}>
              + Nueva Compra
            </button>
            <button onClick={onClose} style={{ ...btnGhost, padding:"10px 12px" }}>✕</button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding:"12px 24px", display:"flex", gap:"8px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          {["all","pendiente","parcial","recibido","cancelado"].map(e => (
            <button key={e} onClick={() => setFilterEstado(e)} style={{
              background: filterEstado===e ? "rgba(212,114,26,0.3)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${filterEstado===e ? "#D4721A" : "rgba(255,255,255,0.1)"}`,
              borderRadius:"20px", color: filterEstado===e ? "#D4721A" : "#9BBACC",
              padding:"5px 14px", cursor:"pointer", fontSize:"12px", fontWeight: filterEstado===e ? "700" : "400"
            }}>
              {e === "all" ? "Todas" : e.charAt(0).toUpperCase()+e.slice(1)}
              <span style={{ marginLeft:"6px", background:"rgba(255,255,255,0.1)", borderRadius:"10px", padding:"1px 6px", fontSize:"10px" }}>
                {e === "all" ? compras.length : compras.filter(c=>c.estado===e).length}
              </span>
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div style={{ padding:"16px 24px" }}>
          {loading ? (
            <div style={{ color:"#9BBACC", textAlign:"center", padding:"40px" }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color:"#9BBACC", textAlign:"center", padding:"40px" }}>
              <div style={{ fontSize:"40px" }}>🛒</div>
              <div style={{ marginTop:"12px" }}>No hay compras {filterEstado !== "all" ? `con estado "${filterEstado}"` : "registradas"}.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {filtered.map(c => {
                const prov = proveedores.find(p => p.id === c.proveedor_id);
                return (
                  <div key={c.id} style={{
                    background:"rgba(255,255,255,0.04)", borderRadius:"12px",
                    border:"1px solid rgba(255,255,255,0.08)", padding:"14px 18px",
                    display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap"
                  }}>
                    <div style={{ flex:1, minWidth:"180px" }}>
                      <div style={{ color:"#fff", fontWeight:"700", fontSize:"14px" }}>
                        {c.proveedor?.nombre || prov?.nombre || "Sin proveedor"}
                      </div>
                      <div style={{ color:"#9BBACC", fontSize:"12px", marginTop:"2px" }}>
                        📅 {c.fecha_pedido}
                        {c.numero && <span style={{ marginLeft:"8px" }}>· #{c.numero}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ color:"#D4721A", fontWeight:"700", fontSize:"15px" }}>
                        {fmt(c.total)}
                      </div>
                      <div style={{ color:"#9BBACC", fontSize:"11px" }}>
                        {(c.items||[]).length} ítems
                      </div>
                    </div>
                    <EstadoBadge estado={c.estado} />
                    <div style={{ display:"flex", gap:"6px" }}>
                      {c.estado === "pendiente" && (
                        <button onClick={() => abrirRecepcion(c)} style={{
                          background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)",
                          borderRadius:"8px", color:"#22c55e", padding:"7px 14px",
                          cursor:"pointer", fontSize:"12px", fontWeight:"700"
                        }}>
                          ✅ Recibir
                        </button>
                      )}
                      <button onClick={() => { setSelected(c); setVista("detalle"); }} style={{ ...btnGhost, padding:"7px 12px", fontSize:"12px" }}>
                        👁️ Ver
                      </button>
                      {c.estado === "pendiente" && (
                        <button onClick={async () => { if(confirm("¿Eliminar esta compra?")) { await deleteCompra(c.id); await loadAll(); }}} style={{
                          background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)",
                          borderRadius:"8px", color:"#ef4444", padding:"7px 10px", cursor:"pointer", fontSize:"12px"
                        }}>🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // VISTA: FORMULARIO NUEVA COMPRA
  // ══════════════════════════════════════════════════════════════════
  if (vista === "form") return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h2 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif" }}>🛒 Nueva Orden de Compra</h2>
          <button onClick={() => setVista("lista")} style={{ ...btnGhost, padding:"10px 12px" }}>✕</button>
        </div>

        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"16px" }}>
          {/* Datos cabecera */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div>
              <label style={lbl}>Proveedor *</label>
              <select style={inp} value={form.proveedor_id} onChange={e=>setForm(f=>({...f,proveedor_id:e.target.value}))}>
                <option value="">Seleccionar…</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Fecha del pedido</label>
              <input style={inp} type="date" value={form.fecha_pedido} onChange={e=>setForm(f=>({...f,fecha_pedido:e.target.value}))} />
            </div>
            <div>
              <label style={lbl}>N° Orden (opcional)</label>
              <input style={inp} value={form.numero} onChange={e=>setForm(f=>({...f,numero:e.target.value}))} placeholder="001, OC-2025-01, etc." />
            </div>
          </div>

          {/* Tabla de ítems */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
              <label style={{ ...lbl, margin:0 }}>Insumos pedidos</label>
              <button onClick={addItem} style={{ ...btnGhost, padding:"6px 14px", fontSize:"12px" }}>+ Agregar insumo</button>
            </div>

            {/* Header tabla */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 120px 110px 36px",
              gap:"6px", padding:"6px 8px", color:"#9BBACC", fontSize:"11px", fontWeight:"700" }}>
              <span>INSUMO</span><span>UNIDAD</span><span>CANTIDAD</span><span>COSTO UNIT.</span><span style={{textAlign:"right"}}>SUBTOTAL</span><span></span>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {items.map((it, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 120px 110px 36px", gap:"6px", alignItems:"center" }}>
                  <select style={inp} value={it.supply_id} onChange={e=>updateItem(i,"supply_id",e.target.value)}>
                    <option value="">Seleccionar insumo…</option>
                    {supplies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div style={{ color:"#9BBACC", fontSize:"12px", textAlign:"center" }}>{it.unit||"—"}</div>
                  <input style={inp} type="number" min="0" step="0.001"
                    placeholder="0" value={it.cantidad_pedida}
                    onChange={e=>updateItem(i,"cantidad_pedida",e.target.value)} />
                  <input style={inp} type="number" min="0"
                    placeholder="0" value={it.cost_per_unit}
                    onChange={e=>updateItem(i,"cost_per_unit",e.target.value)} />
                  <div style={{ color:"#D4721A", fontWeight:"700", fontSize:"13px", textAlign:"right" }}>
                    {fmt((parseFloat(it.cantidad_pedida)||0)*(parseFloat(it.cost_per_unit)||0))}
                  </div>
                  <button onClick={()=>removeItem(i)} disabled={items.length===1} style={{
                    background:"rgba(239,68,68,0.12)", border:"none", borderRadius:"6px",
                    color:"#ef4444", cursor:"pointer", padding:"6px", fontSize:"14px",
                    opacity: items.length===1 ? 0.3 : 1
                  }}>✕</button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", marginTop:"12px", paddingTop:"12px",
              display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"16px" }}>
              <span style={{ color:"#9BBACC", fontSize:"14px" }}>Total orden:</span>
              <span style={{ color:"#D4721A", fontSize:"20px", fontWeight:"700", fontFamily:"Georgia,serif" }}>
                {fmt(totalCompra)}
              </span>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={lbl}>Notas</label>
            <textarea style={{ ...inp, height:"60px", resize:"vertical" }}
              value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
              placeholder="Observaciones, instrucciones de entrega, etc." />
          </div>
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid rgba(255,255,255,0.08)",
          display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={() => setVista("lista")} style={btnGhost}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnOrange, opacity:saving?0.6:1 }}>
            {saving ? "Guardando…" : "Crear orden de compra"}
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // VISTA: DETALLE
  // ══════════════════════════════════════════════════════════════════
  if (vista === "detalle" && selected) return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && setVista("lista")}>
      <div style={modal}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif" }}>
              🛒 Detalle de Compra
              {selected.numero && <span style={{ color:"#9BBACC", fontSize:"15px" }}> — #{selected.numero}</span>}
            </h2>
            <div style={{ color:"#9BBACC", fontSize:"13px", marginTop:"2px" }}>
              {selected.proveedor?.nombre} · {selected.fecha_pedido}
            </div>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            {selected.estado === "pendiente" && (
              <button onClick={() => abrirRecepcion(selected)} style={{
                background:"rgba(34,197,94,0.2)", border:"1px solid rgba(34,197,94,0.4)",
                borderRadius:"8px", color:"#22c55e", padding:"10px 18px",
                cursor:"pointer", fontWeight:"700"
              }}>✅ Registrar recepción</button>
            )}
            <button onClick={() => setVista("lista")} style={{ ...btnGhost, padding:"10px 12px" }}>✕</button>
          </div>
        </div>

        <div style={{ padding:"20px 24px" }}>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"20px" }}>
            {[
              ["Proveedor", selected.proveedor?.nombre || "—"],
              ["Fecha pedido", selected.fecha_pedido],
              ["Estado", <span style={{ color: ESTADOS_COLOR[selected.estado]?.text }}>{selected.estado}</span>],
              ["Total", <span style={{ color:"#D4721A", fontWeight:"700" }}>{fmt(selected.total)}</span>],
              ["Fecha recepción", selected.fecha_recepcion || "—"],
              ["Notas", selected.notas || "—"],
            ].map(([k,v]) => (
              <div key={k} style={{ background:"rgba(255,255,255,0.04)", borderRadius:"8px", padding:"12px 14px" }}>
                <div style={{ color:"#9BBACC", fontSize:"11px", marginBottom:"4px" }}>{k}</div>
                <div style={{ color:"#fff", fontSize:"14px" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Ítems */}
          <div style={{ color:"#D4721A", fontSize:"11px", fontWeight:"700", letterSpacing:"1px", marginBottom:"8px" }}>
            INSUMOS PEDIDOS
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {(selected.items||[]).map(it => (
              <div key={it.id} style={{
                display:"grid", gridTemplateColumns:"2fr 80px 100px 100px 100px 110px",
                gap:"8px", alignItems:"center",
                background:"rgba(255,255,255,0.04)", borderRadius:"8px", padding:"10px 14px"
              }}>
                <span style={{ color:"#fff", fontWeight:"600", fontSize:"13px" }}>
                  {it.supply?.name || "—"}
                </span>
                <span style={{ color:"#9BBACC", fontSize:"12px" }}>{it.supply?.unit}</span>
                <span style={{ color:"#c0d5e0", fontSize:"13px" }}>Ped: {fmtNum(it.cantidad_pedida)}</span>
                <span style={{ color:"#22c55e", fontSize:"13px" }}>Rec: {fmtNum(it.cantidad_recibida)}</span>
                <span style={{ color:"#9BBACC", fontSize:"12px" }}>{fmt(it.cost_per_unit)}/u</span>
                <span style={{ color:"#D4721A", fontWeight:"700", textAlign:"right" }}>{fmt(it.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // VISTA: RECIBIR COMPRA
  // ══════════════════════════════════════════════════════════════════
  if (vista === "recibir" && selected) return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif" }}>
              ✅ Registrar Recepción
            </h2>
            <div style={{ color:"#9BBACC", fontSize:"13px", marginTop:"2px" }}>
              {selected.proveedor?.nombre} · {selected.fecha_pedido}
            </div>
          </div>
          <button onClick={() => setVista("lista")} style={{ ...btnGhost, padding:"10px 12px" }}>✕</button>
        </div>

        <div style={{ padding:"20px 24px" }}>
          <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)",
            borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", color:"#c0ffd4", fontSize:"13px" }}>
            💡 Ingresa las cantidades <strong>realmente recibidas</strong>. El inventario se actualizará automáticamente y se registrará el movimiento en el Kardex.
          </div>

          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 110px 120px 110px",
            gap:"8px", padding:"6px 8px", color:"#9BBACC", fontSize:"11px", fontWeight:"700", marginBottom:"6px" }}>
            <span>INSUMO</span><span>UNIDAD</span><span>PEDIDO</span><span>CANT. RECIBIDA</span><span style={{textAlign:"right"}}>COSTO UNIT.</span>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {recepItems.map((it, i) => (
              <div key={it.id||i} style={{ display:"grid", gridTemplateColumns:"2fr 80px 110px 120px 110px",
                gap:"8px", alignItems:"center",
                background:"rgba(255,255,255,0.04)", borderRadius:"8px", padding:"10px 12px" }}>
                <span style={{ color:"#fff", fontWeight:"600", fontSize:"13px" }}>
                  {it.supply?.name || "—"}
                </span>
                <span style={{ color:"#9BBACC", fontSize:"12px" }}>{it.supply?.unit || ""}</span>
                <span style={{ color:"#c0d5e0", fontSize:"13px" }}>{fmtNum(it.cantidad_pedida)}</span>
                <input
                  style={{ ...inp, maxWidth:"110px" }}
                  type="number" min="0" step="0.001"
                  value={it.cantidad_recibida_new}
                  onChange={e => setRecepItems(prev => prev.map((r,j) =>
                    j===i ? { ...r, cantidad_recibida_new: e.target.value } : r
                  ))}
                />
                <input
                  style={{ ...inp, maxWidth:"110px" }}
                  type="number" min="0"
                  value={it.cost_per_unit}
                  onChange={e => setRecepItems(prev => prev.map((r,j) =>
                    j===i ? { ...r, cost_per_unit: e.target.value } : r
                  ))}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid rgba(255,255,255,0.08)",
          display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={() => setVista("lista")} style={btnGhost}>Cancelar</button>
          <button onClick={handleRecibir} disabled={recibiendo} style={{ ...btnOrange, opacity:recibiendo?0.6:1 }}>
            {recibiendo ? "Registrando…" : "✅ Confirmar recepción"}
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}
