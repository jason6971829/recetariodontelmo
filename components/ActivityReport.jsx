"use client";
import { useState, useEffect } from "react";
import { getActivityReport } from "@/lib/storage";
import { useViewport } from "@/hooks/useViewport";
import { useLang } from "@/lib/LangContext";
import { AdminShell, A, eyebrow, useCountUp } from "@/components/dt/AdminShell";
import { Icon } from "@/components/dt/ui";

// Trazos de los íconos de línea (mismos del diseño)
const IC = {
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  vol: "M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  dot: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  check: "M5 12l5 5L20 7",
};
const Ico = ({ d, size = 15, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// Tipo de evento → ícono y colores del cuadro
const EV = {
  login: [IC.key, "#FFF0E3", "#D9731A"],
  view_recipe: [IC.eye, "#E3F2FD", "#1A6B9E"],
  tts_play: [IC.vol, "#F5E9FF", "#8e44ad"],
  search: [IC.search, "#E8F8EE", "#1B7A47"],
  edit_recipe: [IC.pencil, "#EFEAE2", "#6E6A63"],
  create_recipe: ["M12 5v14M5 12h14", "#EFEAE2", "#6E6A63"],
  delete_recipe: ["M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5", "#FDECEA", "#C8423B"],
};
const EV_OTHER = [IC.dot, "#EFEAE2", "#6E6A63"];

// Las traducciones traen emojis al inicio; el rediseño usa solo íconos de línea
const noEmoji = (s) => String(s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function StatCard({ label, value, icon, c, bg, delay }) {
  const v = useCountUp(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "16px 10px 14px", borderRadius: 18, background: "#fff", boxShadow: "0 0 0 1px rgba(14,34,64,.06)", animation: "dtUp .5s both", animationDelay: delay }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: bg, color: c, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico d={icon} size={19} w={1.9} /></span>
      <span style={{ fontFamily: A.serif, fontSize: 34, fontWeight: 600, color: A.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("es-CO")}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: A.muted2, textAlign: "center" }}>{label}</span>
    </div>
  );
}

export function ActivityReport({ onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | today | week
  const [userFilter, setUserFilter] = useState("all");
  const [sedeFilter, setSedeFilter] = useState("all");
  const { mobile } = useViewport();
  const { t, lang } = useLang();
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
    const name = a.users?.name || t.report.unknown;
    const sede = a.users?.sede || t.report.noLocation;
    const key = a.user_id;
    if (!userStats[key]) userStats[key] = { name, sede, role: a.users?.role, views: 0, logins: 0, tts: 0, searches: 0, recipes: new Set() };
    if (a.action === "view_recipe") { userStats[key].views++; userStats[key].recipes.add(a.recipe_name); }
    if (a.action === "login") userStats[key].logins++;
    if (a.action === "tts_play") userStats[key].tts++;
    if (a.action === "search") userStats[key].searches++;
  });

  const allUsers = Object.entries(userStats).map(([id, s]) => ({ id, ...s, recipeCount: s.recipes.size })).sort((a, b) => b.views - a.views);

  const actionLabels = t.report.actions;

  const localeMap = { es: "es-CO", en: "en-US", pt: "pt-BR", fr: "fr-FR" };
  const locale = localeMap[lang] || "es-CO";

  // Sedes del selector: las de la app + cualquier otra que aparezca en los datos reales
  const dataSedes = [...new Set(activity.map(a => a.users?.sede).filter(Boolean))];
  const sedeOptions = [...SEDES, ...dataSedes.filter(s => !SEDES.includes(s)).sort()];

  const formatTime = (d) => new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const dayLabel = (d) => {
    const date = new Date(d);
    if (date.toDateString() === new Date().toDateString()) return t.report.today;
    const s = date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Historial (últimos 50) agrupado por día
  const history = [];
  let lastDay = null;
  filtered.slice(0, 50).forEach((a, i) => {
    const dk = new Date(a.created_at).toDateString();
    if (dk !== lastDay) { lastDay = dk; history.push({ head: true, key: "d-" + dk + "-" + i, day: dayLabel(a.created_at), i }); }
    history.push({ head: false, key: a.id ?? "r-" + i, a, i });
  });

  const stats = [
    { label: t.report.activeUsers, value: uniqueUsers.length, icon: IC.users, c: "#8e44ad", bg: "#F5E9FF" },
    { label: t.report.recipesViewed, value: filtered.filter(a => a.action === "view_recipe").length, icon: IC.eye, c: "#1A6B9E", bg: "#E3F2FD" },
    { label: t.report.ttsReadings, value: filtered.filter(a => a.action === "tts_play").length, icon: IC.vol, c: "#D9731A", bg: "#FFF0E3" },
    { label: t.report.searches, value: filtered.filter(a => a.action === "search").length, icon: IC.search, c: "#1B7A47", bg: "#E8F8EE" },
  ];

  const periods = [["all", t.report.all], ["today", t.report.today], ["week", t.report.week]];
  const selectStyle = { height: mobile ? 46 : 42, padding: "0 12px", borderRadius: 12, border: `1.5px solid ${A.line}`, background: "#fff", fontSize: mobile ? 16 : 13.5, fontWeight: 600, color: A.ink, flex: 1, minWidth: 140, fontFamily: "inherit", cursor: "pointer" };
  const emptyBox = { textAlign: "center", padding: "26px 16px", borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1px rgba(14,34,64,.06)", color: A.muted2, fontSize: 13.5, fontWeight: 600 };

  return (
    <AdminShell icon={Icon.activity({ width: 21, height: 21 })} eyebrow={t.admin} title={t.report.title} maxWidth={760} onClose={onClose}>
      {loading ? (
        <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "56px 16px", color: A.muted2, fontSize: 14, fontWeight: 600, animation: "dtFade .3s both" }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", border: `3px solid ${A.line}`, borderTopColor: A.orange, animation: "dtActSpin .8s linear infinite" }} />
          {t.report.loading}
          <style>{`@keyframes dtActSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div className="dt-adm" style={{ display: "flex", flexDirection: "column", gap: 16, animation: "dtUp .4s both" }}>
          {/* Filtros */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div role="group" style={{ display: "flex", padding: 4, borderRadius: 999, background: "#fff", boxShadow: `0 0 0 1px ${A.line}`, gap: 2, flex: mobile ? "1 1 100%" : "none" }}>
              {periods.map(([val, label]) => (
                <button key={val} type="button" aria-pressed={filter === val} onClick={() => setFilter(val)}
                  style={{ height: mobile ? 44 : 36, padding: "0 14px", borderRadius: 999, border: 0, background: filter === val ? A.navy : "transparent", color: filter === val ? "#fff" : A.muted, fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all .25s", fontFamily: "inherit", flex: mobile ? 1 : "none", whiteSpace: "nowrap" }}>
                  {label}
                </button>
              ))}
            </div>
            <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} aria-label={noEmoji(t.report.allSedes)} style={selectStyle}>
              <option value="all">{noEmoji(t.report.allSedes)}</option>
              {sedeOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} aria-label={noEmoji(t.report.allUsers)} style={selectStyle}>
              <option value="all">{noEmoji(t.report.allUsers)}</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.sede})</option>
              ))}
            </select>
          </div>

          {/* Resumen */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(${mobile ? 130 : 150}px,1fr))`, gap: 10 }}>
            {stats.map((s, i) => <StatCard key={s.label} {...s} delay={i * 70 + "ms"} />)}
          </div>

          {/* Actividad por usuario */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={eyebrow}>{t.report.activityByUser} · {allUsers.length}</span>
            {allUsers.length === 0 ? (
              <div style={emptyBox}>{t.report.noActivity}</div>
            ) : (
              allUsers.map((u, i) => {
                const sel = userFilter === u.id;
                const toggle = () => setUserFilter(sel ? "all" : u.id);
                return (
                  <div key={u.id} role="button" tabIndex={0} aria-pressed={sel} onClick={toggle}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "#fff", boxShadow: sel ? `0 0 0 2px ${A.orange}` : "0 0 0 1px rgba(14,34,64,.06)", cursor: "pointer", transition: "box-shadow .25s", animation: "dtUp .45s both", animationDelay: Math.min(i, 10) * 80 + "ms" }}>
                    <span style={{ width: 44, height: 44, borderRadius: "50%", background: u.role === "admin" ? A.navy : A.orange, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flex: "none" }}>{(String(u.name || "?")[0] || "?").toUpperCase()}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: A.navy }}>{u.name}</span>
                        {u.sede && <span style={{ fontSize: 11.5, fontWeight: 700, color: A.orange7, background: A.orange2, padding: "2px 8px", borderRadius: 999 }}>{u.sede}</span>}
                        {sel && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: A.navy, padding: "2px 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}><Ico d={IC.check} size={11} w={3} />{noEmoji(t.report.selected)}</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(112px,1fr))", gap: "4px 12px", fontSize: 12, color: A.muted }}>
                        <span><strong style={{ color: A.navy }}>{u.views}</strong> {t.report.views}</span>
                        <span><strong style={{ color: A.navy }}>{u.recipeCount}</strong> {t.report.uniqueRecipes}</span>
                        <span><strong style={{ color: A.navy }}>{u.tts}</strong> {t.report.readings}</span>
                        <span><strong style={{ color: A.navy }}>{u.logins}</strong> {t.report.sessions}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Historial reciente */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...eyebrow, marginBottom: 2 }}>{t.report.recentHistory}</span>
            {history.map(h => {
              const delay = Math.min(h.i, 12) * 30 + "ms";
              if (h.head) return (
                <div key={h.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px 4px", animation: "dtUp .4s both", animationDelay: delay }}>
                  <span style={{ fontFamily: A.serif, fontSize: 17, fontWeight: 600, color: A.navy }}>{h.day}</span>
                  <span style={{ flex: 1, height: 1, background: A.line }} />
                </div>
              );
              const a = h.a;
              const [icon, bg, c] = EV[a.action] || EV_OTHER;
              return (
                <div key={h.key} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46, padding: "6px 10px", borderRadius: 12, background: "#fff", boxShadow: "0 0 0 1px rgba(14,34,64,.05)", animation: "dtUp .4s both", animationDelay: delay }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: c, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ico d={icon} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: A.ink2, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                    <strong style={{ color: A.navy, fontWeight: 800 }}>{a.users?.name || "?"}</strong>
                    {a.users?.sede && <span style={{ color: A.muted3, fontSize: 11.5 }}> ({a.users.sede})</span>}
                    {" · "}{noEmoji(actionLabels[a.action] || a.action)}
                    {a.recipe_name && <span style={{ fontWeight: 800, color: A.orange7 }}> “{a.recipe_name}”</span>}
                  </span>
                  <span style={{ fontSize: 11.5, color: A.muted2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatTime(a.created_at)}</span>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={emptyBox}>{t.report.noPeriodActivity}</div>}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
