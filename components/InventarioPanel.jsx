"use client";
import { useState, useEffect } from "react";
import { getInventario, getSupplies, saveInventarioItem, getKardex } from "@/lib/storage";

function fmt(n) {
  return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n||0);
}
function fmtNum(n, dec=2) { return (parseFloat(n)||0).toFixed(dec).replace(/\.?0+$/,""); }

export function InventarioPanel({ onClose }) {
  const [inventario, setInventario] = useState([]);
  const [supplies, setSupplies]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("all");
  const [editingId, setEditingId]   = useState(null);
  const [editRow, setEditRow]       = useState({});
  const [saving, setSaving]         = useState(false);
  const [vistaKardex, setVistaKardex] = useState(null); // supply_id
  const [kardexData, setKardexData] = useState([]);
  const [loadingKardex, setLoadingKardex] = useState(false);

  // Insumos sin fila en inventario todavía
  const [showAdd, setShowAdd]       = useState(false);
  const [addSupplyId, setAddSupplyId] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [inv, sup] = await Promise.all([getInventario(), getSupplies()]);
    setInventario(inv);
    setSupplies(sup);
    setLoading(false);
  };

  // Insumos que aún no tienen fila de inventario
  const invSupplyIds = new Set(inventario.map(i => i.supply_id));
  const sinInventario = supplies.filter(s => !invSupplyIds.has(s.id));

  const categorias = [...new Set(inventario.map(i => i.supply?.category).filter(Boolean))].sort();

  const filtered = inventario.filter(item => {
    const name = (item.supply?.name || "").toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchCat = filterCat === "all" || item.supply?.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleEdit = (item) => {
    setEditingId(item.id || item.supply_id);
    setEditRow({ stock_actual: item.stock_actual, stock_minimo: item.stock_minimo || 0, ubicacion: item.ubicacion || "" });
  };

  const handleSave = async (supplyId) => {
    setSaving(true);
    await saveInventarioItem({ supply_id: supplyId, ...editRow });
    await load();
    setEditingId(null);
    setSaving(false);
  };

  const handleAddSupply = async () => {
    if (!addSupplyId) return;
    setSaving(true);
    await saveInventarioItem({ supply_id: addSupplyId, stock_actual: 0, stock_minimo: 0 });
    await load();
    setAddSupplyId("");
    setShowAdd(false);
    setSaving(false);
  };

  const openKardex = async (supplyId) => {
    setVistaKardex(supplyId);
    setLoadingKardex(true);
    const data = await getKardex(supplyId, 50);
    setKardexData(data);
    setLoadingKardex(false);
  };

  const stockStatus = (item) => {
    if (!item.stock_minimo || item.stock_minimo === 0) return "ok";
    if (item.stock_actual <= 0) return "agotado";
    if (item.stock_actual <= item.stock_minimo) return "bajo";
    return "ok";
  };

  const statusColors = {
    ok:     { color:"#22c55e", label:"OK" },
    bajo:   { color:"#eab308", label:"Bajo" },
    agotado:{ color:"#ef4444", label:"Agotado" },
  };

  // Resumen
  const agotados = inventario.filter(i => i.stock_actual <= 0).length;
  const bajos    = inventario.filter(i => i.stock_minimo > 0 && i.stock_actual > 0 && i.stock_actual <= i.stock_minimo).length;
  const valorTotal = inventario.reduce((s, i) => s + (i.stock_actual * (i.supply?.cost_per_unit || 0)), 0);

  // ── Estilos ───────────────────────────────────────────────────────
  const overlay = {
    position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000,
    display:"flex", alignItems:"flex-start", justifyContent:"center",
    padding:"16px 12px", overflowY:"auto"
  };
  const modal = {
    background:"#1A1A2E", borderRadius:"16px", width:"100%", maxWidth:"1000px",
    boxShadow:"0 20px 60px rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)"
  };
  const inp = {
    background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:"6px", color:"#fff", padding:"6px 10px", fontSize:"13px", outline:"none", width:"90px"
  };
  const btnGhost = { background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"8px", color:"#fff", padding:"8px 14px", cursor:"pointer", fontSize:"13px" };
  const btnOrange = { background:"linear-gradient(135deg,#D4721A,#b85e14)", border:"none", borderRadius:"8px", color:"#fff", padding:"10px 18px", cursor:"pointer", fontSize:"14px", fontWeight:"700" };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif", fontSize:"20px" }}>
              📦 Inventario
            </h2>
            <div style={{ color:"#9BBACC", fontSize:"13px", marginTop:"2px" }}>
              {inventario.length} insumos · Valor en bodega: <strong style={{ color:"#D4721A" }}>{fmt(valorTotal)}</strong>
            </div>
          </div>
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={() => setShowAdd(true)} style={btnGhost}>+ Agregar insumo</button>
            <button onClick={onClose} style={{ ...btnGhost, padding:"10px 12px" }}>✕</button>
          </div>
        </div>

        {/* Alertas */}
        {(agotados > 0 || bajos > 0) && (
          <div style={{ padding:"10px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)",
            display:"flex", gap:"12px", flexWrap:"wrap" }}>
            {agotados > 0 && (
              <span style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)",
                borderRadius:"8px", padding:"6px 14px", color:"#ef4444", fontSize:"13px", fontWeight:"700" }}>
                ⛔ {agotados} insumo{agotados>1?"s":""} agotado{agotados>1?"s":""}
              </span>
            )}
            {bajos > 0 && (
              <span style={{ background:"rgba(234,179,8,0.15)", border:"1px solid rgba(234,179,8,0.3)",
                borderRadius:"8px", padding:"6px 14px", color:"#eab308", fontSize:"13px", fontWeight:"700" }}>
                ⚠️ {bajos} insumo{bajos>1?"s":""} bajo mínimo
              </span>
            )}
          </div>
        )}

        {/* Filtros */}
        <div style={{ padding:"12px 24px", display:"flex", gap:"8px", flexWrap:"wrap",
          borderBottom:"1px solid rgba(255,255,255,0.06)", alignItems:"center" }}>
          <input
            placeholder="Buscar insumo…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, width:"200px", padding:"8px 12px" }}
          />
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ ...inp, width:"auto", padding:"8px 12px" }}>
            <option value="all">Todas las categorías</option>
            {categorias.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div style={{ padding:"16px 24px" }}>
          {loading ? (
            <div style={{ color:"#9BBACC", textAlign:"center", padding:"40px" }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color:"#9BBACC", textAlign:"center", padding:"40px" }}>
              <div style={{ fontSize:"40px" }}>📦</div>
              <div style={{ marginTop:"12px" }}>
                {inventario.length === 0
                  ? "Sin inventario registrado. Crea una compra para comenzar o agrega insumos manualmente."
                  : "Sin resultados para la búsqueda."}
              </div>
            </div>
          ) : (
            <>
              {/* Header columnas */}
              <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 100px 100px 110px 110px 100px",
                gap:"8px", padding:"6px 10px", color:"#9BBACC", fontSize:"11px", fontWeight:"700", marginBottom:"4px" }}>
                <span>INSUMO</span><span>UNIDAD</span><span>STOCK</span><span>MÍNIMO</span>
                <span>COSTO UNIT.</span><span>VALOR</span><span>ACCIONES</span>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                {filtered.map(item => {
                  const status  = stockStatus(item);
                  const sc      = statusColors[status];
                  const valor   = item.stock_actual * (item.supply?.cost_per_unit || 0);
                  const isEdit  = editingId === (item.id || item.supply_id);

                  return (
                    <div key={item.id} style={{
                      display:"grid", gridTemplateColumns:"2fr 80px 100px 100px 110px 110px 100px",
                      gap:"8px", alignItems:"center",
                      background: status==="agotado" ? "rgba(239,68,68,0.06)" : status==="bajo" ? "rgba(234,179,8,0.06)" : "rgba(255,255,255,0.03)",
                      borderRadius:"8px", padding:"8px 10px",
                      border:`1px solid ${status==="agotado"?"rgba(239,68,68,0.15)":status==="bajo"?"rgba(234,179,8,0.15)":"rgba(255,255,255,0.06)"}`
                    }}>
                      <div>
                        <div style={{ color:"#fff", fontWeight:"600", fontSize:"13px" }}>
                          {item.supply?.name}
                        </div>
                        <div style={{ display:"flex", gap:"6px", alignItems:"center", marginTop:"2px" }}>
                          <span style={{ color:"#9BBACC", fontSize:"11px" }}>{item.supply?.category}</span>
                          <span style={{ background:`${sc.color}22`, color:sc.color, border:`1px solid ${sc.color}44`,
                            borderRadius:"10px", padding:"1px 7px", fontSize:"10px", fontWeight:"700" }}>
                            {sc.label}
                          </span>
                        </div>
                      </div>

                      <span style={{ color:"#9BBACC", fontSize:"12px" }}>{item.supply?.unit}</span>

                      {isEdit ? (
                        <input style={inp} type="number" min="0" step="0.001"
                          value={editRow.stock_actual}
                          onChange={e=>setEditRow(r=>({...r,stock_actual:parseFloat(e.target.value)||0}))} />
                      ) : (
                        <span style={{ color: status==="agotado"?"#ef4444":status==="bajo"?"#eab308":"#c0ffd4",
                          fontWeight:"700", fontSize:"14px" }}>
                          {fmtNum(item.stock_actual)}
                        </span>
                      )}

                      {isEdit ? (
                        <input style={inp} type="number" min="0" step="0.001"
                          value={editRow.stock_minimo}
                          onChange={e=>setEditRow(r=>({...r,stock_minimo:parseFloat(e.target.value)||0}))} />
                      ) : (
                        <span style={{ color:"#9BBACC", fontSize:"13px" }}>{fmtNum(item.stock_minimo)}</span>
                      )}

                      <span style={{ color:"#c0d5e0", fontSize:"12px" }}>{fmt(item.supply?.cost_per_unit)}</span>
                      <span style={{ color:"#D4721A", fontSize:"13px", fontWeight:"600" }}>{fmt(valor)}</span>

                      <div style={{ display:"flex", gap:"4px" }}>
                        {isEdit ? (
                          <>
                            <button onClick={() => handleSave(item.supply_id)} disabled={saving}
                              style={{ background:"#22c55e", border:"none", borderRadius:"6px", color:"#fff", padding:"5px 8px", cursor:"pointer", fontSize:"11px", fontWeight:"700" }}>
                              ✓
                            </button>
                            <button onClick={() => setEditingId(null)}
                              style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"6px", color:"#fff", padding:"5px 8px", cursor:"pointer", fontSize:"11px" }}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(item)} title="Editar stock"
                              style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:"6px", color:"#9BBACC", padding:"5px 8px", cursor:"pointer", fontSize:"11px" }}>
                              ✏️
                            </button>
                            <button onClick={() => openKardex(item.supply_id)} title="Ver movimientos"
                              style={{ background:"rgba(124,106,245,0.12)", border:"none", borderRadius:"6px", color:"#7C6AF5", padding:"5px 8px", cursor:"pointer", fontSize:"11px" }}>
                              📋
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal: Agregar insumo sin inventario */}
        {showAdd && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1100,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#16213E", borderRadius:"14px", padding:"24px", maxWidth:"400px", width:"100%",
              border:"1px solid rgba(255,255,255,0.12)" }}>
              <h3 style={{ color:"#fff", margin:"0 0 16px", fontFamily:"Georgia,serif" }}>
                Agregar insumo al inventario
              </h3>
              <select value={addSupplyId} onChange={e=>setAddSupplyId(e.target.value)}
                style={{ ...inp, width:"100%", padding:"9px 12px", marginBottom:"16px" }}>
                <option value="">Seleccionar insumo…</option>
                {sinInventario.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
                <button onClick={()=>{setShowAdd(false);setAddSupplyId("");}} style={btnGhost}>Cancelar</button>
                <button onClick={handleAddSupply} disabled={!addSupplyId || saving} style={{ ...btnOrange, opacity:!addSupplyId?0.5:1 }}>
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Kardex del insumo */}
        {vistaKardex && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1100,
            display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px", overflowY:"auto" }}>
            <div style={{ background:"#16213E", borderRadius:"14px", width:"100%", maxWidth:"700px",
              border:"1px solid rgba(255,255,255,0.12)", boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.08)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <h3 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif" }}>
                    📋 Kardex
                  </h3>
                  <div style={{ color:"#9BBACC", fontSize:"12px" }}>
                    {inventario.find(i=>i.supply_id===vistaKardex)?.supply?.name}
                  </div>
                </div>
                <button onClick={()=>setVistaKardex(null)} style={{ ...btnGhost, padding:"8px 12px" }}>✕</button>
              </div>
              <div style={{ padding:"16px 20px" }}>
                {loadingKardex ? (
                  <div style={{ color:"#9BBACC", textAlign:"center", padding:"30px" }}>Cargando…</div>
                ) : kardexData.length === 0 ? (
                  <div style={{ color:"#9BBACC", textAlign:"center", padding:"30px" }}>Sin movimientos registrados.</div>
                ) : (
                  <>
                    <div style={{ display:"grid", gridTemplateColumns:"120px 80px 80px 80px 80px 1fr",
                      gap:"8px", padding:"4px 8px", color:"#9BBACC", fontSize:"11px", fontWeight:"700", marginBottom:"4px" }}>
                      <span>FECHA</span><span>TIPO</span><span>CANTIDAD</span><span>ANTERIOR</span><span>NUEVO</span><span>NOTAS</span>
                    </div>
                    {kardexData.map(k => (
                      <div key={k.id} style={{
                        display:"grid", gridTemplateColumns:"120px 80px 80px 80px 80px 1fr",
                        gap:"8px", alignItems:"center",
                        background:"rgba(255,255,255,0.03)", borderRadius:"6px",
                        padding:"7px 8px", marginBottom:"3px"
                      }}>
                        <span style={{ color:"#9BBACC", fontSize:"11px" }}>
                          {new Date(k.fecha).toLocaleDateString("es-CO")}
                        </span>
                        <span style={{ color: k.cantidad>0?"#22c55e":"#ef4444",
                          background: k.cantidad>0?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",
                          borderRadius:"6px", padding:"2px 8px", fontSize:"11px", fontWeight:"700" }}>
                          {k.tipo}
                        </span>
                        <span style={{ color: k.cantidad>0?"#22c55e":"#ef4444", fontWeight:"700", fontSize:"13px" }}>
                          {k.cantidad > 0 ? "+" : ""}{fmtNum(k.cantidad)}
                        </span>
                        <span style={{ color:"#9BBACC", fontSize:"12px" }}>{fmtNum(k.stock_anterior)}</span>
                        <span style={{ color:"#fff", fontWeight:"600", fontSize:"12px" }}>{fmtNum(k.stock_nuevo)}</span>
                        <span style={{ color:"#9BBACC", fontSize:"11px" }}>{k.notas}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
