"use client";
import { useState } from "react";

export function LoginScreen({
  loading, brandIcon, brandLabel, brandName, brandLabelColor, brandNameColor, companyTagline, brandTaglineColor,
  loginForm, setLoginForm, handleLogin, loginLocked, loginLockSecs, loginError, loginAttemptsLeft,
  t, isMobile, hasBiometric, biometricLoading, handleBiometricLogin,
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div style={{ height:"100vh", background:"linear-gradient(135deg,var(--app-primary-dark) 0%,var(--app-primary) 50%,var(--app-primary-dark) 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"Georgia,serif" }}>
      <div style={{ background:"#fff", borderRadius:"24px", padding: isMobile?"36px 28px":"48px 44px", width:"100%", maxWidth:"420px", boxShadow:"0 40px 100px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"72px", height:"72px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", borderRadius:"18px", marginBottom:"14px", boxShadow:"0 8px 24px rgba(var(--app-primary-rgb),0.4)", overflow:"hidden" }}>
            {brandIcon
              ? <img src={brandIcon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <span style={{ fontSize:"30px" }}>🍽️</span>}
          </div>
          <div style={{ color:brandLabelColor, fontSize:"11px", fontWeight:"700", letterSpacing:"4px", marginBottom:"5px" }}>{brandLabel}</div>
          <div style={{ color:brandNameColor, fontSize:"26px", fontWeight:"700", lineHeight:"1.1" }}>{brandName}</div>
          {companyTagline && <div style={{ color:brandTaglineColor, fontSize:"13px", marginTop:"3px" }}>{companyTagline}</div>}
        </div>
        {loading ? (
          <div style={{ textAlign:"center", padding:"20px", color:"#888" }}>
            <div style={{ fontSize:"24px", marginBottom:"10px" }}>⏳</div>{t.loading}
          </div>
        ) : <>
          <div style={{ marginBottom:"14px" }}>
            <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.login.usernameLabel}</label>
            <input style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
              value={loginForm.username} onChange={e=>setLoginForm(f=>({...f,username:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder={t.login.usernamePlaceholder} autoFocus />
          </div>
          <div style={{ marginBottom:"22px" }}>
            <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.login.passwordLabel}</label>
            <div style={{ display:"flex", border:"2px solid #E0D8CE", borderRadius:"10px", overflow:"hidden", background:"#fff" }}>
              <input
                type={showPassword ? "text" : "password"}
                style={{ flex:1, padding:"13px 14px", border:"none", fontSize:"15px", outline:"none", fontFamily:"inherit", background:"transparent" }}
                value={loginForm.password}
                onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder={t.login.passwordPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ padding:"0 14px", background:"none", border:"none", borderLeft:"1px solid #E0D8CE", cursor:"pointer", color:"#555", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {loginLocked ? (
            <div style={{ textAlign:"center", background:"#fff5f5", border:"2px solid #e74c3c", borderRadius:"12px", padding:"16px", marginBottom:"14px" }}>
              <div style={{ fontSize:"28px", marginBottom:"6px" }}>🔒</div>
              <div style={{ color:"#c0392b", fontWeight:"700", fontSize:"14px" }}>Acceso bloqueado temporalmente</div>
              <div style={{ color:"#e74c3c", fontSize:"22px", fontWeight:"700", marginTop:"6px", fontFamily:"monospace" }}>
                {Math.floor(loginLockSecs/60)}:{String(loginLockSecs%60).padStart(2,"0")}
              </div>
              <div style={{ color:"#888", fontSize:"12px", marginTop:"4px" }}>Demasiados intentos fallidos</div>
            </div>
          ) : (
            <>
              {loginError && (
                <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"10px", textAlign:"center", background:"#fef0ef", padding:"10px", borderRadius:"8px" }}>
                  {loginError}
                  {loginAttemptsLeft < 5 && loginAttemptsLeft > 0 && (
                    <div style={{ marginTop:"4px", fontWeight:"700" }}>⚠️ {loginAttemptsLeft} intento{loginAttemptsLeft!==1?"s":""} restante{loginAttemptsLeft!==1?"s":""}</div>
                  )}
                </div>
              )}
              <button onClick={handleLogin} disabled={loginLocked} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"10px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"1px" }}>
                {t.login.button}
              </button>
            </>
          )}

          {hasBiometric && (
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              style={{
                width:"100%", padding:"14px", marginTop:"12px",
                background:"linear-gradient(135deg,#27ae60,#1e8449)",
                border:"none", borderRadius:"10px", color:"#fff",
                fontSize:"15px", fontWeight:"700", cursor:"pointer",
                fontFamily:"Georgia,serif", letterSpacing:"1px",
                opacity: biometricLoading ? 0.7 : 1,
                display:"flex", alignItems:"center", justifyContent:"center", gap:"8px"
              }}
            >
              {biometricLoading ? t.login.biometricLoading : t.login.biometric}
            </button>
          )}

        </>}
      </div>
    </div>
  );
}
