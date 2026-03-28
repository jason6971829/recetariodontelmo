"use client";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLang } from "@/lib/LangContext";

export function ProgressReport({ recipes, onClose }) {
  const isMobile = useIsMobile();
  const { t } = useLang();
  const [viewMode, setViewMode] = useState("general"); // general | category | missing

  const stats = useMemo(() => {
    const total = recipes.length;
    const fields = {
      image: { label: t.progress.fields.image, icon: "📷", check: r => r.image && r.image.trim() !== "" },
      description: { label: t.progress.fields.description, icon: "📝", check: r => r.description && r.description.trim() !== "" },
      preparation: { label: t.progress.fields.preparation, icon: "🍳", check: r => r.preparation && r.preparation.trim() !== "" },
      ingredients: { label: t.progress.fields.ingredients, icon: "🥕", check: r => r.ingredients && r.ingredients.length > 0 },
      recommendations: { label: t.progress.fields.recommendations, icon: "💡", check: r => r.recommendations && r.recommendations.trim() !== "" },
      salesPitch: { label: t.progress.fields.salesPitch, icon: "🎯", check: r => r.salesPitch && r.salesPitch.trim() !== "" },
      video: { label: t.progress.fields.video, icon: "🎥", check: r => r.video && r.video.trim() !== "" },
    };

    const counts = {};
    Object.entries(fields).forEach(([key, f]) => {
      const count = recipes.filter(f.check).length;
      counts[key] = { ...f, count, total, pct: Math.round((count / total) * 100) };
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

    return { total, counts, completas, cats, sinImagen, sinDescripcion, sinSalesPitch };
  }, [recipes, t]);

  const pctCompletas = Math.round((stats.completas / stats.total) * 100);

  const ProgressBar = ({ pct, color = "#27ae60" }) => (
    <div style={{ width: "100%", height: "8px", background: "#E0D8CE", borderRadius: "4px", overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#27ae60" : pct > 50 ? color : "#e74c3c", borderRadius: "4px", transition: "width 0.5s ease" }} />
    </div>
  );

  const tabBtn = (val, label) => (
    <button
      onClick={() => setViewMode(val)}
      style={{
        padding: "7px 16px", border: "none", borderRadius: "8px", cursor: "pointer",
        background: viewMode === val ? "#1B3A5C" : "#F0ECE6",
        color: viewMode === val ? "#fff" : "#5a3e2b",
        fontSize: "12px", fontWeight: "600",
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
        <div style={{ background: "linear-gradient(135deg,#1B3A5C,#0d2340)", padding: "18px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia,serif" }}>{t.admin}</div>
              <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "17px", fontWeight: "700", marginTop: "3px" }}>{t.progress.title}</div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>
          {/* Progreso general */}
          <div style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ color: "#8BAACC", fontSize: "12px", fontWeight: "600" }}>{t.progress.general}</span>
              <span style={{ color: "#fff", fontSize: "20px", fontWeight: "700", fontFamily: "Georgia,serif" }}>{pctCompletas}%</span>
            </div>
            <div style={{ width: "100%", height: "10px", background: "rgba(255,255,255,0.15)", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{ width: pctCompletas + "%", height: "100%", background: "linear-gradient(90deg, #D4721A, #f39c12)", borderRadius: "5px", transition: "width 0.5s ease" }} />
            </div>
            <div style={{ color: "#8BAACC", fontSize: "11px", marginTop: "4px" }}>
              {stats.completas} {t.progress.of} {stats.total} {t.progress.complete}
            </div>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {tabBtn("general", t.progress.generalTab)}
            {tabBtn("category", t.progress.categoryTab)}
            {tabBtn("missing", t.progress.missingTab)}
          </div>

          {/* Vista General */}
          {viewMode === "general" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                {Object.entries(stats.counts).map(([key, s]) => (
                  <div key={key} style={{ background: "#F7F3EE", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#1B3A5C" }}>{s.icon} {s.label}</span>
                      <span style={{ fontSize: "18px", fontWeight: "700", color: s.pct === 100 ? "#27ae60" : s.pct > 50 ? "#D4721A" : "#e74c3c", fontFamily: "Georgia,serif" }}>{s.pct}%</span>
                    </div>
                    <ProgressBar pct={s.pct} color="#D4721A" />
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
                      {s.count} {t.progress.of} {s.total} — {t.progress.missing} <strong>{s.total - s.count}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vista por categoría */}
          {viewMode === "category" && (
            <div>
              {Object.entries(stats.cats).sort((a, b) => b[1].total - a[1].total).map(([cat, s]) => {
                const catPct = Math.round(((s.image + s.description + s.salesPitch) / (s.total * 3)) * 100);
                return (
                  <div key={cat} style={{ background: "#F7F3EE", borderRadius: "12px", padding: "14px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#1B3A5C" }}>{cat} <span style={{ fontSize: "11px", color: "#888", fontWeight: "400" }}>({s.total})</span></span>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: catPct === 100 ? "#27ae60" : catPct > 50 ? "#D4721A" : "#e74c3c", fontFamily: "Georgia,serif" }}>{catPct}%</span>
                    </div>
                    <ProgressBar pct={catPct} color="#D4721A" />
                    <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "11px", color: "#888", flexWrap: "wrap" }}>
                      <span>📷 {s.image}/{s.total}</span>
                      <span>📝 {s.description}/{s.total}</span>
                      <span>🎯 {s.salesPitch}/{s.total}</span>
                      <span>💡 {s.recommendations}/{s.total}</span>
                      <span>🎥 {s.video}/{s.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Vista faltantes */}
          {viewMode === "missing" && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#e74c3c", letterSpacing: "1px", marginBottom: "10px" }}>
                  {t.progress.noImage} ({stats.sinImagen.length})
                </div>
                <div style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "10px" }}>
                  {stats.sinImagen.map(r => (
                    <div key={r.id} style={{ padding: "8px 12px", background: "#FEF0EF", borderRadius: "6px", marginBottom: "4px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "#333" }}>{r.name}</span>
                      <span style={{ color: "#888", fontSize: "11px" }}>{r.category}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#e74c3c", letterSpacing: "1px", marginBottom: "10px" }}>
                  {t.progress.noDescription} ({stats.sinDescripcion.length})
                </div>
                <div style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "10px" }}>
                  {stats.sinDescripcion.map(r => (
                    <div key={r.id} style={{ padding: "8px 12px", background: "#FEF0EF", borderRadius: "6px", marginBottom: "4px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "#333" }}>{r.name}</span>
                      <span style={{ color: "#888", fontSize: "11px" }}>{r.category}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#e74c3c", letterSpacing: "1px", marginBottom: "10px" }}>
                  {t.progress.noSalesPitch} ({stats.sinSalesPitch.length})
                </div>
                <div style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "10px" }}>
                  {stats.sinSalesPitch.map(r => (
                    <div key={r.id} style={{ padding: "8px 12px", background: "#FEF0EF", borderRadius: "6px", marginBottom: "4px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "#333" }}>{r.name}</span>
                      <span style={{ color: "#888", fontSize: "11px" }}>{r.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
