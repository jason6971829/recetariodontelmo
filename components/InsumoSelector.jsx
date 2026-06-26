"use client";
import { useState, useEffect, useRef, useMemo } from "react";

const UNITS = ["GRAMOS", "KILO", "LITRO", "ML", "UNIDAD", "LIBRA", "ONZA", "PORCION"];

// Cache en memoria para no fetchear en cada apertura del modal
let _insumosCache = null;
let _fetchPromise = null;

async function fetchInsumos() {
  if (_insumosCache) return _insumosCache;
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetch("/api/insumos")
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(data => {
      _insumosCache = Array.isArray(data) ? data : [];
      _fetchPromise = null;
      return _insumosCache;
    })
    .catch(err => {
      _fetchPromise = null;
      console.error("fetchInsumos error:", err);
      return [];
    });
  return _fetchPromise;
}

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Selector de insumo desde el catalogo de gabycontrol.
 *
 * onAdd recibe el ingrediente compuesto como string:
 *   "20 GRAMOS - Cebolla Morada | 227"
 *
 * @param {function} onAdd        — callback(stringIngrediente)
 * @param {object}   [initial]    — { codigo, nombre, qty, unit } para modo edicion
 * @param {function} [onCancel]   — solo en modo edicion
 */
export function InsumoSelector({ onAdd, initial, onCancel }) {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial ? {
    id: null, codigo: initial.codigo || "", nombre: initial.nombre || "", unidad: initial.unit || "",
  } : null);
  const [qty, setQty] = useState(initial?.qty != null ? String(initial.qty) : "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [showList, setShowList] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetchInsumos().then(data => {
      setInsumos(data);
      setLoading(false);
      if (!data.length) setError("No pude cargar el catalogo. Revisa la API key.");
    });
  }, []);

  // Filtrar resultados (limita a 50 para no laggear)
  const results = useMemo(() => {
    if (!query.trim()) return insumos.slice(0, 50);
    const q = normalize(query);
    const matches = [];
    for (const ins of insumos) {
      const codigo = String(ins.codigo || "");
      const nombre = normalize(ins.nombre || "");
      if (codigo.includes(query) || nombre.includes(q)) {
        matches.push(ins);
        if (matches.length >= 50) break;
      }
    }
    return matches;
  }, [query, insumos]);

  const pick = (ins) => {
    setSelected({ id: ins.id, codigo: ins.codigo, nombre: ins.nombre, unidad: ins.unidad });
    if (!unit) setUnit(ins.unidad || "GRAMOS");
    setQuery("");
    setShowList(false);
  };

  const clear = () => { setSelected(null); setQuery(""); setShowList(true); inputRef.current?.focus(); };

  const submit = () => {
    if (!selected || !qty || !unit) return;
    const ingredient = `${qty} ${unit} - ${selected.nombre} | ${selected.codigo}`;
    onAdd(ingredient);
    // Reset para seguir agregando
    if (!initial) {
      setSelected(null); setQty(""); setUnit(""); setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const inp = {
    padding: "9px 12px",
    border: "1.5px solid #E0D8CE",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none",
    background: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{ position: "relative", background: "#FDFAF6", border: "1.5px solid #E0D8CE", borderRadius: "10px", padding: "12px" }}>
      {!selected ? (
        <>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>
            BUSCAR INSUMO {loading && <span style={{ color: "#D4721A" }}>· cargando catalogo...</span>}
            {!loading && !error && <span style={{ color: "#22c55e" }}>· {insumos.length} disponibles</span>}
            {error && <span style={{ color: "#c0392b" }}>· {error}</span>}
          </div>
          <input
            ref={inputRef}
            style={{ ...inp, width: "100%" }}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowList(true); }}
            onFocus={() => setShowList(true)}
            placeholder="Buscar por nombre o codigo... (ej: cebolla, 171)"
            disabled={loading}
          />
          {showList && results.length > 0 && (
            <div
              ref={listRef}
              style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "#fff", border: "1.5px solid #E0D8CE", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 280, overflowY: "auto",
                zIndex: 50,
              }}
            >
              {results.map(ins => (
                <div
                  key={ins.id}
                  onClick={() => pick(ins)}
                  style={{
                    padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f5f1ec",
                    display: "flex", alignItems: "center", gap: 10, fontSize: 13,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F7F3EE"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                >
                  <span style={{ background: "#D4721A", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700, fontFamily: "monospace", minWidth: 50, textAlign: "center" }}>
                    {ins.codigo}
                  </span>
                  <span style={{ flex: 1, color: "#333", fontWeight: 500 }}>{ins.nombre}</span>
                  <span style={{ fontSize: 11, color: "#999" }}>{ins.unidad}</span>
                  {ins.tipo === "semiterminado" && (
                    <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>SEMI</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {showList && query.trim() && results.length === 0 && (
            <div style={{ marginTop: 6, padding: "8px 12px", fontSize: 12, color: "#888", background: "#fff", borderRadius: 8 }}>
              No se encontro nada con &quot;{query}&quot;
            </div>
          )}
        </>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, background: "#fff", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E0D8CE" }}>
            <span style={{ background: "#D4721A", color: "#fff", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
              {selected.codigo}
            </span>
            <span style={{ flex: 1, color: "#333", fontWeight: 600, fontSize: 13 }}>{selected.nombre}</span>
            <button onClick={clear} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16, padding: "0 6px" }} title="Cambiar insumo">×</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              step="0.001"
              min="0"
              style={{ ...inp, width: "100px", textAlign: "right", fontWeight: 700 }}
              value={qty}
              onChange={e => setQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="0"
              autoFocus={!initial}
            />
            <select
              style={{ ...inp, width: "120px", cursor: "pointer" }}
              value={unit}
              onChange={e => setUnit(e.target.value)}
            >
              <option value="">Unidad...</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <button
              onClick={submit}
              disabled={!qty || !unit}
              style={{
                background: (!qty || !unit) ? "#ccc" : "#D4721A",
                border: "none", borderRadius: 8, color: "#fff",
                padding: "9px 18px", cursor: (!qty || !unit) ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
              }}
            >
              {initial ? "Guardar" : "+ Agregar"}
            </button>
            {initial && onCancel && (
              <button onClick={onCancel} style={{ background: "#eee", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "#666" }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
