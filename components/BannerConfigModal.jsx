"use client";
// Banner de anuncios — panel del administrador (rediseño Don Telmo).
// Edita un borrador; solo al Guardar se publica para el equipo.
import { useEffect, useRef, useState } from "react";
import { saveBannerConfig } from "@/lib/storage";
import { useViewport } from "@/hooks/useViewport";
import { AdminShell, FootBtn, Switch, useToast, A, card } from "@/components/dt/AdminShell";
import { Icon } from "@/components/dt/ui";
import { BannerCarousel, BANNER_TAGS, bannerTag, MAX_SLIDES } from "@/components/BannerCarousel";

const noop = () => {};
const fieldBase = { padding: "0 14px", borderRadius: 13, border: `1.5px solid ${A.line}`, background: "#FAF8F4", fontSize: 16, color: A.ink, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

export function BannerConfigModal({ show, isAdmin, onClose, banner, onSaved, logo }) {
  if (!show || !isAdmin) return null;
  return <BannerEditor onClose={onClose} banner={banner} onSaved={onSaved} logo={logo} />;
}

function BannerEditor({ onClose, banner, onSaved, logo }) {
  const { mobile } = useViewport();
  const [on, setOn] = useState(!!banner?.active);
  const [slides, setSlides] = useState(() => (banner?.slides || []).map(s => ({ ...s })));
  const [sel, setSel] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [toast, showToast] = useToast();
  const fileRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const cur = slides[sel] || null;
  const upd = (patch) => setSlides(a => a.map((s, i) => (i === sel ? { ...s, ...patch } : s)));
  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) return;
    setSlides(a => [...a, { tag: "aviso", title: "Nuevo anuncio", text: "", cta: "", img: null }]);
    setSel(slides.length);
  };
  const move = (d) => {
    const j = sel + d;
    if (j < 0 || j >= slides.length) return;
    setSlides(a => { const b = [...a]; [b[sel], b[j]] = [b[j], b[sel]]; return b; });
    setSel(j);
  };
  const del = () => {
    if (slides.length < 2) { showToast("Deja al menos un slide"); return; }
    setSlides(a => a.filter((_, i) => i !== sel));
    setSel(s => Math.max(0, s - 1));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cur) return;
    const idx = sel;
    setUploading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `banner/img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: false, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      if (alive.current) setSlides(a => a.map((s, i) => (i === idx ? { ...s, img: data.publicUrl } : s)));
    } catch (err) {
      console.error("banner upload:", err);
      if (alive.current) showToast("No se pudo subir la imagen. Revisa la conexión");
    }
    if (alive.current) setUploading(false);
  };

  const save = async () => {
    if (saving || uploading) return;
    setSaving(true);
    const clean = slides.map(s => ({ tag: s.tag, title: s.title.trim(), text: s.text.trim(), cta: s.cta.trim(), img: s.img || null }));
    // "images" se mantiene para los aparatos que aún tengan la versión anterior en caché
    const ok = await saveBannerConfig({ active: on, slides: clean, images: clean.map(s => s.img).filter(Boolean) });
    if (!alive.current) return;
    setSaving(false);
    if (!ok) { showToast("No se pudo guardar. Revisa la conexión"); return; }
    onSaved?.({ active: on, slides: clean });
    showToast("Banner guardado");
    setTimeout(() => { if (alive.current) onClose(); }, 700);
  };

  const smallBtn = { height: 40, width: 44, borderRadius: 11, border: `1.5px solid ${A.line}`, background: "#fff", color: A.navy, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <>
      <AdminShell icon={<Icon.megaphone width={21} height={21} />} eyebrow="DON TELMO® RECETARIO" title="Banner de anuncios" maxWidth={880} onClose={preview ? noop : onClose} zIndex={9995}
        footer={<>
          <FootBtn kind="gray" onClick={onClose}>Cancelar</FootBtn>
          <FootBtn kind="navy" onClick={save} disabled={saving || uploading} style={{ flex: 1.4 }}>{saving ? "Guardando…" : uploading ? "Subiendo imagen…" : "Guardar"}</FootBtn>
        </>}>
        <div className="dt-adm" style={{ display: "flex", flexDirection: "column", gap: 16, animation: "dtUp .4s both" }}>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

          {/* Publicar */}
          <div style={{ ...card, borderRadius: 16, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: A.navy }}>Publicar banner</span>
              <span style={{ fontSize: 12.5, color: A.muted2 }}>{on ? "Los usuarios lo verán cada vez que abran el recetario" : "Apagado: nadie lo verá"}</span>
            </span>
            <Switch on={on} onChange={setOn} label="Publicar banner" />
          </div>

          {/* Slides */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", color: A.navy }}>SLIDES DEL BANNER</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: A.muted2 }}>{slides.length} de {MAX_SLIDES}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${MAX_SLIDES},minmax(0,1fr))`, gap: 8 }}>
              {Array.from({ length: MAX_SLIDES }, (_, i) => {
                const s = slides[i], active = !!s && i === sel;
                return (
                  <button key={i} onClick={() => (s ? setSel(i) : addSlide())} aria-label={s ? `Slide ${i + 1}` : "Agregar slide"}
                    style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 14, border: s ? `2.5px solid ${active ? A.orange : "transparent"}` : "2px dashed #DCD4C7", background: s ? bannerTag(s.tag).g : "#FAF8F4", cursor: "pointer", padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#B9B1A3", transition: "all .25s", boxShadow: active ? "0 10px 20px -10px rgba(217,115,26,.7)" : "none", transform: `scale(${active ? 1.05 : 1})` }}>
                    {s ? (
                      <>
                        {s.img && <img src={s.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                        <span style={{ position: "absolute", left: 5, bottom: 5, width: 20, height: 20, borderRadius: 7, background: A.navy, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      </>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    )}
                  </button>
                );
              })}
            </div>
            {slides.length === 0 && <span style={{ fontSize: 13, color: A.muted2 }}>Toca un cuadro con “+” para crear el primer anuncio.</span>}
          </div>

          {/* Editor del slide */}
          {cur && (
            <div key={sel} style={{ ...card, padding: 14, display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr)" : "minmax(200px,.9fr) minmax(0,1.3fr)", gap: 16, animation: "dtUp .35s both" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => !uploading && fileRef.current?.click()} className="bn-drop" aria-label="Subir imagen"
                  style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 14, border: "2px dashed #DCD4C7", background: "#FAF8F4", cursor: uploading ? "wait" : "pointer", padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: A.muted2, transition: "border-color .2s", fontFamily: "inherit" }}>
                  {cur.img ? <img src={cur.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : (
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={A.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                      {uploading ? "Subiendo…" : "Subir imagen"}
                      <span style={{ fontWeight: 500, fontSize: 11.5, color: A.muted3 }}>Ideal 1600 × 1000 px</span>
                    </span>
                  )}
                  {uploading && cur.img && <span style={{ position: "absolute", inset: 0, background: "rgba(14,34,64,.55)", color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>Subiendo…</span>}
                </button>
                {cur.img && <button onClick={() => upd({ img: null })} style={{ height: 40, borderRadius: 10, border: "1.5px solid #F3C9C5", background: "#fff", color: A.red, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Quitar imagen</button>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {BANNER_TAGS.map(t => {
                    const a = cur.tag === t.id;
                    return <button key={t.id} onClick={() => upd({ tag: t.id })} aria-pressed={a} style={{ height: 36, padding: "0 12px", borderRadius: 999, border: `1.5px solid ${a ? t.c : A.line}`, background: a ? t.bg : "#fff", color: a ? t.c : A.muted, fontWeight: 800, fontSize: 12.5, cursor: "pointer", transition: "all .2s", fontFamily: "inherit" }}>{t.name}</button>;
                  })}
                </div>
                <input value={cur.title} onChange={e => upd({ title: e.target.value })} placeholder="Título" maxLength={90} style={{ ...fieldBase, height: 48, fontWeight: 700 }} />
                <textarea value={cur.text} onChange={e => upd({ text: e.target.value })} placeholder="Mensaje para el equipo" rows={3} maxLength={400} style={{ ...fieldBase, padding: "12px 14px", resize: "vertical", lineHeight: 1.4 }} />
                <input value={cur.cta} onChange={e => upd({ cta: e.target.value })} placeholder="Botón opcional · ej. Ver receta" maxLength={40} style={{ ...fieldBase, height: 46 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => move(-1)} aria-label="Mover antes" style={{ ...smallBtn, opacity: sel < 1 ? .35 : 1 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg></button>
                  <button onClick={() => move(1)} aria-label="Mover después" style={{ ...smallBtn, opacity: sel >= slides.length - 1 ? .35 : 1 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
                  <span style={{ flex: 1 }} />
                  <button onClick={del} style={{ height: 40, padding: "0 14px", borderRadius: 11, border: "1.5px solid #F3C9C5", background: "#fff", color: A.red, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {slides.length > 0 && (
            <button onClick={() => setPreview(true)} className="bn-prev" style={{ height: 48, borderRadius: 14, border: 0, background: A.grayBtn, color: A.navy, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, transition: "all .2s", fontFamily: "inherit" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>
              Vista previa del banner
            </button>
          )}
          <style>{`.bn-drop:hover{border-color:${A.orange}!important}.bn-prev:hover{background:${A.navy}!important;color:#fff!important}`}</style>
        </div>
      </AdminShell>
      {preview && <BannerCarousel slides={slides} logo={logo} onClose={() => setPreview(false)} />}
      {toast}
    </>
  );
}
