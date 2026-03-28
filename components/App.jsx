"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { getRecipes, upsertRecipe, insertRecipe, deleteRecipe as deleteRecipeDb, getUsers, saveUsers as saveUsersDb, uploadImage, deleteImage, logActivity, getCategories, upsertCategory, deleteCategory as deleteCategoryDb, saveWatermarkConfig, loadWatermarkConfig } from "@/lib/storage";
import { CATEGORIES, INITIAL_USERS } from "@/lib/constants";
import { RecipeDetail } from "@/components/RecipeDetail";
import { RecipeForm } from "@/components/RecipeForm";
import { UsersPanel } from "@/components/UsersPanel";
import { ActivityReport } from "@/components/ActivityReport";
import { ProgressReport } from "@/components/ProgressReport";
import { CategoryModal } from "@/components/CategoryModal";
import { ScreenProtection } from "@/components/ScreenProtection";
import { GlobalWatermark } from "@/components/Watermark";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLang, LangProvider } from "@/lib/LangContext";
import { LANGUAGES } from "@/lib/i18n";

export default function App() {
  const isMobile = useIsMobile();
  const { online, syncing, pendingCount } = useOnlineStatus();
  const { lang, setLang, t } = useLang();
  const { isSupported: biometricSupported, hasCredential: hasBiometric, register: registerBiometric, authenticate: authBiometric, clearCredential } = useWebAuthn();
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [loginForm, setLoginForm] = useState({ username:"", password:"" });
  const [loginError, setLoginError] = useState("");
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [watermarkLogo, setWatermarkLogo] = useState(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.07);
  const [watermarkSize, setWatermarkSize] = useState(45);
  const [showWatermarkUpload, setShowWatermarkUpload] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandLabel, setBrandLabel] = useState("RECETARIO DIGITAL");
  const [brandName, setBrandName] = useState("Don Telmo®");
  const [companyTagline, setCompanyTagline] = useState("1958 — Company");
  const [brandIcon, setBrandIcon] = useState(null);
  const [brandDraft, setBrandDraft] = useState({ label:"RECETARIO DIGITAL", name:"Don Telmo®", tagline:"1958 — Company", icon:null });
  const [showLangModal, setShowLangModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(null); // { mode: "create"|"edit", initial? }
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }
  const searchTimeoutRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const watermarkConfigRef = useRef({ logo: null, opacity: 0.07, size: 45 });

  const saveWatermark = useCallback((updates) => {
    const next = { ...watermarkConfigRef.current, ...updates };
    watermarkConfigRef.current = next;
    if (updates.logo !== undefined) { setWatermarkLogo(updates.logo); localStorage.setItem("dontelmo:watermark_url", updates.logo || ""); }
    if (updates.opacity !== undefined) { setWatermarkOpacity(updates.opacity); localStorage.setItem("dontelmo:watermark_opacity", updates.opacity); }
    if (updates.size !== undefined) { setWatermarkSize(updates.size); localStorage.setItem("dontelmo:watermark_size", updates.size); }
    saveWatermarkConfig(next);
  }, []);

  // Cerrar menú settings al hacer clic fuera
  useEffect(() => {
    if (!showSettingsMenu) return;
    const handler = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSettingsMenu]);

  // En móvil: cerrar sidebar por defecto
  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  useEffect(() => {
    async function load() {
      const sr = await getRecipes();
      const su = await getUsers();
      if (sr) { setRecipes(sr); }
      else {
        // Lazy load seed data solo si la DB está vacía
        const { SEED_RECIPES } = await import("@/data/seed-recipes");
        setRecipes(SEED_RECIPES);
      }
      if (su && su.length > 0) setUsers(su);
      const cats = await getCategories();
      if (cats && cats.length > 0) setDbCategories(cats);
      // Cargar configuración watermark desde Supabase (sincronizado)
      const wmConfig = await loadWatermarkConfig();
      if (wmConfig) {
        watermarkConfigRef.current = { logo: wmConfig.logo || null, opacity: wmConfig.opacity ?? 0.07, size: wmConfig.size ?? 45 };
        if (wmConfig.logo) { setWatermarkLogo(wmConfig.logo); localStorage.setItem("dontelmo:watermark_url", wmConfig.logo); }
        if (wmConfig.opacity != null) { setWatermarkOpacity(wmConfig.opacity); localStorage.setItem("dontelmo:watermark_opacity", wmConfig.opacity); }
        if (wmConfig.size != null) { setWatermarkSize(wmConfig.size); localStorage.setItem("dontelmo:watermark_size", wmConfig.size); }
      } else {
        // Fallback a localStorage si no hay conexión
        const savedWatermark = localStorage.getItem("dontelmo:watermark_url");
        if (savedWatermark) setWatermarkLogo(savedWatermark);
        const savedOpacity = localStorage.getItem("dontelmo:watermark_opacity");
        if (savedOpacity) setWatermarkOpacity(parseFloat(savedOpacity));
        const savedSize = localStorage.getItem("dontelmo:watermark_size");
        if (savedSize) setWatermarkSize(parseInt(savedSize));
      }
      const savedLabel = localStorage.getItem("dontelmo:brandLabel");
      const savedName = localStorage.getItem("dontelmo:brandName");
      const savedTagline = localStorage.getItem("dontelmo:tagline");
      const savedIcon = localStorage.getItem("dontelmo:brandIcon");
      const draft = {
        label: savedLabel ?? "RECETARIO DIGITAL",
        name: savedName ?? "Don Telmo®",
        tagline: savedTagline ?? "1958 — Company",
        icon: savedIcon || null,
      };
      if (savedLabel !== null) setBrandLabel(savedLabel);
      if (savedName !== null) setBrandName(savedName);
      if (savedTagline !== null) setCompanyTagline(savedTagline);
      if (savedIcon) setBrandIcon(savedIcon);
      setBrandDraft(draft);
      setLoading(false);
    }
    load();
  }, []);

  const saveUsers = async u => { setUsers(u); await saveUsersDb(u); };

  const handleLogin = () => {
    const u = users.find(u => u.username.trim()===loginForm.username.trim() && u.password.trim()===loginForm.password.trim());
    if (!u) { setLoginError(t.login.error); return; }
    setCurrentUser(u); setScreen("app"); setLoginError("");
    logActivity(u.id, "login");
    // Ofrecer biometría en móvil si no tiene credencial registrada
    if (isMobile && biometricSupported && !hasBiometric) {
      setTimeout(() => setShowBiometricPrompt(true), 500);
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setLoginError("");
    const user = await authBiometric();
    if (user) {
      setCurrentUser(user); setScreen("app");
      logActivity(user.id, "login");
    } else {
      setLoginError("No se pudo verificar la identidad biométrica");
    }
    setBiometricLoading(false);
  };

  const handleRegisterBiometric = async () => {
    const ok = await registerBiometric(currentUser);
    setShowBiometricPrompt(false);
    if (!ok) alert("No se pudo registrar el acceso biométrico");
  };

  const handleLogout = () => { setCurrentUser(null); setScreen("login"); setLoginForm({username:"",password:""}); setSelectedRecipe(null); };

  const selectCat = (catId) => {
    setSelectedCat(catId);
    setSearch("");
    if (isMobile) setSidebarOpen(false);
  };

  const openRecipe = (r) => {
    setSelectedRecipe(r);
    if (isMobile) setSidebarOpen(false);
    if (currentUser) logActivity(currentUser.id, "view_recipe", r.name, r.category);
  };

  const handleCreate = () => { setEditingRecipe(null); setShowForm(true); };
  const handleEdit = r => { setEditingRecipe(r); setShowForm(true); setSelectedRecipe(null); };
  const handleSaveRecipe = async (form) => {
    if (editingRecipe) {
      // Si la imagen cambió y la anterior era una URL de Storage, eliminarla
      if (editingRecipe.image && editingRecipe.image !== form.image && editingRecipe.image.includes("supabase")) {
        await deleteImage(editingRecipe.image);
      }
      const updated = await upsertRecipe({ ...form, id: editingRecipe.id });
      if (updated) setRecipes(recipes.map(r => r.id === editingRecipe.id ? updated : r));
    } else {
      const created = await insertRecipe(form);
      if (created) setRecipes([...recipes, created]);
    }
    setShowForm(false); setEditingRecipe(null);
  };
  const handleTogglePublish = async (r) => {
    const updated = { ...r, published: !r.published };
    const saved = await upsertRecipe(updated);
    if (saved) {
      setRecipes(prev => prev.map(x => x.id === r.id ? { ...x, published: !r.published } : x));
      setSelectedRecipe(prev => prev ? { ...prev, published: !r.published } : null);
    }
  };

  const handleDelete = (r) => {
    setConfirmModal({
      title: "Eliminar Receta",
      message: `¿Estás seguro de eliminar "${r.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        if (r.image && r.image.includes("supabase")) {
          await deleteImage(r.image);
        }
        const ok = await deleteRecipeDb(r.id);
        if (ok) setRecipes(prev => prev.filter(x => x.id !== r.id));
        setSelectedRecipe(null);
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteCategory = (catId) => {
    const catLabel = allCategories.find(c => c.id === catId)?.label || catId;
    const catRecipes = recipes.filter(r => r.category === catId);
    setConfirmModal({
      title: "Eliminar Categoría Completa",
      message: `¿Estás seguro de eliminar la categoría "${catLabel}" y sus ${catRecipes.length} receta${catRecipes.length !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        for (const r of catRecipes) {
          if (r.image && r.image.includes("supabase")) {
            await deleteImage(r.image);
          }
          await deleteRecipeDb(r.id);
        }
        setRecipes(prev => prev.filter(r => r.category !== catId));
        setSelectedCat("all");
        setSelectedRecipe(null);
        setConfirmModal(null);
      }
    });
  };

  // Filtrado
  // Cocineros solo ven recetas publicadas, admin ve todo
  const isAdminUser = currentUser?.role === "admin";
  const visibleRecipes = useMemo(() => {
    if (isAdminUser) return recipes;
    return recipes.filter(r => r.published);
  }, [recipes, isAdminUser]);

  const filtered = useMemo(() => {
    if (!search) return visibleRecipes.filter(r => selectedCat === "all" || r.category === selectedCat);
    // Si hay búsqueda, buscar en TODAS las categorías y en múltiples campos
    const terms = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return visibleRecipes.filter(r => {
      const searchable = [
        r.name, r.category, r.description || "", r.preparation || "",
        r.recommendations || "", r.salesPitch || "",
        ...(r.ingredients || [])
      ].join(" ").toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [visibleRecipes, selectedCat, search]);

  const catCounts = useMemo(() => {
    const counts = {};
    visibleRecipes.forEach(r => { counts[r.category] = (counts[r.category]||0)+1; });
    return counts;
  }, [visibleRecipes]);

  // Categorías: de Supabase si hay, sino del archivo constants
  const allCategories = useMemo(() => {
    const base = dbCategories.length > 0
      ? [{ id: "all", label: t.allRecipes, icon: "🍽️" }, ...dbCategories]
      : CATEGORIES;
    // Agregar categorías que existan en recetas pero no en la lista
    const baseIds = base.map(c => c.id);
    const extraCats = Object.keys(catCounts)
      .filter(id => !baseIds.includes(id))
      .map(id => ({ id, label: id, icon: "🍽️" }));
    return [...base, ...extraCats];
  }, [dbCategories, catCounts]);

  // ══ LOGIN ═══════════════════════════════════════════════════════
  if (screen==="login" || loading) {
    return (
      <div style={{ height:"100vh", background:"linear-gradient(135deg,#0d2340 0%,#1B3A5C 50%,#0d2340 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"Georgia,serif" }}>
        <div style={{ background:"#fff", borderRadius:"24px", padding: isMobile?"36px 28px":"48px 44px", width:"100%", maxWidth:"420px", boxShadow:"0 40px 100px rgba(0,0,0,0.5)" }}>
          <div style={{ textAlign:"center", marginBottom:"32px" }}>
            <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"72px", height:"72px", background:"linear-gradient(135deg,#1B3A5C,#0d2340)", borderRadius:"18px", marginBottom:"14px", boxShadow:"0 8px 24px rgba(27,58,92,0.4)", overflow:"hidden" }}>
              {brandIcon
                ? <img src={brandIcon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ fontSize:"30px" }}>🍽️</span>}
            </div>
            <div style={{ color:"#D4721A", fontSize:"11px", fontWeight:"700", letterSpacing:"4px", marginBottom:"5px" }}>{brandLabel}</div>
            <div style={{ color:"#1B3A5C", fontSize:"26px", fontWeight:"700", lineHeight:"1.1" }}>{brandName}</div>
            {companyTagline && <div style={{ color:"#888", fontSize:"13px", marginTop:"3px" }}>{companyTagline}</div>}
          </div>
          {loading ? (
            <div style={{ textAlign:"center", padding:"20px", color:"#888" }}>
              <div style={{ fontSize:"24px", marginBottom:"10px" }}>⏳</div>{t.loading}
            </div>
          ) : <>
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.login.usernameLabel}</label>
              <input style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
                value={loginForm.username} onChange={e=>setLoginForm(f=>({...f,username:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder={t.login.usernamePlaceholder} autoFocus />
            </div>
            <div style={{ marginBottom:"22px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.login.passwordLabel}</label>
              <input type="password" style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
                value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder={t.login.passwordPlaceholder} />
            </div>
            {loginError && <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"14px", textAlign:"center", background:"#fef0ef", padding:"10px", borderRadius:"8px" }}>{loginError}</div>}
            <button onClick={handleLogin} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,#1B3A5C,#0d2340)", border:"none", borderRadius:"10px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"1px" }}>
              {t.login.button}
            </button>

            {/* Botón de acceso biométrico */}
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

            <div style={{ textAlign:"center", marginTop:"18px", fontSize:"11px", color:"#bbb" }}>{t.login.tagline}</div>
          </>}
        </div>
      </div>
    );
  }

  // ══ APP PRINCIPAL ════════════════════════════════════════════════
  const isAdmin = currentUser.role === "admin";

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Segoe UI',sans-serif", overflow:"hidden", background:"#F4F0EB" }}>
      <ScreenProtection userName={currentUser?.name} />
      {!selectedRecipe && !showForm && !showUsers && !showReport && !showProgress && !showWatermarkUpload && !showLangModal && !categoryModal && !confirmModal && !showBiometricPrompt && <GlobalWatermark username={currentUser?.name || ""} sede={currentUser?.sede || ""} customLogo={watermarkLogo} opacity={watermarkOpacity} size={watermarkSize} />}

      {/* OFFLINE BANNER */}
      {!online && (
        <div style={{ background:"#e74c3c", color:"#fff", textAlign:"center", padding:"8px 14px", fontSize:"13px", fontWeight:"600", zIndex:100, flexShrink:0 }}>
          📡 Sin conexión — Los cambios se guardarán localmente y se sincronizarán al reconectar
        </div>
      )}
      {online && syncing && (
        <div style={{ background:"#f39c12", color:"#fff", textAlign:"center", padding:"6px 14px", fontSize:"12px", fontWeight:"600", zIndex:100, flexShrink:0 }}>
          ⏳ Sincronizando {pendingCount} cambios pendientes...
        </div>
      )}

      {/* HEADER */}
      <header style={{ height:"58px", flexShrink:0, background:"linear-gradient(135deg,#1B3A5C,#0d2340)", display:"flex", alignItems:"center", gap:"12px", padding:"0 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.3)", zIndex:50 }}>
        <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"8px", color:"#fff", width:"36px", height:"36px", cursor:"pointer", fontSize:"16px", flexShrink:0 }}>☰</button>

        {!isMobile && (
          <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:"linear-gradient(135deg,#1B3A5C,#0d2340)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, border:"1px solid rgba(255,255,255,0.15)" }}>
              {brandIcon
                ? <img src={brandIcon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ fontSize:"14px" }}>🍽️</span>}
            </div>
            <div>
              <div style={{ color:"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>{brandLabel}</div>
              <div style={{ color:"#fff", fontSize:"15px", fontWeight:"700", fontFamily:"Georgia,serif", lineHeight:"1" }}>{brandName} {companyTagline && <span style={{ color:"#8BAACC", fontSize:"11px" }}>{companyTagline}</span>}</div>
            </div>
          </div>
        )}

        {/* Buscador */}
        <div style={{ flex:1, position:"relative" }}>
          <span style={{ position:"absolute", left:"11px", top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.5)", fontSize:"13px" }}>🔍</span>
          <input
            style={{ width:"100%", padding:"8px 12px 8px 34px", border:"none", borderRadius:"20px", background:"rgba(255,255,255,0.13)", color:"#fff", fontSize:"13px", outline:"none", boxSizing:"border-box" }}
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (isMobile) setSidebarOpen(false);
              // Log search after user stops typing (debounced via timeout)
              clearTimeout(searchTimeoutRef.current);
              if (e.target.value.length >= 3) {
                const val = e.target.value;
                searchTimeoutRef.current = setTimeout(() => {
                  if (currentUser) logActivity(currentUser.id, "search", val);
                }, 1500);
              }
            }}
          />
        </div>

        {/* Acciones */}
        <div style={{ display:"flex", gap:"8px", alignItems:"center", flexShrink:0 }}>
          {isAdmin && <>
            <button onClick={handleCreate} style={{ background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 12px", cursor:"pointer", fontWeight:"700", fontSize:"13px", whiteSpace:"nowrap" }}>{t.newRecipe}</button>
            <div style={{ position:"relative" }} ref={settingsMenuRef}>
              <button onClick={()=>setShowSettingsMenu(v=>!v)} title="Configuración" style={{ background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"16px" }}>⚙️</button>
              {showSettingsMenu && (
                <div style={{
                  position:"absolute", top:"42px", right:0, background:"#1B3A5C", borderRadius:"12px",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.4)", padding:"8px", zIndex:9999, minWidth:"200px",
                  border:"1px solid rgba(255,255,255,0.15)",
                }}>
                  <button onClick={()=>{setShowProgress(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.target.style.background="none"}>
                    {t.settings.status}
                  </button>
                  <button onClick={()=>{setShowReport(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.target.style.background="none"}>
                    {t.settings.report}
                  </button>
                  <button onClick={()=>{setShowUsers(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.target.style.background="none"}>
                    {t.settings.users}
                  </button>
                  <div style={{ height:"1px", background:"rgba(255,255,255,0.15)", margin:"4px 0" }} />
                  <button onClick={()=>{setShowWatermarkUpload(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    {t.settings.watermark}
                  </button>
                  <button onClick={()=>{setBrandDraft({label:brandLabel,name:brandName,tagline:companyTagline});setShowBrandModal(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    🏷️ {t.settings?.brand || "Nombre Marca"}
                  </button>
                  <button onClick={()=>{setShowLangModal(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    {t.settings.language}
                  </button>
                </div>
              )}
            </div>
          </>}
          <button onClick={handleLogout} title="Cerrar sesión" style={{ display:"flex", alignItems:"center", gap:"8px", background:"#c0392b", border:"none", borderRadius:"8px", color:"#fff", padding:"8px 14px", cursor:"pointer", fontSize:"13px", fontWeight:"700", letterSpacing:"0.5px" }}>
            🚪 {t.logout}
          </button>
        </div>
      </header>


      {/* BODY */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>

        {/* Overlay backdrop en móvil */}
        {isMobile && sidebarOpen && (
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)", zIndex:40 }} onClick={()=>setSidebarOpen(false)} />
        )}

        {/* SIDEBAR */}
        {sidebarOpen && (
          <aside style={{
            width:"240px", flexShrink:0, background:"#1B3A5C",
            overflowY:"auto", overflowX:"hidden",
            display:"flex", flexDirection:"column",
            position: isMobile ? "absolute" : "relative",
            top:0, left:0, bottom:0, zIndex: isMobile ? 41 : 1,
            height: isMobile ? "100%" : "auto",
            boxShadow: isMobile ? "4px 0 20px rgba(0,0,0,0.4)" : "none"
          }}>
            <div style={{ padding:"14px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ color:"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"2px", fontFamily:"Georgia,serif" }}>{t.categories}</div>
            </div>
            {allCategories.map(cat => {
              const count = cat.id==="all" ? recipes.length : (catCounts[cat.id]||0);
              const active = selectedCat===cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => selectCat(cat.id)}
                  style={{
                    width:"100%", textAlign:"left",
                    background: active ? "rgba(212,114,26,0.22)" : "transparent",
                    border:"none",
                    borderLeft: active ? "3px solid #D4721A" : "3px solid transparent",
                    color: active ? "#fff" : "#9BBACC",
                    padding:"10px 16px",
                    cursor:"pointer",
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    fontSize:"13px", fontWeight: active ? "700" : "400",
                    transition:"all 0.15s"
                  }}
                >
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:"8px" }}>
                    {cat.icon} {cat.label}
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                    {isAdmin && cat.id !== "all" && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setCategoryModal({ mode: "edit", initial: cat }); }}
                        style={{ background:"rgba(255,255,255,0.1)", borderRadius:"6px", padding:"2px 5px", fontSize:"11px", cursor:"pointer", color:"#8BAACC", lineHeight:1, opacity:0.5, transition:"opacity 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
                        title={`Editar categoría ${cat.label}`}
                      >✏️</span>
                    )}
                    {isAdmin && cat.id !== "all" && count > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                        style={{ background:"rgba(231,76,60,0.15)", borderRadius:"6px", padding:"2px 5px", fontSize:"11px", cursor:"pointer", color:"#e74c3c", lineHeight:1, opacity:0.5, transition:"opacity 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
                        title={`Eliminar categoría ${cat.label}`}
                      >🗑️</span>
                    )}
                    <span style={{ background: active ? "#D4721A" : "rgba(255,255,255,0.1)", borderRadius:"10px", padding:"2px 7px", fontSize:"11px", fontWeight:"700", color: active ? "#fff" : "#9BBACC" }}>
                      {count}
                    </span>
                  </span>
                </button>
              );
            })}
            {isAdmin && (
              <button
                onClick={() => setCategoryModal({ mode: "create" })}
                style={{
                  width: "100%", textAlign: "left", background: "rgba(212,114,26,0.12)", border: "none",
                  borderLeft: "3px solid #D4721A", color: "#D4721A", padding: "10px 16px", cursor: "pointer",
                  fontSize: "13px", fontWeight: "600", marginTop: "4px"
                }}
              >
                {t.newCategory}
              </button>
            )}
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main style={{ flex:1, overflowY:"auto", padding: isMobile ? "14px" : "22px", minWidth:0 }}>
          {/* Título */}
          <div style={{ marginBottom:"18px" }}>
            <h1 style={{ margin:0, color:"#1B3A5C", fontFamily:"Georgia,serif", fontSize: isMobile?"18px":"21px", fontWeight:"700" }}>
              {allCategories.find(c=>c.id===selectedCat)?.icon} {allCategories.find(c=>c.id===selectedCat)?.label}
            </h1>
            <div style={{ color:"#888", fontSize:"13px", marginTop:"3px" }}>
              {filtered.length} {filtered.length!==1 ? t.recipes : t.recipe}{search && ` — "${search}"`}
            </div>
          </div>

          {/* Grid */}
          {filtered.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#888" }}>
              <div style={{ fontSize:"48px" }}>🔍</div>
              <div style={{ marginTop:"12px", fontSize:"15px" }}>{t.noResults}</div>
              {search && <button onClick={()=>setSearch("")} style={{ marginTop:"10px", background:"#1B3A5C", border:"none", borderRadius:"8px", color:"#fff", padding:"8px 16px", cursor:"pointer" }}>{t.clearSearch}</button>}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(auto-fill,minmax(150px,1fr))" : "repeat(auto-fill,minmax(210px,1fr))", gap: isMobile?"12px":"16px" }}>
              {filtered.map(r => (
                <div
                  key={r.id}
                  onClick={() => openRecipe(r)}
                  style={{ background:"#EDEDED", borderRadius:"14px", overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.07)", cursor:"pointer", border:"1px solid #E0E0E0", transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 10px 28px rgba(0,0,0,0.14)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.07)";}}
                >
                  <div style={{ height: isMobile?"100px":"128px", background:r.image?"transparent":"#E5E5E5", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                    {r.image
                      ? <img src={r.image} alt={r.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <div style={{ textAlign:"center", color:"#C0B8A8" }}>
                          <div style={{ fontSize:"28px" }}>{allCategories.find(c=>c.id===r.category)?.icon||"🍽️"}</div>
                        </div>
                    }
                    {r.video && <div style={{ position:"absolute", top:"6px", right:"6px", background:"#e74c3c", borderRadius:"5px", padding:"2px 6px", fontSize:"10px", color:"#fff", fontWeight:"700" }}>▶</div>}
                    {isAdmin && !r.published && <div style={{ position:"absolute", top:"6px", left:"6px", background:"#7f8c8d", borderRadius:"5px", padding:"2px 6px", fontSize:"10px", color:"#fff", fontWeight:"700" }}>📝 {t.draft}</div>}
                  </div>
                  <div style={{ padding: isMobile?"10px":"13px" }}>
                    <div style={{ background:"#F7F3EE", borderRadius:"5px", padding:"2px 7px", fontSize:"9px", fontWeight:"700", color:"#D4721A", display:"inline-block", marginBottom:"5px", letterSpacing:"0.5px" }}>
                      {r.category.toUpperCase()}
                    </div>
                    <div style={{ fontWeight:"700", color:"#1B3A5C", fontSize: isMobile?"12px":"13px", lineHeight:"1.3", fontFamily:"Georgia,serif" }}>{r.name}</div>
                    <div style={{ color:"#aaa", fontSize:"11px", marginTop:"6px" }}>{t.ingredients_count(r.ingredients.length)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* MODALES */}
      {selectedRecipe && !showForm && (
        <RecipeDetail recipe={selectedRecipe} currentUser={currentUser} onClose={()=>setSelectedRecipe(null)} onEdit={()=>handleEdit(selectedRecipe)} onDelete={()=>handleDelete(selectedRecipe)} onTogglePublish={()=>handleTogglePublish(selectedRecipe)} />
      )}
      {showForm && (
        <RecipeForm initial={editingRecipe} categories={allCategories} onSave={handleSaveRecipe} onCancel={()=>{setShowForm(false);setEditingRecipe(null);}} />
      )}
      {showUsers && isAdmin && (
        <UsersPanel users={users} onSave={saveUsers} onClose={()=>setShowUsers(false)} />
      )}
      {showReport && isAdmin && (
        <ActivityReport onClose={()=>setShowReport(false)} />
      )}
      {showProgress && isAdmin && (
        <ProgressReport recipes={recipes} onClose={()=>setShowProgress(false)} />
      )}
      {categoryModal && isAdmin && (
        <CategoryModal
          mode={categoryModal.mode}
          initial={categoryModal.initial}
          onClose={() => setCategoryModal(null)}
          onSave={async (cat) => {
            if (cat.oldId && cat.oldId !== cat.id) {
              // Editar: renombrar categoría en todas las recetas
              const toUpdate = recipes.filter(r => r.category === cat.oldId);
              for (const r of toUpdate) {
                await upsertRecipe({ ...r, category: cat.id });
              }
              setRecipes(prev => prev.map(r => r.category === cat.oldId ? { ...r, category: cat.id } : r));
              // Eliminar la vieja y crear la nueva en Supabase
              await deleteCategoryDb(cat.oldId);
              await upsertCategory({ id: cat.id, label: cat.label, icon: cat.icon, sort_order: 999 });
            } else if (cat.oldId) {
              // Solo editar ícono/label
              await upsertCategory({ id: cat.id, label: cat.label, icon: cat.icon });
            } else {
              // Nueva categoría
              await upsertCategory({ id: cat.id, label: cat.label, icon: cat.icon, sort_order: 999 });
            }
            // Recargar categorías
            const fresh = await getCategories();
            if (fresh) setDbCategories(fresh);
            setSelectedCat(cat.id);
            setCategoryModal(null);
          }}
        />
      )}

      {/* Modal de idioma */}
      {showLangModal && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(10,15,25,0.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"360px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", position:"relative" }}>
            <button onClick={() => setShowLangModal(false)} style={{ position:"absolute", top:"14px", right:"14px", background:"rgba(0,0,0,0.08)", border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"18px", color:"#555", lineHeight:"1" }}>×</button>
            <div style={{ fontSize:"32px", textAlign:"center", marginBottom:"6px" }}>🌐</div>
            <div style={{ color:"#1B3A5C", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", textAlign:"center", marginBottom:"6px" }}>
              {t.language.title}
            </div>
            <div style={{ color:"#888", fontSize:"13px", textAlign:"center", marginBottom:"24px" }}>
              {t.language.subtitle}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" }}>
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)} style={{
                  display:"flex", alignItems:"center", gap:"14px",
                  padding:"14px 18px", borderRadius:"12px", border:"2px solid",
                  borderColor: lang === l.code ? "#1B3A5C" : "#eee",
                  background: lang === l.code ? "#f0f4f8" : "#fff",
                  cursor:"pointer", textAlign:"left",
                }}>
                  <span style={{ fontSize:"28px" }}>{l.flag}</span>
                  <div>
                    <div style={{ fontWeight:"700", color:"#1B3A5C", fontSize:"15px" }}>{l.label}</div>
                  </div>
                  {lang === l.code && <span style={{ marginLeft:"auto", color:"#1B3A5C", fontSize:"18px" }}>✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowLangModal(false)} style={{
              width:"100%", background:"#1B3A5C", border:"none", padding:"13px", borderRadius:"12px",
              color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"15px",
            }}>
              {t.language.save}
            </button>
          </div>
        </div>
      )}

      {/* Modal para cambiar marca de agua */}
      {showWatermarkUpload && isAdmin && (
        <div style={{ position:"fixed", inset:0, zIndex:9995, background:"#0d2340", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"440px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize:"28px", marginBottom:"4px", textAlign:"center" }}>🖼️</div>
            <div style={{ color:"#1B3A5C", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"16px", textAlign:"center" }}>
              {t.watermark.title}
            </div>

            {/* Preview actual — fondo blanco simula la página */}
            <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #eee", padding:"20px", marginBottom:"16px", textAlign:"center", minHeight:"120px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <img
                src={watermarkLogo || "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png"}
                alt={t.watermark.preview}
                style={{ width: watermarkSize + "%", maxWidth:"220px", opacity: Math.max(watermarkOpacity, 0.15) }}
              />
              <div style={{ color:"#bbb", fontSize:"11px", marginTop:"8px" }}>{t.watermark.previewNote}</div>
            </div>

            {/* Slider de visibilidad */}
            <div style={{ background:"#f8f8f8", borderRadius:"10px", padding:"12px 14px", marginBottom:"10px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                <span style={{ fontSize:"13px", color:"#333", fontWeight:"600" }}>{t.watermark.visibility}</span>
                <span style={{ fontSize:"13px", color:"#1B3A5C", fontWeight:"700" }}>{Math.round(watermarkOpacity * 100)}%</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"#999", width:"40px" }}>{t.watermark.faint}</span>
                <input type="range" min="1" max="40" value={Math.round(watermarkOpacity * 100)}
                  onInput={e => saveWatermark({ opacity: parseInt(e.target.value) / 100 })}
                  onChange={e => saveWatermark({ opacity: parseInt(e.target.value) / 100 })}
                  style={{ flex:1, accentColor:"#1B3A5C", cursor:"pointer", height:"20px", touchAction:"none" }}
                />
                <span style={{ fontSize:"11px", color:"#999", width:"40px", textAlign:"right" }}>{t.watermark.visible}</span>
              </div>
            </div>

            {/* Slider de tamaño */}
            <div style={{ background:"#f8f8f8", borderRadius:"10px", padding:"12px 14px", marginBottom:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                <span style={{ fontSize:"13px", color:"#333", fontWeight:"600" }}>{t.watermark.size}</span>
                <span style={{ fontSize:"13px", color:"#1B3A5C", fontWeight:"700" }}>{watermarkSize}%</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"#999", width:"40px" }}>{t.watermark.small}</span>
                <input type="range" min="10" max="90" value={watermarkSize}
                  onInput={e => saveWatermark({ size: parseInt(e.target.value) })}
                  onChange={e => saveWatermark({ size: parseInt(e.target.value) })}
                  style={{ flex:1, accentColor:"#1B3A5C", cursor:"pointer", height:"20px", touchAction:"none" }}
                />
                <span style={{ fontSize:"11px", color:"#999", width:"40px", textAlign:"right" }}>{t.watermark.large}</span>
              </div>
            </div>

            {/* Subir nueva imagen */}
            <label style={{
              display:"block", background:"#1B3A5C", color:"#fff", padding:"12px", borderRadius:"10px",
              textAlign:"center", cursor:"pointer", fontWeight:"700", fontSize:"14px", marginBottom:"12px",
            }}>
              {t.watermark.upload}
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const { supabase } = await import("@/lib/supabase");
                  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                  const path = `watermark/custom-watermark.${ext}`;
                  // Eliminar archivo anterior si existe
                  await supabase.storage.from("recipe-images").remove([path]);
                  // Subir nuevo
                  const { error } = await supabase.storage
                    .from("recipe-images")
                    .upload(path, file, { upsert: true, cacheControl: "0" });
                  if (error) throw error;
                  const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
                  // Guardar URL sin timestamp para que sea estable entre dispositivos
                  const stableUrl = urlData.publicUrl;
                  saveWatermark({ logo: stableUrl });
                  // Mostrar con timestamp para forzar recarga en este dispositivo
                  setWatermarkLogo(stableUrl + "?t=" + Date.now());
                } catch (err) {
                  console.error("Watermark upload error:", err);
                  const reader = new FileReader();
                  reader.onload = () => saveWatermark({ logo: reader.result });
                  reader.readAsDataURL(file);
                }
              }} />
            </label>

            {/* Restaurar por defecto */}
            {watermarkLogo && (
              <button onClick={() => saveWatermark({ logo: null })} style={{ width:"100%", background:"none", border:"1px solid #ddd", padding:"10px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", color:"#888", marginBottom:"12px" }}>
                {t.watermark.restore}
              </button>
            )}

            <button onClick={() => setShowWatermarkUpload(false)} style={{
              width:"100%", background:"#e74c3c", border:"none", padding:"12px", borderRadius:"10px",
              color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"14px",
            }}>
              {t.watermark.close}
            </button>
          </div>
        </div>
      )}

      {/* Modal Nombre Marca */}
      {showBrandModal && isAdmin && (
        <div style={{ position:"fixed", inset:0, zIndex:9995, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"28px 24px", width:"100%", maxWidth:"420px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ textAlign:"center", marginBottom:"18px" }}>
              <div style={{ fontSize:"28px", marginBottom:"6px" }}>🏷️</div>
              <div style={{ color:"#1B3A5C", fontSize:"17px", fontWeight:"700", fontFamily:"Georgia,serif" }}>{t.brand.title}</div>
            </div>

            {/* Preview en tiempo real */}
            <div style={{ background:"linear-gradient(135deg,#0d2340,#1B3A5C)", borderRadius:"14px", padding:"22px", textAlign:"center", marginBottom:"20px" }}>
              <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"62px", height:"62px", background:"linear-gradient(135deg,#1B3A5C,#0d2340)", borderRadius:"16px", marginBottom:"10px", boxShadow:"0 4px 16px rgba(0,0,0,0.4)", border:"2px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
                {brandDraft.icon
                  ? <img src={brandDraft.icon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontSize:"26px" }}>🍽️</span>}
              </div>
              <div style={{ color:"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"3px" }}>{brandDraft.label || "RECETARIO DIGITAL"}</div>
              <div style={{ color:"#fff", fontSize:"20px", fontWeight:"700", fontFamily:"Georgia,serif", marginTop:"2px" }}>{brandDraft.name || "Don Telmo®"}</div>
              {brandDraft.tagline && <div style={{ color:"#8BAACC", fontSize:"12px", marginTop:"2px" }}>{brandDraft.tagline}</div>}
            </div>

            {/* Imagen del ícono */}
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"8px" }}>🖼️ ÍCONO / LOGO</label>
              <label style={{ display:"block", background:"#1B3A5C", color:"#fff", padding:"11px", borderRadius:"10px", textAlign:"center", cursor:"pointer", fontWeight:"700", fontSize:"13px", marginBottom:"6px" }}>
                📤 Subir imagen
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const { supabase } = await import("@/lib/supabase");
                    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                    const path = `brand/brand-icon.${ext}`;
                    await supabase.storage.from("recipe-images").remove([path]);
                    const { error } = await supabase.storage.from("recipe-images").upload(path, file, { upsert:true, cacheControl:"0" });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
                    const url = urlData.publicUrl + "?t=" + Date.now();
                    setBrandDraft(d => ({...d, icon: url}));
                  } catch {
                    const reader = new FileReader();
                    reader.onload = () => setBrandDraft(d => ({...d, icon: reader.result}));
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
              {brandDraft.icon && (
                <button onClick={() => setBrandDraft(d => ({...d, icon:null}))} style={{ width:"100%", background:"none", border:"1px solid #e0d8ce", borderRadius:"8px", padding:"8px", cursor:"pointer", fontSize:"12px", color:"#c0392b" }}>
                  🗑️ Eliminar imagen
                </button>
              )}
            </div>

            {/* Campo 1: etiqueta naranja */}
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#D4721A", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.labelField}</label>
              <input
                type="text"
                value={brandDraft.label}
                onChange={e => setBrandDraft(d => ({...d, label: e.target.value}))}
                placeholder="RECETARIO DIGITAL"
                style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", textTransform:"uppercase" }}
                autoFocus
              />
            </div>

            {/* Campo 2: nombre principal */}
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.nameField}</label>
              <input
                type="text"
                value={brandDraft.name}
                onChange={e => setBrandDraft(d => ({...d, name: e.target.value}))}
                placeholder="Don Telmo®"
                style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
              />
            </div>

            {/* Campo 3: subtítulo */}
            <div style={{ marginBottom:"20px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#888", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.taglineLabel}</label>
              <input
                type="text"
                value={brandDraft.tagline}
                onChange={e => setBrandDraft(d => ({...d, tagline: e.target.value}))}
                placeholder="1958 — Company"
                style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
              />
            </div>

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => { setBrandDraft({ label:brandLabel, name:brandName, tagline:companyTagline, icon:brandIcon }); setShowBrandModal(false); }} style={{ flex:1, background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
                {t.brand.cancel}
              </button>
              <button onClick={() => {
                setBrandLabel(brandDraft.label);
                setBrandName(brandDraft.name);
                setCompanyTagline(brandDraft.tagline);
                setBrandIcon(brandDraft.icon);
                localStorage.setItem("dontelmo:brandLabel", brandDraft.label);
                localStorage.setItem("dontelmo:brandName", brandDraft.name);
                localStorage.setItem("dontelmo:tagline", brandDraft.tagline);
                if (brandDraft.icon) localStorage.setItem("dontelmo:brandIcon", brandDraft.icon);
                else localStorage.removeItem("dontelmo:brandIcon");
                setShowBrandModal(false);
              }} style={{ flex:1, background:"#1B3A5C", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
                {t.brand.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para activar acceso biométrico */}
      {showBiometricPrompt && (
        <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"360px", textAlign:"center", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize:"48px", marginBottom:"16px" }}>🔐</div>
            <div style={{ color:"#1B3A5C", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"8px" }}>
              Acceso Biométrico
            </div>
            <div style={{ color:"#666", fontSize:"13px", lineHeight:"1.6", marginBottom:"24px" }}>
              ¿Deseas activar el acceso con Face ID o huella dactilar para iniciar sesión más rápido?
            </div>
            <button
              onClick={handleRegisterBiometric}
              style={{
                width:"100%", padding:"14px",
                background:"linear-gradient(135deg,#27ae60,#1e8449)",
                border:"none", borderRadius:"10px", color:"#fff",
                fontSize:"15px", fontWeight:"700", cursor:"pointer",
                fontFamily:"Georgia,serif", marginBottom:"10px"
              }}
            >
              ✅ Sí, activar
            </button>
            <button
              onClick={() => setShowBiometricPrompt(false)}
              style={{
                width:"100%", padding:"12px",
                background:"#F0ECE6", border:"none", borderRadius:"10px",
                color:"#5a3e2b", fontSize:"14px", fontWeight:"600", cursor:"pointer"
              }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmModal && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"400px", textAlign:"center", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize:"48px", marginBottom:"16px" }}>⚠️</div>
            <div style={{ color:"#1B3A5C", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"8px" }}>
              {confirmModal.title}
            </div>
            <div style={{ color:"#666", fontSize:"14px", lineHeight:"1.6", marginBottom:"24px" }}>
              {confirmModal.message}
            </div>
            <button
              onClick={confirmModal.onConfirm}
              style={{
                width:"100%", padding:"14px",
                background:"linear-gradient(135deg,#e74c3c,#c0392b)",
                border:"none", borderRadius:"10px", color:"#fff",
                fontSize:"15px", fontWeight:"700", cursor:"pointer",
                fontFamily:"Georgia,serif", marginBottom:"10px"
              }}
            >
              🗑️ Sí, eliminar
            </button>
            <button
              onClick={() => setConfirmModal(null)}
              style={{
                width:"100%", padding:"12px",
                background:"#F0ECE6", border:"none", borderRadius:"10px",
                color:"#5a3e2b", fontSize:"14px", fontWeight:"600", cursor:"pointer"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
