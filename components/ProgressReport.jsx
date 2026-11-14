"use client";
import { useState, useMemo, useEffect } from "react";
import { useViewport } from "@/hooks/useViewport";
import { useLang } from "@/lib/LangContext";
import { AdminShell, A, useCountUp } from "@/components/dt/AdminShell";
import { Icon, Monogram } from "@/components/dt/ui";

const fmtBytes = (b) => {
  if (!b || b < 1024) return `${b || 0} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
};

// Trazos de los íconos de línea (mismos del diseño)
const IC = {
  image: "M21 15l-5-5L5 21M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  description: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8",
  preparation: "M3 2v7a3 3 0 0 0 3 3v10M9 2v7a3 3 0 0 1-3 3M19 2c-2 2-3 5-3 8s1 4 3 4v8",
  ingredients: "M5 11l1.5 9h11L19 11M3 11h18M9 11l3-6 3 6",
  recommendations: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z",
  salesPitch: "M3 17l6-6 4 4 8-8M15 7h6v6",
  video: "M23 7l-7 5 7 5zM3 5h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  chart: "M18 20V10M12 20V4M6 20v-6",
  folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  warn: "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  scale: "M12 3v18M5 21h14M4 8l-2 7a4 4 0 0 0 8 0zM20 8l-2 7a4 4 0 0 0 8 0zM3 8h18",
  check: "M5 12l5 5L20 7",
};
const Ico = ({ d, size = 15, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}><path d={d} /></svg>
);

const tint = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
// Color por avance (tarjetas de campo)
const pctColor = (p) => (p < 25 ? A.red : p < 90 ? A.orange : A.green);
// Color por avance (filas de categoría)
const catBarColor = (p) => (p < 25 ? A.red : p < 60 ? A.orange : p < 90 ? "#C9962B" : A.green);
// Las traducciones traen emojis al inicio; el rediseño usa solo íconos de línea
const noEmoji = (s) => String(s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
const sentence = (s) => { const x = noEmoji(s); return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase(); };
const safePct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Barra que crece: parte en 0 y toma su ancho real cuando `on` pasa a true
function Bar({ pct, color, on, h = 8, radius = 5, track = A.grayBtn, ms = 1000, delay = "0ms" }) {
  const w = Math.min(100, Math.max(pct, pct ? 2 : 0));
  return (
    <div style={{ height: h, borderRadius: radius, background: track, overflow: "hidden" }}>
      <div style={{ height: "100%", width: on ? `${w}%` : "0%", borderRadius: radius, background: color, transition: `width ${ms}ms ${A.ease}`, transitionDelay: delay }} />
    </div>
  );
}

export function ProgressReport({ recipes, onClose }) {
  const { mobile } = useViewport();
  const { t } = useLang();
  const [viewMode, setViewMode] = useState("general"); // general | category | missing
  const [missFilter, setMissFilter] = useState("all"); // all | image | description | salesPitch
  const [headOn, setHeadOn] = useState(false); // barra del encabezado
  const [barsOn, setBarsOn] = useState(false); // barras de la pestaña activa

  const stats = useMemo(() => {
    const total = recipes.length;
    const fields = {
      image: { label: t.progress.fields.image, icon: IC.image, check: r => r.image && r.image.trim() !== "" },
      description: { label: t.progress.fields.description, icon: IC.description, check: r => r.description && r.description.trim() !== "" },
      preparation: { label: t.progress.fields.preparation, icon: IC.preparation, check: r => r.preparation && r.preparation.trim() !== "" },
      ingredients: { label: t.progress.fields.ingredients, icon: IC.ingredients, check: r => r.ingredients && r.ingredients.length > 0 },
      recommendations: { label: t.progress.fields.recommendations, icon: IC.recommendations, check: r => r.recommendations && r.recommendations.trim() !== "" },
      salesPitch: { label: t.progress.fields.salesPitch, icon: IC.salesPitch, check: r => r.salesPitch && r.salesPitch.trim() !== "" },
      video: { label: t.progress.fields.video, icon: IC.video, check: r => r.video && r.video.trim() !== "" },
    };

    const counts = {};
    Object.entries(fields).forEach(([key, f]) => {
      const count = recipes.filter(f.check).length;
      counts[key] = { ...f, count, total, pct: safePct(count, total) };
    });

    const completas = recipes.filter(r =>
      fields.image.check(r) && fields.description.check(r) &&
      fields.preparation.check(r) && fields.ingredients.check(r) &&
      fields.salesPitch.check(r)
    ).length;

    // Por categoría
    const cats = {};
    recipes.forEach(r => {
      if (!cats[r.category]) cats[r.category] = { total: 0, image: 0, description: 0, salesPitch: 0, recommendations: 0, video: 0 };
      cats[r.category].total++;
      if (fields.image.check(r)) cats[r.category].image++;
      if (fields.description.check(r)) cats[r.category].description++;
      if (fields.salesPitch.check(r)) cats[r.category].salesPitch++;
      if (fields.recommendations.check(r)) cats[r.category].recommendations++;
      if (fields.video.check(r)) cats[r.category].video++;
    });

    // Recetas sin imagen
    const sinImagen = recipes.filter(r => !fields.image.check(r)).map(r => ({ id: r.id, name: r.name, category: r.category }));
    const sinDescripcion = recipes.filter(r => !fields.description.check(r)).map(r => ({ id: r.id, name: r.name, category: r.category }));
    const sinSalesPitch = recipes.filter(r => !fields.salesPitch.check(r)).map(r => ({ id: r.id, name: r.name, category: r.category }));

    // ── Peso de datos (texto) ─────────────────────────────────────
    const str = (v) => (v || "").toString();
    const blobSize = (s) => { try { return new Blob([s]).size; } catch { return s.length; } };
    const weightFields = [
      { key: "description",     label: "Descripciones",      bytes: blobSize(recipes.map(r => str(r.description)).join("")) },
      { key: "preparation",     label: "Preparación",        bytes: blobSize(recipes.map(r => str(r.preparation)).join("")) },
      { key: "ingredients",     label: "Ingredientes",       bytes: blobSize(JSON.stringify(recipes.map(r => r.ingredients || []))) },
      { key: "recommendations", label: "Recomendaciones",    bytes: blobSize(recipes.map(r => str(r.recommendations)).join("")) },
      { key: "salesPitch",      label: "Aprende a Vender",   bytes: blobSize(recipes.map(r => str(r.salesPitch)).join("")) },
      { key: "image",           label: "Imágenes",           bytes: blobSize(recipes.map(r => str(r.image)).join("")), isMedia: true, count: recipes.filter(r => fields.image.check(r)).length },
      { key: "video",           label: "Videos",             bytes: blobSize(recipes.map(r => str(r.video)).join("")),  isMedia: true, count: recipes.filter(r => fields.video.check(r)).length },
    ];
    const totalTextBytes = weightFields.reduce((acc, f) => acc + f.bytes, 0);
    const maxFieldBytes = Math.max(...weightFields.map(f => f.bytes));

    return { total, counts, completas, cats, sinImagen, sinDescripcion, sinSalesPitch, weightFields, totalTextBytes, maxFieldBytes };
  }, [recipes, t]);

  const pctCompletas = safePct(stats.completas, stats.total);
  const pctShown = useCountUp(pctCompletas);

  // Faltantes: una tarjeta por receta con lo que le falta (une las tres listas)
  const missing = useMemo(() => {
    const map = new Map();
    const add = (list, key) => list.forEach((r, i) => {
      const k = r.id ?? `${key}-${i}-${r.name}`;
      if (!map.has(k)) map.set(k, { k, name: r.name, category: r.category, miss: [] });
      map.get(k).miss.push(key);
    });
    add(stats.sinImagen, "image");
    add(stats.sinDescripcion, "description");
    add(stats.sinSalesPitch, "salesPitch");
    return [...map.values()];
  }, [stats]);

  // Las barras arrancan en 0 y crecen al abrir y al cambiar de pestaña.
  // setTimeout (no requestAnimationFrame) para que el ancho final quede bien aunque no haya animación.
  useEffect(() => { const id = setTimeout(() => setHeadOn(true), 80); return () => clearTimeout(id); }, []);
  useEffect(() => { const id = setTimeout(() => setBarsOn(true), 80); return () => clearTimeout(id); }, [viewMode]);
  const pickTab = (val) => { if (val === viewMode) return; setBarsOn(false); setViewMode(val); };

  const tabs = [
    ["general", noEmoji(t.progress.generalTab), IC.chart],
    ["category", noEmoji(t.progress.categoryTab), IC.folder],
    ["missing", noEmoji(t.progress.missingTab), IC.warn],
  ];
  const tabIdx = Math.max(0, tabs.findIndex(x => x[0] === viewMode));

  const missLabels = { image: sentence(t.progress.noImage), description: sentence(t.progress.noDescription), salesPitch: sentence(t.progress.noSalesPitch) };
  const missCounts = { image: stats.sinImagen.length, description: stats.sinDescripcion.length, salesPitch: stats.sinSalesPitch.length };
  const missShown = missFilter === "all" ? missing : missing.filter(r => r.miss.includes(missFilter));
  const cardBox = { background: "#fff", boxShadow: "0 0 0 1px rgba(14,34,64,.06)" };

  const header = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: A.blueSoft }}>{t.progress.general}</span>
        <span style={{ fontFamily: A.serif, fontSize: 30, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pctShown}%</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctCompletas} style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: headOn ? `${pctCompletas}%` : "0%", minWidth: 6, borderRadius: 6, background: `linear-gradient(90deg,${A.orange},${A.orangeSoft})`, transition: `width 1.1s ${A.ease}` }} />
      </div>
      <span style={{ fontSize: 12, color: A.blueSoft }}>{stats.completas} {t.progress.of} {stats.total} {t.progress.complete}</span>
    </div>
  );

  return (
    <AdminShell icon={Icon.chart({ width: 21, height: 21 })} eyebrow={t.admin} title={t.progress.title} maxWidth={760} onClose={onClose} headerExtra={header}>
      <div className="dt-adm" style={{ display: "flex", flexDirection: "column", gap: 16, animation: "dtUp .4s both" }}>
        {/* Pestañas */}
        <div role="tablist" style={{ display: "flex", padding: 4, borderRadius: 14, background: "#fff", boxShadow: `0 0 0 1px ${A.line}`, position: "relative" }}>
          <span aria-hidden="true" style={{ position: "absolute", top: 4, bottom: 4, left: 4, width: "calc((100% - 8px) / 3)", borderRadius: 10, background: A.navy, transform: `translateX(${tabIdx * 100}%)`, transition: `transform .35s ${A.ease}` }} />
          {tabs.map(([val, label, icon]) => (
            <button key={val} type="button" role="tab" aria-selected={viewMode === val} onClick={() => pickTab(val)}
              style={{ position: "relative", flex: 1, minWidth: 0, height: mobile ? 44 : 40, padding: "0 4px", border: 0, background: "transparent", color: viewMode === val ? "#fff" : A.muted, fontWeight: 800, fontSize: mobile ? 12.5 : 13, cursor: "pointer", transition: "color .3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              {!mobile && <Ico d={icon} />}
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Vista General */}
        {viewMode === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(${mobile ? 240 : 300}px,1fr))`, gap: 10 }}>
              {Object.entries(stats.counts).map(([key, s], i) => {
                const c = pctColor(s.pct);
                const delay = i * 70 + "ms";
                return (
                  <div key={key} style={{ ...cardBox, padding: "14px 14px 12px", borderRadius: 16, display: "flex", flexDirection: "column", gap: 9, animation: "dtUp .45s both", animationDelay: delay }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: tint(c, .12), color: c, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ico d={s.icon} /></span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: A.navy }}>{s.label}</span>
                      <span style={{ fontFamily: A.serif, fontSize: 24, fontWeight: 600, color: c, lineHeight: 1 }}>{s.pct}%</span>
                    </div>
                    <Bar pct={s.pct} color={c} on={barsOn} delay={delay} />
                    <span style={{ fontSize: 12, color: A.muted2 }}>{s.count} {t.progress.of} {s.total} · {t.progress.missing} <strong style={{ color: A.ink2 }}>{s.total - s.count}</strong></span>
                  </div>
                );
              })}
            </div>

            {/* ── Peso del recetario ── */}
            <div style={{ borderRadius: 20, background: `linear-gradient(160deg,${A.navy2},${A.navy})`, color: "#fff", padding: 18, display: "flex", flexDirection: "column", gap: 14, animation: "dtUp .6s .3s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(217,115,26,.2)", color: A.orangeSoft, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ico d={IC.scale} size={20} w={1.8} /></span>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".2em", color: A.orangeSoft }}>PESO DEL RECETARIO</span>
                  <span style={{ fontSize: 11.5, color: A.blueSoft }}>Solo texto · imágenes y videos en la nube</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flex: "none" }}>
                  <span style={{ fontFamily: A.serif, fontSize: mobile ? 24 : 28, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>{fmtBytes(stats.totalTextBytes)}</span>
                  <span style={{ fontSize: 11, color: A.blueSoft }}>total texto</span>
                </div>
              </div>

              {/* Barras por campo */}
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {stats.weightFields.map(f => {
                  const pct = stats.maxFieldBytes > 0 ? Math.round((f.bytes / stats.maxFieldBytes) * 100) : 0;
                  return (
                    <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                        <span style={{ color: "#DCE5F0" }}>{f.label}</span>
                        <span style={{ fontWeight: 800, textAlign: "right" }}>{fmtBytes(f.bytes)}{f.isMedia && <span style={{ fontWeight: 500, fontSize: 11, color: A.blueSoft }}> · {f.count} archivos en nube</span>}</span>
                      </div>
                      <Bar pct={pct} color={A.orange} on={barsOn} h={6} radius={4} track="rgba(255,255,255,.1)" ms={1100} />
                    </div>
                  );
                })}
              </div>

              {/* Cifras al pie */}
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: mobile ? "12px 8px" : 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)", textAlign: "center" }}>
                {[
                  { v: stats.total, l: "recetas", c: "#fff" },
                  { v: fmtBytes(stats.total > 0 ? Math.round(stats.totalTextBytes / stats.total) : 0), l: "promedio / receta", c: "#fff" },
                  { v: stats.weightFields.find(f => f.key === "image")?.count || 0, l: "imgs en nube", c: "#7FB4F0" },
                  { v: stats.weightFields.find(f => f.key === "video")?.count || 0, l: "videos en nube", c: "#7FB4F0" },
                ].map(x => (
                  <div key={x.l} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: x.c }}>{x.v}</span>
                    <span style={{ fontSize: 11, color: A.blueSoft }}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vista por categoría */}
        {viewMode === "category" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(stats.cats).sort((a, b) => b[1].total - a[1].total).map(([cat, s], i) => {
              const catPct = safePct(s.image + s.description + s.salesPitch, s.total * 3);
              const bc = catBarColor(catPct);
              const parts = [[IC.image, s.image, t.progress.fields.image], [IC.description, s.description, t.progress.fields.description], [IC.salesPitch, s.salesPitch, t.progress.fields.salesPitch], [IC.recommendations, s.recommendations, t.progress.fields.recommendations], [IC.video, s.video, t.progress.fields.video]];
              return (
                <div key={cat} style={{ ...cardBox, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, animation: "dtUp .4s both", animationDelay: Math.min(i, 14) * 50 + "ms" }}>
                  <Monogram name={cat} size={34} radius={10} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: A.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
                      <span style={{ fontSize: 12, color: A.muted2, whiteSpace: "nowrap" }}>{s.total}</span>
                    </div>
                    <Bar pct={catPct} color={bc} on={barsOn} h={6} radius={4} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", fontSize: 11.5, color: A.muted2, fontVariantNumeric: "tabular-nums" }}>
                      {parts.map(([icon, n, label]) => (
                        <span key={label} title={label} aria-label={`${label}: ${n} ${t.progress.of} ${s.total}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Ico d={icon} size={12} />{n}/{s.total}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{ fontFamily: A.serif, fontSize: 19, fontWeight: 600, color: bc, width: 48, textAlign: "right", flex: "none" }}>{catPct}%</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Vista faltantes */}
        {viewMode === "missing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Totales por tipo de faltante (también filtran la lista) */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["image", "description", "salesPitch"].map(k => {
                const sel = missFilter === k;
                return (
                  <button key={k} type="button" aria-pressed={sel} onClick={() => setMissFilter(sel ? "all" : k)}
                    style={{ minHeight: 44, padding: "0 14px", borderRadius: 999, border: 0, background: sel ? A.red : "#fff", color: sel ? "#fff" : A.red, boxShadow: sel ? "none" : "0 0 0 1px #F3C9C5", fontSize: 12.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", transition: "all .2s", flex: mobile ? "1 1 auto" : "none", justifyContent: "center" }}>
                    <Ico d={IC[k]} size={14} />{missLabels[k]} · {missCounts[k]}
                  </button>
                );
              })}
            </div>
            {missShown.length === 0 ? (
              <div style={{ ...cardBox, borderRadius: 16, padding: "26px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: A.green, fontSize: 13.5, fontWeight: 800 }}>
                <Ico d={IC.check} size={22} w={2.4} />0
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {missShown.map((r, i) => (
                  <div key={r.k} style={{ ...cardBox, display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 14, animation: "dtUp .4s both", animationDelay: Math.min(i, 12) * 50 + "ms" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: A.navy, minWidth: 0, overflowWrap: "anywhere" }}>{r.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: A.orange, textAlign: "right", flex: "none", maxWidth: "45%" }}>{r.category}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {r.miss.map(k => (
                        <span key={k} style={{ height: 24, padding: "0 9px", borderRadius: 999, background: "#FDECEA", color: A.red, fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center" }}>{missLabels[k]}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
