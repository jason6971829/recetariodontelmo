"use client";
import { memo } from "react";

export const BannerCarousel = memo(function BannerCarousel({
  bannerImages, bannerSlide, bannerStripPos, bannerStripRef, bannerCanTransition, bannerIntervalRef,
  setBannerSlide, setBannerStripPos, setBannerCanTransition, setShowBanner,
}) {
  const extImages = bannerImages.length > 1
    ? [bannerImages[bannerImages.length - 1], ...bannerImages, bannerImages[0]]
    : bannerImages;
  const total = bannerImages.length + 2;
  const stripPos = bannerImages.length > 1 ? bannerStripPos : 0;

  // ── Helpers — función compartida para evitar duplicar la lógica del intervalo ──
  const restartAutoPlay = () => {
    clearInterval(bannerIntervalRef.current);
    bannerIntervalRef.current = setInterval(() => {
      setBannerStripPos(p => p + 1);
      setBannerSlide(s => (s + 1) % bannerImages.length);
    }, 8000);
  };

  const navigate = (dir) => {
    restartAutoPlay();
    setBannerCanTransition(true);
    setBannerStripPos(p => Math.min(Math.max(p + dir, 0), total - 1));
    setBannerSlide(s => (s + dir + bannerImages.length) % bannerImages.length);
  };

  const goTo = (i) => {
    restartAutoPlay();
    setBannerCanTransition(true);
    setBannerStripPos(i + 1);
    setBannerSlide(i);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.92)" }}>
      <style>{`
        @keyframes bannerProgress { from { width:0% } to { width:100% } }
      `}</style>

      {bannerImages.length > 1 && (
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:"rgba(255,255,255,0.1)", zIndex:3 }}>
          <div key={`prog-${bannerSlide}`} style={{ height:"100%", background:"rgba(255,255,255,0.9)", animation:"bannerProgress 8s linear forwards" }} />
        </div>
      )}

      <button onClick={() => { setShowBanner(false); setBannerSlide(0); setBannerStripPos(1); setBannerCanTransition(true); clearInterval(bannerIntervalRef.current); }}
        style={{ position:"absolute", top:"18px", right:"18px", background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:"40px", height:"40px", color:"#fff", fontSize:"20px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:4, backdropFilter:"blur(8px)" }}>×</button>

      <div style={{ position:"absolute", inset:0, overflow:"visible", display:"flex", alignItems:"center" }}>
        <div
          ref={bannerStripRef}
          style={{ display:"flex", alignItems:"center", willChange:"transform" }}
        >
          {extImages.map((url, i) => {
            const isActive = i === stripPos;
            return (
              <div key={i} style={{
                width:"78vw",
                flexShrink:0,
                padding:"0 8px",
                boxSizing:"border-box",
                transition: bannerCanTransition ? "transform 0.5s ease, opacity 0.5s ease" : "none",
                transform: isActive ? "scale(1)" : "scale(0.88)",
                opacity: isActive ? 1 : 0.55,
              }}>
                <div style={{ borderRadius:"22px", overflow:"hidden", boxShadow: isActive ? "0 32px 80px rgba(0,0,0,0.8)" : "0 12px 32px rgba(0,0,0,0.5)", height:"78vh", background:"#000", position:"relative" }}>
                  <img src={url} alt="" aria-hidden="true" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", filter:"blur(24px) brightness(0.35)", transform:"scale(1.08)", userSelect:"none", pointerEvents:"none" }} />
                  <img src={url} alt="" style={{ position:"relative", zIndex:1, width:"100%", height:"100%", objectFit:"contain", userSelect:"none", pointerEvents:"none", display:"block" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {bannerImages.length > 1 && (
        <>
          <button onClick={() => navigate(-1)} style={{ position:"absolute", left:"8px", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"50%", width:"44px", height:"44px", color:"#fff", fontSize:"26px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:5, backdropFilter:"blur(8px)" }}>‹</button>
          <button onClick={() => navigate(1)} style={{ position:"absolute", right:"8px", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"50%", width:"44px", height:"44px", color:"#fff", fontSize:"26px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:5, backdropFilter:"blur(8px)" }}>›</button>
        </>
      )}

      {bannerImages.length > 1 && (
        <div style={{ position:"absolute", bottom:"32px", left:0, right:0, display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", zIndex:3 }}>
          <div style={{ display:"flex", gap:"6px" }}>
            {bannerImages.map((_, i) => (
              <div key={i} onClick={() => goTo(i)} style={{
                width: i === bannerSlide ? "22px" : "7px", height:"7px",
                borderRadius:"4px", cursor:"pointer", transition:"all 0.35s ease",
                background: i === bannerSlide ? "#fff" : "rgba(255,255,255,0.3)",
              }} />
            ))}
          </div>
          <div style={{ color:"rgba(255,255,255,0.35)", fontSize:"11px", letterSpacing:"2px" }}>{bannerSlide + 1} / {bannerImages.length}</div>
        </div>
      )}
    </div>
  );
});
