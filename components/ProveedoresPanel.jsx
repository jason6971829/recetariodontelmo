"use client";
import { useState, useEffect } from "react";
import { getProveedores, saveProveedor, deleteProveedor } from "@/lib/storage";

const CIUDADES = ["Bogotá","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga","Pereira","Manizales","Otra"];
const CATS_SUPPLY = ["Carnes","Pollo","Pescados","Lácteos","Frutas","Verduras","Granos","Bebidas","Empaques","Limpieza","Varios"];

const EMPTY_FORM = {
  codigo:"", nombre:"", nit:"", contacto:"", telefono:"", email:"",
  ciudad:"Bogotá", condiciones:"Contado", categorias:[], activo:true, notas:""
};

function Badge({ label, color="#D4721A" }) {
  return (
    <span style={{ background:`${color}22`, color, border:`1px solid ${color}55`,
      borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"700" }}>
      {label}
    </span>
  );
}

export function ProveedoresPanel({ onClose }) {
  const [proveedores, setProveedores]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [confirmDel, setConfirmDel]     = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await getProveedores();
    setProveedores(data);
    setLoading(false);
  };

  const filtered = proveedores.filter(p =>
    !search ||
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.nit || "").includes(search) ||
    (p.ciudad || "").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setForm({
      codigo: p.codigo||"", nombre: p.nombre||"", nit: p.nit||"",
      contacto: p.contacto||"", telefono: p.telefono||"", email: p.email||"",
      ciudad: p.ciudad||"Bogotá", condiciones: p.condiciones||"Contado",
      categorias: p.categorias||[], activo: p.activo!==false, notas: p.notas||""
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    setSaving(true);
    const row = { ...(editingId ? { id: editingId } : {}), ...form };
    const saved = await saveProveedor(row);
    if (saved) { await load(); resetForm(); }
    else alert("Error al guardar");
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const ok = await deleteProveedor(id);
    if (ok) setProveedores(prev => prev.filter(p => p.id !== id));
    setConfirmDel(null);
  };

  const toggleCat = (cat) => {
    setForm(f => ({
      ...f,
      categorias: f.categorias.includes(cat)
        ? f.categorias.filter(c => c !== cat)
        : [...f.categorias, cat]
    }));
  };

  // ── Estilos comunes ──────────────────────────────────────────────
  const overlay = {
    position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
    zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center",
    padding:"20px 12px", overflowY:"auto"
  };
  const modal = {
    background:"#1A1A2E", borderRadius:"16px", width:"100%", maxWidth:"900px",
    boxShadow:"0 20px 60px rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)"
  };
  const inp = {
    width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:"8px", color:"#fff", padding:"9px 12px", fontSize:"14px", outline:"none",
    boxSizing:"border-box"
  };
  const label = { color:"#9BBACC", fontSize:"12px", fontWeight:"600", marginBottom:"4px", display:"block" };
  const btnPrimary = {
    background:"linear-gradient(135deg,#D4721A,#b85e14)", border:"none", borderRadius:"8px",
    color:"#fff", padding:"10px 20px", cursor:"pointer", fontSize:"14px", fontWeight:"700"
  };
  const btnGhost = {
    background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:"8px", color:"#fff", padding:"10px 16px", cursor:"pointer", fontSize:"13px"
  };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif", fontSize:"20px" }}>
              🏭 Proveedores
            </h2>
            <div style={{ color:"#9BBACC", fontSize:"13px", marginTop:"2px" }}>
              {proveedores.length} proveedores registrados
            </div>
          </div>
          <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
              + Nuevo Proveedor
            </button>
            <button onClick={onClose} style={{ ...btnGhost, padding:"10px 12px" }}>✕</button>
          </div>
        </div>

        {/* Buscador */}
        <div style={{ padding:"16px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <input
            placeholder="Buscar por nombre, NIT o ciudad…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, maxWidth:"380px" }}
          />
        </div>

        {/* Lista */}
        <div style={{ padding:"16px 24px", minHeight:"300px" }}>
          {loading ? (
            <div style={{ color:"#9BBACC", textAlign:"center", padding:"40px" }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color:"#9BBACC", textAlign:"center", padding:"40px" }}>
              <div style={{ fontSize:"40px" }}>🏭</div>
              <div style={{ marginTop:"12px" }}>
                {search ? "Sin resultados" : "No hay proveedores. Crea el primero."}
              </div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"12px" }}>
              {filtered.map(p => (
                <div key={p.id} style={{
                  background:"rgba(255,255,255,0.04)", borderRadius:"12px",
                  border:"1px solid rgba(255,255,255,0.09)", padding:"16px",
                  display:"flex", flexDirection:"column", gap:"8px"
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ color:"#fff", fontWeight:"700", fontSize:"14px", fontFamily:"Georgia,serif" }}>
                        {p.nombre}
                      </div>
                      {p.nit && <div style={{ color:"#9BBACC", fontSize:"11px" }}>NIT: {p.nit}</div>}
                    </div>
                    <Badge label={p.activo ? "Activo" : "Inactivo"} color={p.activo ? "#22c55e" : "#ef4444"} />
                  </div>

                  {(p.contacto || p.telefono) && (
                    <div style={{ color:"#c0d5e0", fontSize:"12px" }}>
                      {p.contacto && <span>👤 {p.contacto}</span>}
                      {p.contacto && p.telefono && " · "}
                      {p.telefono && <span>📞 {p.telefono}</span>}
                    </div>
                  )}
                  {p.ciudad && (
                    <div style={{ color:"#c0d5e0", fontSize:"12px" }}>📍 {p.ciudad}</div>
                  )}
                  {p.categorias?.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
                      {p.categorias.map(c => <Badge key={c} label={c} color="#7C6AF5" />)}
                    </div>
                  )}
                  {p.condiciones && (
                    <div style={{ color:"#9BBACC", fontSize:"11px" }}>💳 {p.condiciones}</div>
                  )}

                  <div style={{ display:"flex", gap:"8px", marginTop:"4px" }}>
                    <button onClick={() => handleEdit(p)} style={{ ...btnGhost, flex:1, fontSize:"12px", padding:"7px" }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => setConfirmDel(p)} style={{
                      background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.25)",
                      borderRadius:"8px", color:"#ef4444", padding:"7px 12px", cursor:"pointer", fontSize:"12px"
                    }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario (slide-in) */}
        {showForm && (
          <div style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1100,
            display:"flex", alignItems:"center", justifyContent:"center", padding:"20px"
          }}>
            <div style={{
              background:"#16213E", borderRadius:"16px", width:"100%", maxWidth:"560px",
              maxHeight:"90vh", overflowY:"auto", border:"1px solid rgba(255,255,255,0.12)",
              boxShadow:"0 20px 60px rgba(0,0,0,0.5)"
            }}>
              <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                <h3 style={{ margin:0, color:"#fff", fontFamily:"Georgia,serif" }}>
                  {editingId ? "✏️ Editar Proveedor" : "➕ Nuevo Proveedor"}
                </h3>
              </div>
              <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"14px" }}>
                {/* Fila 1 */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div>
                    <label style={label}>Nombre *</label>
                    <input style={inp} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del proveedor" />
                  </div>
                  <div>
                    <label style={label}>NIT / Cédula</label>
                    <input style={inp} value={form.nit} onChange={e=>setForm(f=>({...f,nit:e.target.value}))} placeholder="000.000.000-0" />
                  </div>
                </div>
                {/* Fila 2 */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div>
                    <label style={label}>Contacto</label>
                    <input style={inp} value={form.contacto} onChange={e=>setForm(f=>({...f,contacto:e.target.value}))} placeholder="Nombre de contacto" />
                  </div>
                  <div>
                    <label style={label}>Teléfono / WhatsApp</label>
                    <input style={inp} value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} placeholder="300 000 0000" />
                  </div>
                </div>
                {/* Fila 3 */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div>
                    <label style={label}>Correo electrónico</label>
                    <input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="proveedor@empresa.com" />
                  </div>
                  <div>
                    <label style={label}>Ciudad</label>
                    <select style={inp} value={form.ciudad} onChange={e=>setForm(f=>({...f,ciudad:e.target.value}))}>
                      {CIUDADES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {/* Condiciones */}
                <div>
                  <label style={label}>Condiciones de pago</label>
                  <select style={inp} value={form.condiciones} onChange={e=>setForm(f=>({...f,condiciones:e.target.value}))}>
                    {["Contado","8 días","15 días","30 días","45 días","60 días","Consignación"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                {/* Categorías */}
                <div>
                  <label style={label}>Categorías que suministra</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                    {CATS_SUPPLY.map(cat => {
                      const sel = form.categorias.includes(cat);
                      return (
                        <button key={cat} onClick={() => toggleCat(cat)} style={{
                          background: sel ? "rgba(212,114,26,0.3)" : "rgba(255,255,255,0.07)",
                          border: `1px solid ${sel ? "#D4721A" : "rgba(255,255,255,0.15)"}`,
                          borderRadius:"20px", color: sel ? "#D4721A" : "#9BBACC",
                          padding:"4px 12px", cursor:"pointer", fontSize:"12px", fontWeight: sel ? "700" : "400"
                        }}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Notas */}
                <div>
                  <label style={label}>Notas internas</label>
                  <textarea style={{ ...inp, height:"70px", resize:"vertical" }}
                    value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                    placeholder="Observaciones, horarios de entrega, etc." />
                </div>
                {/* Activo */}
                <label style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer" }}>
                  <input type="checkbox" checked={form.activo}
                    onChange={e=>setForm(f=>({...f,activo:e.target.checked}))}
                    style={{ width:"16px", height:"16px" }} />
                  <span style={{ color:"#fff", fontSize:"13px" }}>Proveedor activo</span>
                </label>
              </div>
              <div style={{ padding:"16px 24px", borderTop:"1px solid rgba(255,255,255,0.08)",
                display:"flex", gap:"10px", justifyContent:"flex-end" }}>
                <button onClick={resetForm} style={btnGhost}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving?0.6:1 }}>
                  {saving ? "Guardando…" : (editingId ? "Guardar cambios" : "Crear proveedor")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm delete */}
        {confirmDel && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1200,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#1A1A2E", borderRadius:"14px", padding:"28px", maxWidth:"340px",
              textAlign:"center", border:"1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize:"36px" }}>🗑️</div>
              <h3 style={{ color:"#fff", margin:"12px 0 8px", fontFamily:"Georgia,serif" }}>
                Eliminar proveedor
              </h3>
              <p style={{ color:"#9BBACC", fontSize:"14px", margin:"0 0 20px" }}>
                ¿Eliminar <strong style={{ color:"#fff" }}>{confirmDel.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
              <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
                <button onClick={() => setConfirmDel(null)} style={btnGhost}>Cancelar</button>
                <button onClick={() => handleDelete(confirmDel.id)} style={{
                  background:"#ef4444", border:"none", borderRadius:"8px",
                  color:"#fff", padding:"10px 20px", cursor:"pointer", fontWeight:"700"
                }}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
