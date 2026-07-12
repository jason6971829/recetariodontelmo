"use client";
import { useState, useEffect, useRef, useMemo } from "react";

// Cache en memoria; el fetch es a nuestro proxy /api/productos (con cache 5min).
let _cache = null;
let _promise = null;

async function fetchProductos() {
  if (_cache) return _cache;
  if (_promise) return _promise;
  _promise = fetch("/api/productos")
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(data => {
      _cache = Array.isArray(data) ? data : [];
      _promise = null;
      return _cache;
    })
    .catch(err => {
      _promise = null;
      console.error("fetchProductos error:", err);
      return [];
    });
  return _promise;
}

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Selector de titulo de receta desde el catalogo unificado de productos
 * de gabycontrol (contrato v4). Al elegir, devuelve el nombre EXACTO.
 *
 * Props:
 *   value              — string, nombre actual
 *   onChange(name)     — callback con el nombre (texto libre o elegido)
 *   onSelect(producto) — callback al elegir un producto del catalogo
 *                        (recibe { nombre, barcode, categoria, ... }); permite
 *                        guardar el barcode ademas del nombre
 *   allowFree          — si true, muestra toggle para editar libremente
 *                        (para sub-recetas "S. ..." y bases de bodega)
 *   onlyWithoutRecipe  — si true, pre-filtra a productos sin receta
 */
export function ProductoSelector({ value, onChange, onSelect, allowFree = true, onlyWithoutRecipe = false }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState(value || "");
  const [showList, setShowList] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(onlyWithoutRecipe);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchProductos().then(data => {
      setProductos(data);
      setLoading(false);
      if (!data.length) setError("No pude cargar el catalogo de productos.");
    });
  }, []);

  // Sincronizar cuando el valor cambia desde afuera (ej: crear-desde-cola)
  useEffect(() => { setQuery(value || ""); }, [value]);

  // Si el valor actual no matchea ningun producto, activar modo libre
  // (excepto si empieza con "S." que es sub-receta y ya es libre por diseno)
  useEffect(() => {
    if (!value || !productos.length) return;
    const match = productos.some(p => p.nombre === value);
    if (!match && !value.startsWith("S.")) setFreeMode(true);
  }, [value, productos]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    let pool = productos;
    if (onlyMissing) pool = pool.filter(p => !p.tiene_receta);
    if (!q) return pool.slice(0, 50);
    const matches = [];
    for (const p of pool) {
      const n = normalize(p.nombre || "");
      const c = normalize(p.categoria || "");
      if (n.includes(q) || c.includes(q)) {
        matches.push(p);
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [query, productos, onlyMissing]);

  const missingCount = useMemo(
    () => productos.filter(p => !p.tiene_receta).length,
    [productos]
  );

  const pick = (p) => {
    onChange(p.nombre);
    onSelect?.(p); // propaga barcode + categoria al padre
    setQuery(p.nombre);
    setShowList(false);
    inputRef.current?.blur();
  };

  const inp = {
    padding: "10px 12px",
    border: "1.5px solid #E0D8CE",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
    width: "100%",
  };

  // Modo libre: input de texto normal (sub-recetas, bases)
  if (freeMode) {
    return (
      <div style={{ position: "relative" }}>
        <input
          style={inp}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder='Ej: S. Salsa Especial, Base Ceviche...'
        />
        {allowFree && (
          <button
            type="button"
            onClick={() => { setFreeMode(false); setQuery(""); }}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#7C3AED", fontSize: 11,
              fontWeight: 700, cursor: "pointer", padding: 4,
            }}
            title="Volver al selector del catalogo"
          >elegir del catalogo ↺</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom: 4, fontSize:11, color:"#888" }}>
        {loading && <span style={{ color:"#D4721A", fontWeight:700 }}>· cargando catalogo...</span>}
        {!loading && !error && (
          <>
            <span style={{ color:"#22c55e", fontWeight:700 }}>· {productos.length} productos</span>
            {missingCount > 0 && (
              <label style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={e => setOnlyMissing(e.target.checked)}
                />
                <span>Solo sin receta ({missingCount})</span>
              </label>
            )}
          </>
        )}
        {error && <span style={{ color:"#c0392b", fontWeight:700 }}>· {error}</span>}
      </div>

      <input
        ref={inputRef}
        style={inp}
        value={query}
        onChange={e => { setQuery(e.target.value); setShowList(true); onChange(e.target.value); }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 200)}
        placeholder="Buscar producto del menu... (ej: hawaiana, salmon)"
        disabled={loading}
      />

      {allowFree && (
        <button
          type="button"
          onClick={() => setFreeMode(true)}
          style={{
            marginTop: 4, background: "none", border: "none",
            color: "#7C3AED", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0,
          }}
          title="Escribir un titulo libre (para sub-recetas o bases que no son productos del menu)"
        >
          usar titulo libre ↺
        </button>
      )}

      {showList && results.length > 0 && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#fff", border: "1.5px solid #E0D8CE", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 320, overflowY: "auto",
            zIndex: 50,
          }}
        >
          {results.map(p => (
            <div
              key={p.id || p.nombre}
              onMouseDown={() => pick(p)}
              style={{
                padding: "9px 12px", cursor: "pointer",
                borderBottom: "1px solid #f5f1ec",
                display: "flex", alignItems: "center", gap: 10, fontSize: 13,
                background: !p.tiene_receta ? "#FEF3C7" : "#fff",
              }}
              onMouseEnter={e => e.currentTarget.style.background = !p.tiene_receta ? "#FDE68A" : "#F7F3EE"}
              onMouseLeave={e => e.currentTarget.style.background = !p.tiene_receta ? "#FEF3C7" : "#fff"}
            >
              <span style={{ flex:1, color: "#333", fontWeight: 600 }}>{p.nombre}</span>
              <span style={{ fontSize: 10, color: "#888", background:"#F0ECE6", padding:"2px 6px", borderRadius:4 }}>
                {p.categoria}
              </span>
              {!p.tiene_receta && (
                <span style={{ background: "#F59E0B", color: "#fff", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>
                  SIN RECETA
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showList && !loading && query.trim() && results.length === 0 && (
        <div style={{ marginTop: 6, padding: "8px 12px", fontSize: 12, color: "#888", background: "#fff", borderRadius: 8, border: "1px solid #E0D8CE" }}>
          No se encontro nada con &quot;{query}&quot;. Si es una sub-receta o base, tocá <b>usar titulo libre</b>.
        </div>
      )}
    </div>
  );
}
