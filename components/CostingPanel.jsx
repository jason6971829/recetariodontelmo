"use client";
import { useState, useEffect, useMemo } from "react";
import { UNITS } from "@/lib/constants";
import { getSupplies, getRecipeCosts, getRecipeCost, saveRecipeCost } from "@/lib/storage";

function fmt(n) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}

function pct(n) { return (n || 0).toFixed(1) + "%"; }

function foodCostColor(fc) {
  if (fc <= 30) return "#22c55e";
  if (fc <= 35) return "#eab308";
  return "#ef4444";
}

export function CostingPanel({ recipes, onClose }) {
  const [supplies, setSupplies] = useState([]);
  const [recipeCosts, setRecipeCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [costData, setCostData] = useState(null);
  const [salePrice, setSalePrice] = useState("");
  const [costIngredients, setCostIngredients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  // Add ingredient form
  const [addForm, setAddForm] = useState({ supply_id: "", qty: "", unit: "" });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [s, rc] = await Promise.all([getSupplies(), getRecipeCosts()]);
    setSupplies(s);
    setRecipeCosts(rc);
    setLoading(false);
  };

  // Map recipe costs by recipe_id for quick lookup
  const costMap = useMemo(() => {
    const m = {};
    recipeCosts.forEach(rc => { m[rc.recipe_id] = rc; });
    return m;
  }, [recipeCosts]);

  // Supply lookup
  const supplyMap = useMemo(() => {
    const m = {};
    supplies.forEach(s => { m[s.id] = s; });
    return m;
  }, [supplies]);

  // Calculate total cost for a recipe cost entry
  const calcTotal = (ings) => {
    return (ings || []).reduce((sum, ing) => sum + (ing.subtotal || 0), 0);
  };

  // Categories from recipes
  const categories = useMemo(() => {
    const cats = [...new Set(recipes.map(r => r.category))].sort();
    return cats;
  }, [recipes]);

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat === "all" || r.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [recipes, search, filterCat]);

  // Open escandallo for a recipe
  const openRecipe = async (recipe) => {
    setSelectedRecipe(recipe);
    const existing = await getRecipeCost(recipe.id);
    if (existing) {
      setCostData(existing);
      setCostIngredients(existing.ingredients || []);
      setSalePrice(existing.sale_price || "");
    } else {
      setCostData(null);
      setCostIngredients([]);
      setSalePrice("");
    }
    setShowAdd(false);
    setAddForm({ supply_id: "", qty: "", unit: "" });
  };

  // Add ingredient to escandallo
  const addIngredient = () => {
    const supply = supplyMap[addForm.supply_id];
    if (!supply || !addForm.qty) return;
    const qty = parseFloat(addForm.qty) || 0;
    const unit = addForm.unit || supply.unit;
    const costPerUnit = supply.cost_per_unit || 0;
    const subtotal = qty * costPerUnit;

    setCostIngredients(prev => [...prev, {
      supply_id: supply.id,
      name: supply.name,
      code: supply.code,
      qty,
      unit,
      cost_per_unit: costPerUnit,
      subtotal,
    }]);
    setAddForm({ supply_id: "", qty: "", unit: "" });
    setShowAdd(false);
  };

  // Remove ingredient
  const removeIngredient = (idx) => {
    setCostIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  // Update ingredient qty
  const updateIngQty = (idx, newQty) => {
    setCostIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      const qty = parseFloat(newQty) || 0;
      return { ...ing, qty, subtotal: qty * (ing.cost_per_unit || 0) };
    }));
  };

  // Totals
  const totalCost = calcTotal(costIngredients);
  const salePriceNum = parseFloat(salePrice) || 0;
  const portions = parseInt(selectedRecipe?.portions) || 1;
  const costPerPortion = totalCost / portions;
  const foodCost = salePriceNum > 0 ? (totalCost / salePriceNum) * 100 : 0;
  const margin = salePriceNum - totalCost;

  // Save
  const handleSave = async () => {
    if (!selectedRecipe) return;
    setSaving(true);
    const row = {
      ...(costData?.id ? { id: costData.id } : {}),
      recipe_id: selectedRecipe.id,
      sale_price: salePriceNum,
      ingredients: costIngredients,
      notes: "",
    };
    const saved = await saveRecipeCost(row);
    if (saved) {
      setCostData(saved);
      await loadData();
    }
    setSaving(false);
  };

  const inp = { padding: "9px 12px", border: "1.5px solid #E0D8CE", borderRadius: "8px", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" };

  // ── DETAIL VIEW (Escandallo de una receta) ──
  if (selectedRecipe) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "850px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

          {/* Header */}
          <div style={{ background: "linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div>
              <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia,serif" }}>ESCANDALLO</div>
              <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "17px", fontWeight: "700", marginTop: "3px" }}>
                💰 {selectedRecipe.name}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginTop: "2px" }}>
                {selectedRecipe.category} • {portions} {portions === 1 ? "porción" : "porciones"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setSelectedRecipe(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", padding: "8px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>← Volver</button>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
              <div style={{ background: "#F7F3EE", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#888", fontWeight: "600", letterSpacing: "0.5px" }}>COSTO TOTAL</div>
                <div style={{ fontSize: "20px", fontWeight: "700", color: "#333", fontFamily: "Georgia,serif", marginTop: "4px" }}>{fmt(totalCost)}</div>
              </div>
              <div style={{ background: "#F7F3EE", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#888", fontWeight: "600", letterSpacing: "0.5px" }}>COSTO/PORCIÓN</div>
                <div style={{ fontSize: "20px", fontWeight: "700", color: "#333", fontFamily: "Georgia,serif", marginTop: "4px" }}>{fmt(costPerPortion)}</div>
              </div>
              <div style={{ background: "#F7F3EE", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#888", fontWeight: "600", letterSpacing: "0.5px" }}>FOOD COST</div>
                <div style={{ fontSize: "20px", fontWeight: "700", color: foodCostColor(foodCost), fontFamily: "Georgia,serif", marginTop: "4px" }}>{pct(foodCost)}</div>
              </div>
              <div style={{ background: "#F7F3EE", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#888", fontWeight: "600", letterSpacing: "0.5px" }}>MARGEN</div>
                <div style={{ fontSize: "20px", fontWeight: "700", color: margin >= 0 ? "#22c55e" : "#ef4444", fontFamily: "Georgia,serif", marginTop: "4px" }}>{fmt(margin)}</div>
              </div>
            </div>

            {/* Sale price */}
            <div style={{ display: "flex", gap: "12px", alignItems: "end", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>💵 Precio de Venta</label>
                <input
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="Ej: 25000"
                  type="number"
                  style={{ ...inp, fontSize: "16px", fontWeight: "700" }}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? "#ccc" : "linear-gradient(135deg,#D4721A,#c0630f)",
                  border: "none", borderRadius: "10px", color: "#fff", padding: "12px 24px",
                  cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "700",
                  boxShadow: "0 3px 12px rgba(212,114,26,0.3)", whiteSpace: "nowrap",
                }}
              >
                {saving ? "⏳ Guardando..." : "💾 Guardar Escandallo"}
              </button>
            </div>

            {/* Ingredients table */}
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "#333", fontFamily: "Georgia,serif" }}>Ingredientes del Escandallo</div>
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{
                  background: showAdd ? "#eee" : "rgba(212,114,26,0.12)", border: "none", borderRadius: "8px",
                  color: showAdd ? "#666" : "#D4721A", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                }}
              >
                {showAdd ? "✕ Cancelar" : "+ Agregar Insumo"}
              </button>
            </div>

            {/* Add ingredient form */}
            {showAdd && (
              <div style={{ background: "#FDFAF6", borderRadius: "10px", padding: "12px", marginBottom: "12px", display: "flex", gap: "8px", alignItems: "end", flexWrap: "wrap" }}>
                <div style={{ flex: 2, minWidth: "180px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Insumo</label>
                  <select
                    value={addForm.supply_id}
                    onChange={e => {
                      const s = supplyMap[e.target.value];
                      setAddForm(f => ({ ...f, supply_id: e.target.value, unit: s?.unit || f.unit }));
                    }}
                    style={{ ...inp, background: "#fff" }}
                  >
                    <option value="">Seleccionar insumo...</option>
                    {supplies.map(s => (
                      <option key={s.id} value={s.id}>{s.code ? `[${s.code}] ` : ""}{s.name} — {fmt(s.cost_per_unit)}/{s.unit}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: "90px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Cantidad</label>
                  <input value={addForm.qty} onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))} type="number" step="0.001" placeholder="0.5" style={inp} />
                </div>
                <div style={{ width: "100px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Unidad</label>
                  <select value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inp, background: "#fff" }}>
                    {UNITS.map(u => <option key={u.id} value={u.id}>{u.id}</option>)}
                  </select>
                </div>
                <button
                  onClick={addIngredient}
                  disabled={!addForm.supply_id || !addForm.qty}
                  style={{
                    background: !addForm.supply_id || !addForm.qty ? "#ccc" : "#D4721A",
                    border: "none", borderRadius: "8px", color: "#fff", padding: "9px 16px",
                    cursor: !addForm.supply_id || !addForm.qty ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "700",
                  }}
                >
                  + Agregar
                </button>
              </div>
            )}

            {/* Ingredients list */}
            {costIngredients.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#aaa", background: "#FDFAF6", borderRadius: "10px" }}>
                <div style={{ fontSize: "30px" }}>🧾</div>
                <div style={{ marginTop: "8px", fontSize: "13px" }}>No hay ingredientes en este escandallo</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>Usa "+ Agregar Insumo" para comenzar</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#F7F3EE", borderBottom: "2px solid #E0D8CE" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px" }}>INSUMO</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "700", color: "#888", fontSize: "11px" }}>CANT</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "700", color: "#888", fontSize: "11px" }}>UNIDAD</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: "700", color: "#888", fontSize: "11px" }}>COSTO/U</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: "700", color: "#888", fontSize: "11px" }}>SUBTOTAL</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "700", color: "#888", fontSize: "11px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {costIngredients.map((ing, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f0ebe5", background: i % 2 === 0 ? "#fff" : "#FDFAF6" }}>
                      <td style={{ padding: "8px 12px", fontWeight: "600", color: "#333" }}>
                        {ing.code && <span style={{ color: "#D4721A", fontSize: "11px", fontFamily: "monospace", marginRight: "6px" }}>[{ing.code}]</span>}
                        {ing.name}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <input
                          value={ing.qty}
                          onChange={e => updateIngQty(i, e.target.value)}
                          type="number"
                          step="0.001"
                          style={{ width: "70px", padding: "4px 6px", border: "1px solid #ddd", borderRadius: "6px", textAlign: "center", fontSize: "13px" }}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#888" }}>{ing.unit}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#666" }}>{fmt(ing.cost_per_unit)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: "700", color: "var(--app-primary-dark, #1B3A5C)" }}>{fmt(ing.subtotal)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <button onClick={() => removeIngredient(i)} style={{ background: "rgba(231,76,60,0.1)", border: "none", borderRadius: "6px", color: "#e74c3c", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "#F7F3EE", borderTop: "2px solid #D4721A" }}>
                    <td colSpan={4} style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", fontSize: "14px", color: "#333", fontFamily: "Georgia,serif" }}>COSTO TOTAL:</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", fontSize: "16px", color: "#D4721A", fontFamily: "Georgia,serif" }}>{fmt(totalCost)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW (todas las recetas) ──
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "900px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia,serif" }}>ADMINISTRACIÓN</div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "17px", fontWeight: "700", marginTop: "3px" }}>💰 Costeo de Recetas</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>{recipeCosts.length} costeadas</span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #eee", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar receta..." style={inp} />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inp, width: "auto", minWidth: "160px", background: "#fff" }}>
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Recipe list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>⏳ Cargando...</div>
          ) : filteredRecipes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
              <div style={{ fontSize: "40px" }}>🔍</div>
              <div style={{ marginTop: "10px" }}>No se encontraron recetas</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#F7F3EE", borderBottom: "2px solid #E0D8CE" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px" }}>RECETA</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#888", fontSize: "11px" }}>CATEGORÍA</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: "#888", fontSize: "11px" }}>COSTO</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: "#888", fontSize: "11px" }}>VENTA</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: "700", color: "#888", fontSize: "11px" }}>FOOD COST</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: "700", color: "#888", fontSize: "11px" }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((r, i) => {
                  const rc = costMap[r.id];
                  const cost = rc ? calcTotal(rc.ingredients) : 0;
                  const sale = rc?.sale_price || 0;
                  const fc = sale > 0 ? (cost / sale) * 100 : 0;
                  const hasCosting = !!rc;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openRecipe(r)}
                      style={{ borderBottom: "1px solid #f0ebe5", background: i % 2 === 0 ? "#fff" : "#FDFAF6", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f5efe8"}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FDFAF6"}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: "600", color: "#333" }}>{r.name}</td>
                      <td style={{ padding: "10px 16px", color: "#888", fontSize: "12px" }}>{r.category}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: "600", color: hasCosting ? "#333" : "#ccc" }}>
                        {hasCosting ? fmt(cost) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: hasCosting ? "#333" : "#ccc" }}>
                        {hasCosting && sale > 0 ? fmt(sale) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        {hasCosting && sale > 0 ? (
                          <span style={{ background: foodCostColor(fc) + "18", color: foodCostColor(fc), padding: "3px 10px", borderRadius: "12px", fontWeight: "700", fontSize: "12px" }}>
                            {pct(fc)}
                          </span>
                        ) : <span style={{ color: "#ccc" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        <span style={{
                          background: hasCosting ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.12)",
                          color: hasCosting ? "#22c55e" : "#eab308",
                          padding: "3px 10px", borderRadius: "12px", fontWeight: "600", fontSize: "11px",
                        }}>
                          {hasCosting ? "✓ Costeada" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
