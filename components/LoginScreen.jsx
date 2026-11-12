"use client";
import { useState } from "react";

// Rediseño Don Telmo: login a pantalla completa con fondo radial navy, logo gigante "respirando" y glow naranja.
const WATERMARK_LOGO = "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png";

export function LoginScreen({
  loading, brandIcon, brandLabel, brandName, brandLabelColor, brandNameColor, companyTagline, brandTaglineColor,
  loginForm, setLoginForm, handleLogin, loginLocked, loginLockSecs, loginError, loginAttemptsLeft,
  t, isMobile, hasBiometric, biometricLoading, handleBiometricLogin,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const field = { width: "100%", height: 52, padding: "0 16px", border: "1.5px solid #E7E1D7", borderRadius: 14, background: "#FAF8F4", fontSize: 16, color: "#0E2240", outline: "none", boxSizing: "border-box", fontFamily: "var(--dt-sans)", fontWeight: 600 };
  const lbl = { display: "block", fontSize: 11, fontWeight: 800, color: "#0E2240", letterSpacing: ".16em", marginBottom: 7, textTransform: "uppercase" };
  const enter = (d) => ({ animation: `dtUp .55s cubic-bezier(.2,.8,.2,1) ${d}s both` });

  return (
    <div className="dt-scope" style={{ height: "var(--app-height, 100vh)", position: "relative", overflow: "hidden", background: "radial-gradient(120% 90% at 85% 0%, #1F426F, #0E2240 55%, #091831)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--dt-sans)" }}>
      {/* logo enorme de fondo + glow naranja */}
      <img src={WATERMARK_LOGO} alt="" aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: "min(140vw, 980px)", height: "auto", opacity: 0.05, filter: "grayscale(1) brightness(2.4)", WebkitMaskImage: "radial-gradient(circle, #000 52%, transparent 68%)", maskImage: "radial-gradient(circle, #000 52%, transparent 68%)", transform: "translate(-50%,-50%)", animation: "dtBreathe 14s ease-in-out infinite", pointerEvents: "none", userSelect: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-20%", bottom: "-30%", width: "80vmax", height: "80vmax", background: "radial-gradient(closest-side, rgba(217,115,26,.22), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", background: "#fff", borderRadius: 28, padding: isMobile ? "36px 26px 28px" : "44px 36px 36px", width: "100%", maxWidth: 420, boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 20, animation: "dtPop .5s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, ...enter(0.15) }}>
          <div style={{ width: 76, height: 76, borderRadius: 22, overflow: "hidden", background: "#0E2240", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px -12px rgba(14,34,64,.5)", marginBottom: 8 }}>
            {brandIcon ? <img src={brandIcon} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontFamily: "var(--dt-serif)", fontWeight: 700, fontSize: 26 }}>DT</span>}
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".28em", color: "#D9731A" }}>{String(brandLabel || "RECETARIO DIGITAL").toUpperCase()}</span>
          <span style={{ fontFamily: "var(--dt-serif)", fontSize: 34, fontWeight: 600, color: "#0E2240", lineHeight: 1.05 }}>{brandName}</span>
          {companyTagline && <span style={{ fontSize: 13, color: "#8A847A" }}>{companyTagline}</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 16, color: "#8A847A", fontSize: 14, fontWeight: 600 }}>
            <div style={{ width: 28, height: 28, margin: "0 auto 10px", borderRadius: "50%", border: "3px solid #EFEAE2", borderTopColor: "#D9731A", animation: "dtSpin 0.9s linear infinite" }} />
            {t.loading}
            <style>{"@keyframes dtSpin { to { transform: rotate(360deg) } }"}</style>
          </div>
        ) : <>
          <div style={enter(0.25)}>
            <label style={lbl}>{t.login.usernameLabel}</label>
            <input style={field} value={loginForm.username} onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder={t.login.usernamePlaceholder} autoFocus autoComplete="username" />
          </div>
          <div style={enter(0.32)}>
            <label style={lbl}>{t.login.passwordLabel}</label>
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} style={{ ...field, paddingRight: 52 }} value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder={t.login.passwordPlaceholder} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{ position: "absolute", right: 6, top: 6, width: 40, height: 40, borderRadius: 10, border: 0, background: "transparent", color: "#8A847A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {loginLocked ? (
            <div style={{ textAlign: "center", background: "#FDECEA", border: "1.5px solid #E8B4AE", borderRadius: 16, padding: 16, ...enter(0.4) }}>
              <div style={{ color: "#C8423B", fontWeight: 800, fontSize: 14 }}>Acceso bloqueado temporalmente</div>
              <div style={{ color: "#C8423B", fontSize: 24, fontWeight: 800, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                {Math.floor(loginLockSecs / 60)}:{String(loginLockSecs % 60).padStart(2, "0")}
              </div>
              <div style={{ color: "#8A847A", fontSize: 12, marginTop: 4 }}>Demasiados intentos fallidos</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, ...enter(0.4) }}>
              {loginError && (
                <div style={{ color: "#C8423B", fontSize: 13, fontWeight: 600, textAlign: "center", background: "#FDECEA", padding: 10, borderRadius: 12 }}>
                  {loginError}
                  {loginAttemptsLeft < 5 && loginAttemptsLeft > 0 && (
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{loginAttemptsLeft} intento{loginAttemptsLeft !== 1 ? "s" : ""} restante{loginAttemptsLeft !== 1 ? "s" : ""}</div>
                  )}
                </div>
              )}
              <button onClick={handleLogin} disabled={loginLocked} className="dt-login-btn"
                style={{ width: "100%", height: 54, background: "#0E2240", border: 0, borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "var(--dt-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all .25s" }}>
                {String(t.login.button || "Ingresar al recetario").charAt(0).toUpperCase() + String(t.login.button || "Ingresar al recetario").slice(1).toLowerCase()} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {hasBiometric && (
            <button onClick={handleBiometricLogin} disabled={biometricLoading}
              style={{ width: "100%", height: 50, background: "#E7F5EE", border: "1.5px solid #9AD8BC", borderRadius: 14, color: "#166E4B", fontSize: 14.5, fontWeight: 800, cursor: "pointer", opacity: biometricLoading ? 0.7 : 1, ...enter(0.5) }}>
              {biometricLoading ? t.login.biometricLoading : t.login.biometric}
            </button>
          )}
        </>}
      </div>
    </div>
  );
}
