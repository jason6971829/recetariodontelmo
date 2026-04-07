"use client";
import { useState, useEffect } from "react";
import { UNITS, SUPPLY_CATEGORIES } from "@/lib/constants";
import { getSupplies, saveSupply, deleteSupply } from "@/lib/storage";

function formatCurrency(n) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}

export function SuppliesPanel({ onClose }) {
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", unit: "KILO", cost_per_unit: "", supplier: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getSupplies();
    setSupplies(data);
    setLoading(false);
  };

  const filtered = supplies.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code || "").includes(search);
    const matchCat = filterCat === "all" || s.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleSave = async () => {
    if (!form.name.trim()) { alert("El nombre es obligatorio"); return; }
    setSaving(true);
    const row = {
      ...(editingId ? { id: editingId } : {}),
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.unit,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      supplier: form.supplier.trim(),
      category: form.category,
      active: true,
    };
    const saved = await saveSupply(row);
    if (saved) {
      await loadData();
      resetForm();
    } else {
      alert("Error al guardar");
    }
    setSaving(false);
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({ code: s.code || "", name: s.name, unit: s.unit, cost_per_unit: s.cost_per_unit || "", supplier: s.supplier || "", category: s.category || "" });
    setShowForm(true);
  };

  const handleDelete = async (s) => {
    if (!confirm(`¿Eliminar "${s.name}"?`)) return;
    await deleteSupply(s.id);
    await loadData();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ code: "", name: "", unit: "KILO", cost_per_unit: "", supplier: "", category: "" });
  };

  const inp = { padding: "9px 12px", border: "1.5px solid #E0D8CE", borderRadius: "8px", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" };

  // Categorias presentes en los insumos
  const usedCats = [...new Set(supplies.map(s => s.category).filter(Boolean))];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "900px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia,serif" }}>ADMINISTRACIÓN</div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "17px", fontWeight: "700", marginTop: "3px" }}>📦 Catálogo de Insumos</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>{supplies.length} insumos</span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #eee", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar por nombre o código..."
              style={{ ...inp, paddingLeft: "12px" }}
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{ ...inp, width: "auto", minWidth: "140px", background: "#fff" }}
          >
            <option value="all">Todas las categorías</option>
            {SUPPLY_CATEGORIES.map(c => (
              <option key={c} value={c}>{c} {usedCats.includes(c) ? `(${supplies.filter(s => s.category === c).length})` : ""}</option>
            ))}
          </select>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{
                background: "linear-gradient(135deg,#D4721A,#c0630f)", border: "none", borderRadius: "10px",
                color: "#fff", padding: "9px 18px", cursor: "pointer", fontSize: "13px", fontWeight: "700",
                display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 3px 12px rgba(212,114,26,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              + Nuevo Insumo
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", background: "#FDFAF6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "#333" }}>
                {editingId ? "✏️ Editar Insumo" : "➕ Nuevo Insumo"}
              </div>
              <button onClick={resetForm} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#999" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 140px", gap: "10px", alignItems: "end" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Código</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="084" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Nombre *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Carne Desmechada" style={inp} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Unidad</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inp, background: "#fff" }}>
                  {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Costo / {form.unit}</label>
                <input value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="28000" type="number" style={inp} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Proveedor</label>
                <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nombre del proveedor" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Categoría</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, background: "#fff" }}>
                  <option value="">Sin categoría</option>
                  {SUPPLY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{
                  background: saving ? "#ccc" : "linear-gradient(135deg,#D4721A,#c0630f)",
                  border: "none", borderRadius: "8px", color: "#fff", padding: "9px 20px",
                  cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "700",
                }}
              >
                {saving ? "⏳ Guardando..." : editingId ? "💾 Guardar" : "➕ Agregar"}
              </button>
              <button onClick={resetForm} style={{ background: "#eee", border: "none", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", color: "#666" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>⏳ Cargando insumos...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
              <div style={{ fontSize: "40px" }}>📦</div>
              <div style={{ marginTop: "10px", fontSize: "14px" }}>{search ? "No se encontraron insumos" : "No hay insumos registrados"}</div>
              <div style={{ marginTop: "6px", fontSize: "12px", color: "#aaa" }}>Usa el botón "+ Nuevo Insumo" para agregar</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#F7F3EE", borderBottom: "2px solid #E0D8CE" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px", letterSpacing: "0.5px" }}>CÓDIGO</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px", letterSpacing: "0.5px" }}>NOMBRE</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px", letterSpacing: "0.5px" }}>UNIDAD</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: "#888", fontSize: "11px", letterSpacing: "0.5px" }}>COSTO</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px", letterSpacing: "0.5px" }}>PROVEEDOR</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: "700", color: "#888", fontSize: "11px", letterSpacing: "0.5px" }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f0ebe5", background: i % 2 === 0 ? "#fff" : "#FDFAF6", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f5efe8"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FDFAF6"}
                  >
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ background: "rgba(212,114,26,0.1)", color: "#D4721A", padding: "2px 8px", borderRadius: "6px", fontWeight: "600", fontSize: "12px", fontFamily: "monospace" }}>
                        {s.code || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", fontWeight: "600", color: "#333" }}>
                      {s.name}
                      {s.category && <span style={{ display: "block", fontSize: "11px", color: "#aaa", fontWeight: "400" }}>{s.category}</span>}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#666" }}>{s.unit}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: "var(--app-primary-dark, #1B3A5C)", fontFamily: "Georgia,serif" }}>
                      {formatCurrency(s.cost_per_unit)}
                      <span style={{ display: "block", fontSize: "10px", color: "#aaa", fontWeight: "400" }}>/{s.unit.toLowerCase()}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "#888", fontSize: "12px" }}>{s.supplier || "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                        <button onClick={() => handleEdit(s)} style={{ background: "rgba(212,114,26,0.12)", border: "none", borderRadius: "6px", color: "#D4721A", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }} title="Editar">✏️</button>
                        <button onClick={() => handleDelete(s)} style={{ background: "rgba(231,76,60,0.1)", border: "none", borderRadius: "6px", color: "#e74c3c", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }} title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
