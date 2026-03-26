"use client";
import { useState, useEffect } from "react";
import { getActivityReport } from "@/lib/storage";
import { useIsMobile } from "@/hooks/useIsMobile";

export function ActivityReport({ onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | today | week
  const [userFilter, setUserFilter] = useState("all");
  const [sedeFilter, setSedeFilter] = useState("all");
  const isMobile = useIsMobile();
  const SEDES = ["Almendros", "Hayuelos", "Capriani", "Campiña", "Felicidad", "Calera", "Granada", "Oficina"];

  useEffect(() => {
    (async () => {
      const data = await getActivityReport();
      setActivity(data);
      setLoading(false);
    })();
  }, []);

  // Filtrar por fecha
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const filtered = activity.filter(a => {
    const date = new Date(a.created_at);
    if (filter === "today" && date < today) return false;
    if (filter === "week" && date < weekAgo) return false;
    if (userFilter !== "all" && String(a.user_id) !== userFilter) return false;
    if (sedeFilter !== "all" && (a.users?.sede || "") !== sedeFilter) return false;
    return true;
  });

  // Estadísticas
  const uniqueUsers = [...new Set(filtered.map(a => a.user_id))];
  const userStats = {};
  filtered.forEach(a => {
    const name = a.users?.name || "Desconocido";
    const sede = a.users?.sede || "Sin sede";
    const key = a.user_id;
    if (!userStats[key]) userStats[key] = { name, sede, role: a.users?.role, views: 0, logins: 0, tts: 0, searches: 0, recipes: new Set() };
    if (a.action === "view_recipe") { userStats[key].views++; userStats[key].recipes.add(a.recipe_name); }
    if (a.action === "login") userStats[key].logins++;
    if (a.action === "tts_play") userStats[key].tts++;
    if (a.action === "search") userStats[key].searches++;
  });

  const allUsers = Object.entries(userStats).map(([id, s]) => ({ id, ...s, recipeCount: s.recipes.size })).sort((a, b) => b.views - a.views);

  const actionLabels = {
    login: "🔑 Inició sesión",
    view_recipe: "👁️ Vio receta",
    tts_play: "🔊 Escuchó lectura",
    search: "🔍 Buscó",
    edit_recipe: "✏️ Editó receta",
    create_recipe: "➕ Creó receta",
    delete_recipe: "🗑️ Eliminó receta",
  };

  const formatDate = (d) => {
    const date = new Date(d);
    const hoy = new Date();
    const isToday = date.toDateString() === hoy.toDateString();
    const time = date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Hoy ${time}`;
    return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) + ` ${time}`;
  };

  const filterBtn = (val, label) => (
    <button
      onClick={() => setFilter(val)}
      style={{
        padding: "6px 14px", border: "none", borderRadius: "8px", cursor: "pointer",
        background: filter === val ? "#1B3A5C" : "#F0ECE6",
        color: filter === val ? "#fff" : "#5a3e2b",
        fontSize: "12px", fontWeight: "600", transition: "all 0.15s",
      }}
    >{label}</button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "0" : "16px" }}>
      <div style={{
        background: "#fff", borderRadius: isMobile ? "20px 20px 0 0" : "16px",
        width: "100%", maxWidth: "800px",
        height: isMobile ? "95vh" : "auto",
        maxHeight: isMobile ? "95vh" : "90vh",
        marginTop: isMobile ? "auto" : "0",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)"
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1B3A5C,#0d2340)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia,serif" }}>ADMINISTRACIÓN</div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "17px", fontWeight: "700", marginTop: "3px" }}>Reporte de Actividad</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
            Cargando reporte...
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
            {/* Filtros */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
              {filterBtn("all", "Todo")}
              {filterBtn("today", "Hoy")}
              {filterBtn("week", "Esta semana")}
              <select
                value={sedeFilter}
                onChange={e => setSedeFilter(e.target.value)}
                style={{ padding: "6px 10px", border: "1.5px solid #E0D8CE", borderRadius: "8px", fontSize: "12px", outline: "none", background: "#fff" }}
              >
                <option value="all">📍 Todas las sedes</option>
                {SEDES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                style={{ padding: "6px 10px", border: "1.5px solid #E0D8CE", borderRadius: "8px", fontSize: "12px", outline: "none", background: "#fff" }}
              >
                <option value="all">👤 Todos los usuarios</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.sede})</option>
                ))}
              </select>
            </div>

            {/* Resumen */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "Usuarios activos", value: uniqueUsers.length, icon: "👥", color: "#1B3A5C" },
                { label: "Recetas vistas", value: filtered.filter(a => a.action === "view_recipe").length, icon: "👁️", color: "#27ae60" },
                { label: "Lecturas TTS", value: filtered.filter(a => a.action === "tts_play").length, icon: "🔊", color: "#D4721A" },
                { label: "Búsquedas", value: filtered.filter(a => a.action === "search").length, icon: "🔍", color: "#8e44ad" },
              ].map(s => (
                <div key={s.label} style={{ background: "#F7F3EE", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px" }}>{s.icon}</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: s.color, fontFamily: "Georgia,serif" }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: "#888", fontWeight: "600", letterSpacing: "0.5px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabla de usuarios */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1B3A5C", letterSpacing: "1px", marginBottom: "10px", fontFamily: "Georgia,serif" }}>
                ACTIVIDAD POR USUARIO ({allUsers.length})
              </div>
            <div style={{ maxHeight: "240px", overflowY: "auto", borderRadius: "10px" }}>
              {allUsers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#888", fontSize: "13px" }}>No hay actividad registrada aún</div>
              ) : (
                allUsers.map(u => (
                  <div key={u.id} onClick={() => setUserFilter(userFilter === u.id ? "all" : u.id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: userFilter === u.id ? "#E8F0FA" : "#F7F3EE", borderRadius: "10px", marginBottom: "6px", cursor: "pointer", border: userFilter === u.id ? "2px solid #1B3A5C" : "2px solid transparent", transition: "all 0.15s" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: u.role === "admin" ? "#1B3A5C" : "#D4721A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "14px", flexShrink: 0 }}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: "#1B3A5C" }}>
                        {u.name}
                        {u.sede && <span style={{ fontSize: "11px", color: "#888", fontWeight: "400", marginLeft: "8px" }}>📍 {u.sede}</span>}
                        {userFilter === u.id && <span style={{ fontSize: "10px", color: "#1B3A5C", fontWeight: "700", marginLeft: "8px", background: "#D4E8FF", padding: "2px 8px", borderRadius: "10px" }}>✓ Seleccionado</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "#888", marginTop: "2px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <span>👁️ {u.views} vistas</span>
                        <span>📖 {u.recipeCount} recetas únicas</span>
                        <span>🔊 {u.tts} lecturas</span>
                        <span>🔑 {u.logins} sesiones</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>

            {/* Historial reciente */}
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1B3A5C", letterSpacing: "1px", marginBottom: "10px", fontFamily: "Georgia,serif" }}>
                HISTORIAL RECIENTE
              </div>
              {filtered.slice(0, 50).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderBottom: "1px solid #F0ECE6", fontSize: "13px" }}>
                  <div style={{ color: "#888", fontSize: "11px", flexShrink: 0, minWidth: "80px" }}>{formatDate(a.created_at)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: "600", color: "#1B3A5C" }}>{a.users?.name || "?"}</span>
                    {a.users?.sede && <span style={{ fontSize: "10px", color: "#aaa", marginLeft: "4px" }}>({a.users.sede})</span>}
                    <span style={{ color: "#666", marginLeft: "6px" }}>{actionLabels[a.action] || a.action}</span>
                    {a.recipe_name && <span style={{ color: "#D4721A", fontWeight: "600", marginLeft: "4px" }}>"{a.recipe_name}"</span>}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "30px", color: "#888", fontSize: "13px" }}>No hay actividad en este período</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
