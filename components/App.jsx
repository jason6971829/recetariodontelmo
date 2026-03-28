"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { getRecipes, upsertRecipe, insertRecipe, deleteRecipe as deleteRecipeDb, getUsers, saveUsers as saveUsersDb, uploadImage, deleteImage, logActivity, getCategories, upsertCategory, deleteCategory as deleteCategoryDb, saveWatermarkConfig, loadWatermarkConfig, saveBannerConfig, loadBannerConfig, saveProfileConfig, loadProfileConfig } from "@/lib/storage";
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
import { THEMES } from "@/lib/themes";

export default function App() {
  const isMobile = useIsMobile();
  const { online, syncing, pendingCount } = useOnlineStatus();
  const { lang, setLang, t, themeId, setTheme } = useLang();
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
  const [brandLabelColor, setBrandLabelColor] = useState("#D4721A");
  const [brandNameColor, setBrandNameColor] = useState("#1B3A5C");
  const [brandTaglineColor, setBrandTaglineColor] = useState("#888888");
  const [brandDraft, setBrandDraft] = useState({ label:"RECETARIO DIGITAL", name:"Don Telmo®", tagline:"1958 — Company", icon:null, labelColor:"#D4721A", nameColor:"#1B3A5C", taglineColor:"#888888" });

  const BRAND_COLORS = [
    "#ffffff","#D4721A","#f0b429","#f39c12","#27ae60","#2ecc71",
    "#3498db","#8BAACC","#9b59b6","#e74c3c","#e91e63","#aaaaaa",
    "#1B3A5C","#1a1a1a","#2c3e50","#16a085",
  ];
  const [showLangModal, setShowLangModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showBannerConfig, setShowBannerConfig] = useState(false);
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerImages, setBannerImages] = useState([]);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerSlide, setBannerSlide] = useState(0);
  const [bannerStripPos, setBannerStripPos] = useState(1);
  const [bannerCanTransition, setBannerCanTransition] = useState(true);
  const [bannerUploading, setBannerUploading] = useState(false);

  // Perfil
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", email: "", phone: "" });
  const [profileDraft, setProfileDraft] = useState({ name: "", email: "", phone: "" });
  const [profileSaved, setProfileSaved] = useState(false);

  // Recuperar contraseña
  const [showRecover, setShowRecover] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverState, setRecoverState] = useState("idle"); // idle | sending | sent | notfound | error

  const [categoryModal, setCategoryModal] = useState(null); // { mode: "create"|"edit", initial? }
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }
  const searchTimeoutRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const bannerIntervalRef = useRef(null);
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

  // Auto-slide del banner: avanza cada 8s en loop mientras esté visible
  useEffect(() => {
    if (!showBanner || !bannerActive || bannerImages.length <= 1) {
      clearInterval(bannerIntervalRef.current);
      return;
    }
    bannerIntervalRef.current = setInterval(() => {
      setBannerStripPos(p => p + 1);
      setBannerSlide(s => (s + 1) % bannerImages.length);
    }, 8000);
    return () => clearInterval(bannerIntervalRef.current);
  }, [showBanner, bannerActive, bannerImages.length]);

  // Loop seamless: cuando llega a un clon, salta instantáneamente al real
  useEffect(() => {
    if (bannerImages.length <= 1) return;
    const total = bannerImages.length + 2;
    if (bannerStripPos === total - 1) {
      const t1 = setTimeout(() => { setBannerCanTransition(false); setBannerStripPos(1); }, 550);
      const t2 = setTimeout(() => setBannerCanTransition(true), 620);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (bannerStripPos === 0) {
      const t1 = setTimeout(() => { setBannerCanTransition(false); setBannerStripPos(bannerImages.length); }, 550);
      const t2 = setTimeout(() => setBannerCanTransition(true), 620);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [bannerStripPos, bannerImages.length]);

  // Inyectar variables CSS del tema
  useEffect(() => {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const root = document.documentElement;
    root.style.setProperty("--app-primary", theme.primary);
    root.style.setProperty("--app-primary-dark", theme.dark);
    root.style.setProperty("--app-primary-light", theme.light);
    root.style.setProperty("--app-primary-rgb", theme.rgb);
  }, [themeId]);

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
      const savedLabelColor = localStorage.getItem("dontelmo:brandLabelColor");
      const savedNameColor = localStorage.getItem("dontelmo:brandNameColor");
      const savedTaglineColor = localStorage.getItem("dontelmo:brandTaglineColor");
      const draft = {
        label: savedLabel ?? "RECETARIO DIGITAL",
        name: savedName ?? "Don Telmo®",
        tagline: savedTagline ?? "1958 — Company",
        icon: savedIcon || null,
        labelColor: savedLabelColor || "#D4721A",
        nameColor: savedNameColor || "#1B3A5C",
        taglineColor: savedTaglineColor || "#888888",
      };
      if (savedLabel !== null) setBrandLabel(savedLabel);
      if (savedName !== null) setBrandName(savedName);
      if (savedTagline !== null) setCompanyTagline(savedTagline);
      if (savedIcon) setBrandIcon(savedIcon);
      if (savedLabelColor) setBrandLabelColor(savedLabelColor);
      if (savedNameColor) setBrandNameColor(savedNameColor);
      if (savedTaglineColor) setBrandTaglineColor(savedTaglineColor);
      setBrandDraft(draft);
      const bannerCfg = await loadBannerConfig();
      if (bannerCfg) {
        setBannerActive(bannerCfg.active ?? false);
        setBannerImages(bannerCfg.images ?? []);
      }
      const profCfg = await loadProfileConfig();
      if (profCfg) {
        setProfileData(profCfg);
        setProfileDraft(profCfg);
      }
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
    // Mostrar banner si está activo
    setTimeout(() => setShowBanner(true), 300);
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
      setTimeout(() => setShowBanner(true), 300);
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
      <>
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
              <input type="password" style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
                value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder={t.login.passwordPlaceholder} />
            </div>
            {loginError && <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"14px", textAlign:"center", background:"#fef0ef", padding:"10px", borderRadius:"8px" }}>{loginError}</div>}
            <button onClick={handleLogin} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"10px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"1px" }}>
              {t.login.button}
            </button>

            {/* Link recuperar contraseña */}
            <div style={{ textAlign:"right", marginTop:"-10px", marginBottom:"16px" }}>
              <button onClick={() => { setShowRecover(true); setRecoverEmail(""); setRecoverState("idle"); }}
                style={{ background:"none", border:"none", color:"var(--app-primary)", fontSize:"13px", cursor:"pointer", textDecoration:"underline", padding:0 }}>
                {t.login.forgotPassword}
              </button>
            </div>

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

      {/* Modal recuperar contraseña */}
      {showRecover && (
        <div style={{ position:"fixed", inset:0, zIndex:20000, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"380px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ textAlign:"center", marginBottom:"20px" }}>
              <div style={{ fontSize:"36px", marginBottom:"8px" }}>🔑</div>
              <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif" }}>{t.login.recover.title}</div>
              <div style={{ color:"#888", fontSize:"13px", marginTop:"6px" }}>{t.login.recover.desc}</div>
            </div>
            {recoverState === "sent" ? (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"12px" }}>✉️</div>
                <div style={{ color:"#27ae60", fontWeight:"700", fontSize:"15px", marginBottom:"20px" }}>{t.login.recover.sent}</div>
                <button onClick={() => setShowRecover(false)}
                  style={{ width:"100%", padding:"13px", background:"var(--app-primary)", border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:"pointer", fontSize:"14px" }}>
                  {t.login.recover.back}
                </button>
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={recoverEmail}
                  onChange={e => setRecoverEmail(e.target.value)}
                  placeholder={t.login.recover.emailPlaceholder}
                  style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", marginBottom:"10px" }}
                />
                {recoverState === "notfound" && <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"10px", background:"#fef0ef", padding:"10px", borderRadius:"8px" }}>{t.login.recover.notFound}</div>}
                {recoverState === "error" && <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"10px", background:"#fef0ef", padding:"10px", borderRadius:"8px" }}>{t.login.recover.error}</div>}
                <button
                  onClick={async () => {
                    if (!recoverEmail.trim()) return;
                    setRecoverState("sending");
                    try {
                      const res = await fetch("/api/recover", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email: recoverEmail.trim() }) });
                      const data = await res.json();
                      if (data.ok) { setRecoverState("sent"); }
                      else if (data.error === "email_not_found" || data.error === "no_profile") { setRecoverState("notfound"); }
                      else { setRecoverState("error"); }
                    } catch { setRecoverState("error"); }
                  }}
                  disabled={recoverState === "sending"}
                  style={{ width:"100%", padding:"13px", background:"var(--app-primary)", border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:"pointer", fontSize:"14px", marginBottom:"10px", opacity: recoverState === "sending" ? 0.7 : 1 }}>
                  {recoverState === "sending" ? t.login.recover.sending : t.login.recover.button}
                </button>
                <button onClick={() => setShowRecover(false)}
                  style={{ width:"100%", padding:"12px", background:"#f5f0eb", border:"none", borderRadius:"10px", color:"#888", fontWeight:"600", cursor:"pointer", fontSize:"13px" }}>
                  {t.login.recover.back}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      </>
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
      <header style={{ height:"58px", flexShrink:0, background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", display:"flex", alignItems:"center", gap:"12px", padding:"0 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.3)", zIndex:50 }}>
        <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"8px", color:"#fff", width:"36px", height:"36px", cursor:"pointer", fontSize:"16px", flexShrink:0 }}>☰</button>

        {!isMobile && (
          <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, border:"1px solid rgba(255,255,255,0.15)" }}>
              {brandIcon
                ? <img src={brandIcon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ fontSize:"14px" }}>🍽️</span>}
            </div>
            <div>
              <div style={{ color:brandLabelColor, fontSize:"9px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>{brandLabel}</div>
              <div style={{ color:"#fff", fontSize:"15px", fontWeight:"700", fontFamily:"Georgia,serif", lineHeight:"1" }}>{brandName} {companyTagline && <span style={{ color:brandTaglineColor, fontSize:"11px" }}>{companyTagline}</span>}</div>
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
                  position:"absolute", top:"42px", right:0, background:"var(--app-primary)", borderRadius:"12px",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.4)", padding:"8px", zIndex:9999, minWidth:"200px",
                  border:"1px solid rgba(255,255,255,0.15)",
                }}>
                  <button onClick={()=>{setProfileDraft({...profileData});setShowProfileModal(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    {t.settings.profile}
                  </button>
                  <div style={{ height:"1px", background:"rgba(255,255,255,0.15)", margin:"4px 0" }} />
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
                  <button onClick={()=>{setBrandDraft({label:brandLabel,name:brandName,tagline:companyTagline,icon:brandIcon,labelColor:brandLabelColor,nameColor:brandNameColor,taglineColor:brandTaglineColor});setShowBrandModal(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    🏷️ {t.settings?.brand || "Nombre Marca"}
                  </button>
                  <button onClick={()=>{setShowBannerConfig(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    📢 Banner de anuncios
                  </button>
                  <button onClick={()=>{setShowThemeModal(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    🎨 Tema de color
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
            width:"240px", flexShrink:0, background:"var(--app-primary)",
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
                        style={{ background:"rgba(255,255,255,0.1)", borderRadius:"6px", padding:"2px 5px", fontSize:"11px", cursor:"pointer", color:"var(--app-primary-light)", lineHeight:1, opacity:0.5, transition:"opacity 0.2s" }}
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
            <h1 style={{ margin:0, color:"var(--app-primary)", fontFamily:"Georgia,serif", fontSize: isMobile?"18px":"21px", fontWeight:"700" }}>
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
              {search && <button onClick={()=>setSearch("")} style={{ marginTop:"10px", background:"var(--app-primary)", border:"none", borderRadius:"8px", color:"#fff", padding:"8px 16px", cursor:"pointer" }}>{t.clearSearch}</button>}
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
                    <div style={{ fontWeight:"700", color:"var(--app-primary)", fontSize: isMobile?"12px":"13px", lineHeight:"1.3", fontFamily:"Georgia,serif" }}>{r.name}</div>
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
            <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", textAlign:"center", marginBottom:"6px" }}>
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
                  borderColor: lang === l.code ? "var(--app-primary)" : "#eee",
                  background: lang === l.code ? "#f0f4f8" : "#fff",
                  cursor:"pointer", textAlign:"left",
                }}>
                  <span style={{ fontSize:"28px" }}>{l.flag}</span>
                  <div>
                    <div style={{ fontWeight:"700", color:"var(--app-primary)", fontSize:"15px" }}>{l.label}</div>
                  </div>
                  {lang === l.code && <span style={{ marginLeft:"auto", color:"var(--app-primary)", fontSize:"18px" }}>✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowLangModal(false)} style={{
              width:"100%", background:"var(--app-primary)", border:"none", padding:"13px", borderRadius:"12px",
              color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"15px",
            }}>
              {t.language.save}
            </button>
          </div>
        </div>
      )}

      {/* Modal para cambiar marca de agua */}
      {showWatermarkUpload && isAdmin && (
        <div style={{ position:"fixed", inset:0, zIndex:9995, background:"var(--app-primary-dark)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"440px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize:"28px", marginBottom:"4px", textAlign:"center" }}>🖼️</div>
            <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"16px", textAlign:"center" }}>
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
                <span style={{ fontSize:"13px", color:"var(--app-primary)", fontWeight:"700" }}>{Math.round(watermarkOpacity * 100)}%</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"#999", width:"40px" }}>{t.watermark.faint}</span>
                <input type="range" min="1" max="40" value={Math.round(watermarkOpacity * 100)}
                  onInput={e => saveWatermark({ opacity: parseInt(e.target.value) / 100 })}
                  onChange={e => saveWatermark({ opacity: parseInt(e.target.value) / 100 })}
                  style={{ flex:1, accentColor:"var(--app-primary)", cursor:"pointer", height:"20px", touchAction:"none" }}
                />
                <span style={{ fontSize:"11px", color:"#999", width:"40px", textAlign:"right" }}>{t.watermark.visible}</span>
              </div>
            </div>

            {/* Slider de tamaño */}
            <div style={{ background:"#f8f8f8", borderRadius:"10px", padding:"12px 14px", marginBottom:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                <span style={{ fontSize:"13px", color:"#333", fontWeight:"600" }}>{t.watermark.size}</span>
                <span style={{ fontSize:"13px", color:"var(--app-primary)", fontWeight:"700" }}>{watermarkSize}%</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"#999", width:"40px" }}>{t.watermark.small}</span>
                <input type="range" min="10" max="90" value={watermarkSize}
                  onInput={e => saveWatermark({ size: parseInt(e.target.value) })}
                  onChange={e => saveWatermark({ size: parseInt(e.target.value) })}
                  style={{ flex:1, accentColor:"var(--app-primary)", cursor:"pointer", height:"20px", touchAction:"none" }}
                />
                <span style={{ fontSize:"11px", color:"#999", width:"40px", textAlign:"right" }}>{t.watermark.large}</span>
              </div>
            </div>

            {/* Subir nueva imagen */}
            <label style={{
              display:"block", background:"var(--app-primary)", color:"#fff", padding:"12px", borderRadius:"10px",
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

      {/* Banner de anuncios - mostrado al iniciar sesión */}
      {showBanner && bannerActive && bannerImages.length > 0 && (() => {
        const extImages = bannerImages.length > 1
          ? [bannerImages[bannerImages.length - 1], ...bannerImages, bannerImages[0]]
          : bannerImages;
        const totalExt = extImages.length;
        const stripPos = bannerImages.length > 1 ? bannerStripPos : 0;

        const navigate = (dir) => {
          clearInterval(bannerIntervalRef.current);
          setBannerCanTransition(true);
          setBannerStripPos(p => p + dir);
          setBannerSlide(s => (s + dir + bannerImages.length) % bannerImages.length);
          bannerIntervalRef.current = setInterval(() => {
            setBannerStripPos(p => p + 1);
            setBannerSlide(s => (s + 1) % bannerImages.length);
          }, 8000);
        };

        const goTo = (i) => {
          clearInterval(bannerIntervalRef.current);
          setBannerCanTransition(true);
          setBannerStripPos(i + 1);
          setBannerSlide(i);
          bannerIntervalRef.current = setInterval(() => {
            setBannerStripPos(p => p + 1);
            setBannerSlide(s => (s + 1) % bannerImages.length);
          }, 8000);
        };

        return (
          <div style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.95)" }}>
            <style>{`
              @keyframes bannerProgress { from { width:0% } to { width:100% } }
            `}</style>

            {/* Barra de progreso */}
            {bannerImages.length > 1 && (
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:"rgba(255,255,255,0.08)", zIndex:3 }}>
                <div key={`prog-${bannerSlide}`} style={{ height:"100%", background:"#fff", animation:"bannerProgress 8s linear forwards" }} />
              </div>
            )}

            {/* Botón cerrar */}
            <button onClick={() => { setShowBanner(false); setBannerSlide(0); setBannerStripPos(1); setBannerCanTransition(true); clearInterval(bannerIntervalRef.current); }}
              style={{ position:"absolute", top:"18px", right:"18px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:"50%", width:"44px", height:"44px", color:"#fff", fontSize:"22px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:4 }}>×</button>

            {/* CARRETE: track full-screen */}
            <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
              {/* Strip que se desliza */}
              <div style={{
                display:"flex",
                height:"100%",
                transform:`translateX(calc(-${stripPos} * 100vw))`,
                transition: bannerCanTransition ? "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)" : "none",
                willChange:"transform",
              }}>
                {extImages.map((url, i) => (
                  <div key={i} style={{ width:"100vw", flexShrink:0, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 60px 120px 60px", boxSizing:"border-box" }}>
                    <img src={url} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:"16px", boxShadow:"0 24px 64px rgba(0,0,0,0.6)", userSelect:"none", pointerEvents:"none" }} />
                  </div>
                ))}
              </div>

              {/* Flechas */}
              {bannerImages.length > 1 && (
                <>
                  <button onClick={() => navigate(-1)} style={{ position:"absolute", left:"16px", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:"50%", width:"52px", height:"52px", color:"#fff", fontSize:"30px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>‹</button>
                  <button onClick={() => navigate(1)} style={{ position:"absolute", right:"16px", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:"50%", width:"52px", height:"52px", color:"#fff", fontSize:"30px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>›</button>
                </>
              )}
            </div>

            {/* Dots + contador — sobre el track */}
            {bannerImages.length > 1 && (
              <div style={{ position:"absolute", bottom:"28px", left:0, right:0, display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", zIndex:3 }}>
                <div style={{ display:"flex", gap:"8px" }}>
                  {bannerImages.map((_, i) => (
                    <div key={i} onClick={() => goTo(i)} style={{
                      width: i === bannerSlide ? "24px" : "8px", height:"8px",
                      borderRadius:"4px", cursor:"pointer", transition:"all 0.3s",
                      background: i === bannerSlide ? "#fff" : "rgba(255,255,255,0.35)",
                    }} />
                  ))}
                </div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"12px", letterSpacing:"1px" }}>{bannerSlide + 1} / {bannerImages.length}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal Nombre Marca */}
      {showBrandModal && isAdmin && (
        <div style={{ position:"fixed", inset:0, zIndex:9995, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"28px 24px", width:"100%", maxWidth:"420px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ textAlign:"center", marginBottom:"18px" }}>
              <div style={{ fontSize:"28px", marginBottom:"6px" }}>🏷️</div>
              <div style={{ color:"var(--app-primary)", fontSize:"17px", fontWeight:"700", fontFamily:"Georgia,serif" }}>{t.brand.title}</div>
            </div>

            {/* Preview en tiempo real */}
            <div style={{ background:"linear-gradient(135deg,var(--app-primary-dark),var(--app-primary))", borderRadius:"14px", padding:"22px", textAlign:"center", marginBottom:"20px" }}>
              <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"62px", height:"62px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", borderRadius:"16px", marginBottom:"10px", boxShadow:"0 4px 16px rgba(0,0,0,0.4)", border:"2px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
                {brandDraft.icon
                  ? <img src={brandDraft.icon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontSize:"26px" }}>🍽️</span>}
              </div>
              <div style={{ color:brandDraft.labelColor||"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"3px" }}>{brandDraft.label || "RECETARIO DIGITAL"}</div>
              <div style={{ color:brandDraft.nameColor||"#ffffff", fontSize:"20px", fontWeight:"700", fontFamily:"Georgia,serif", marginTop:"2px" }}>{brandDraft.name || "Don Telmo®"}</div>
              {brandDraft.tagline && <div style={{ color:brandDraft.taglineColor||"#8BAACC", fontSize:"12px", marginTop:"2px" }}>{brandDraft.tagline}</div>}
            </div>

            {/* Imagen del ícono */}
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"8px" }}>🖼️ ÍCONO / LOGO</label>
              <label style={{ display:"block", background:"var(--app-primary)", color:"#fff", padding:"11px", borderRadius:"10px", textAlign:"center", cursor:"pointer", fontWeight:"700", fontSize:"13px", marginBottom:"6px" }}>
                📤 Subir imagen
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Mostrar preview local inmediatamente
                  const reader = new FileReader();
                  reader.onload = ev => setBrandDraft(d => ({...d, icon: ev.target.result}));
                  reader.readAsDataURL(file);
                  // Subir a Supabase en segundo plano
                  try {
                    const { supabase } = await import("@/lib/supabase");
                    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                    const path = `brand/brand-icon.${ext}`;
                    await supabase.storage.from("recipe-images").remove([path]);
                    const { error } = await supabase.storage.from("recipe-images").upload(path, file, { upsert:true, cacheControl:"0" });
                    if (!error) {
                      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
                      const url = urlData.publicUrl + "?t=" + Date.now();
                      setBrandDraft(d => ({...d, icon: url}));
                    }
                  } catch { /* mantiene el preview local base64 */ }
                }} />
              </label>
              {brandDraft.icon && (
                <button onClick={() => setBrandDraft(d => ({...d, icon:null}))} style={{ width:"100%", background:"none", border:"1px solid #e0d8ce", borderRadius:"8px", padding:"8px", cursor:"pointer", fontSize:"12px", color:"#c0392b" }}>
                  🗑️ Eliminar imagen
                </button>
              )}
            </div>

            {/* Paleta de colores reutilizable */}
            {(() => {
              const ColorPalette = ({ value, onChange }) => (
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"8px" }}>
                  {BRAND_COLORS.map(c => (
                    <div key={c} onClick={() => onChange(c)} style={{
                      width:"24px", height:"24px", borderRadius:"50%", background:c,
                      cursor:"pointer", flexShrink:0,
                      boxShadow: value === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "0 1px 3px rgba(0,0,0,0.2)",
                      transform: value === c ? "scale(1.2)" : "scale(1)",
                      transition:"all 0.15s",
                      border: c === "#ffffff" ? "1px solid #ddd" : "none",
                    }} />
                  ))}
                </div>
              );
              return (
                <>
                  {/* Campo 1: etiqueta */}
                  <div style={{ marginBottom:"14px" }}>
                    <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#D4721A", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.labelField}</label>
                    <input type="text" value={brandDraft.label} onChange={e => setBrandDraft(d => ({...d, label: e.target.value}))} placeholder="RECETARIO DIGITAL"
                      style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} autoFocus />
                    <ColorPalette value={brandDraft.labelColor} onChange={c => setBrandDraft(d => ({...d, labelColor:c}))} />
                  </div>

                  {/* Campo 2: nombre principal */}
                  <div style={{ marginBottom:"14px" }}>
                    <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.nameField}</label>
                    <input type="text" value={brandDraft.name} onChange={e => setBrandDraft(d => ({...d, name: e.target.value}))} placeholder="Don Telmo®"
                      style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
                    <ColorPalette value={brandDraft.nameColor} onChange={c => setBrandDraft(d => ({...d, nameColor:c}))} />
                  </div>

                  {/* Campo 3: subtítulo */}
                  <div style={{ marginBottom:"20px" }}>
                    <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#888", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.taglineLabel}</label>
                    <input type="text" value={brandDraft.tagline} onChange={e => setBrandDraft(d => ({...d, tagline: e.target.value}))} placeholder="1958 — Company"
                      style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
                    <ColorPalette value={brandDraft.taglineColor} onChange={c => setBrandDraft(d => ({...d, taglineColor:c}))} />
                  </div>
                </>
              );
            })()}

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => { setBrandDraft({ label:brandLabel, name:brandName, tagline:companyTagline, icon:brandIcon, labelColor:brandLabelColor, nameColor:brandNameColor, taglineColor:brandTaglineColor }); setShowBrandModal(false); }} style={{ flex:1, background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
                {t.brand.cancel}
              </button>
              <button onClick={() => {
                setBrandLabel(brandDraft.label);
                setBrandName(brandDraft.name);
                setCompanyTagline(brandDraft.tagline);
                setBrandIcon(brandDraft.icon);
                setBrandLabelColor(brandDraft.labelColor);
                setBrandNameColor(brandDraft.nameColor);
                setBrandTaglineColor(brandDraft.taglineColor);
                localStorage.setItem("dontelmo:brandLabel", brandDraft.label);
                localStorage.setItem("dontelmo:brandName", brandDraft.name);
                localStorage.setItem("dontelmo:tagline", brandDraft.tagline);
                localStorage.setItem("dontelmo:brandLabelColor", brandDraft.labelColor);
                localStorage.setItem("dontelmo:brandNameColor", brandDraft.nameColor);
                localStorage.setItem("dontelmo:brandTaglineColor", brandDraft.taglineColor);
                if (brandDraft.icon) localStorage.setItem("dontelmo:brandIcon", brandDraft.icon);
                else localStorage.removeItem("dontelmo:brandIcon");
                setShowBrandModal(false);
              }} style={{ flex:1, background:"var(--app-primary)", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
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
            <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"8px" }}>
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

      {/* Modal de configuración del banner */}
      {showBannerConfig && isAdmin && (
        <div style={{ position:"fixed", inset:0, zIndex:9995, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", width:"100%", maxWidth:"480px", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div>
                <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>DON TELMO® RECETARIO</div>
                <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700", marginTop:"3px" }}>📢 Banner de Anuncios</div>
              </div>
              <button onClick={() => setShowBannerConfig(false)} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px" }}>×</button>
            </div>

            <div style={{ overflowY:"auto", flex:1, padding:"20px" }}>
              {/* Toggle publicar */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#F7F3EE", borderRadius:"14px", padding:"16px 18px", marginBottom:"20px" }}>
                <div>
                  <div style={{ fontWeight:"700", fontSize:"14px", color:"var(--app-primary)" }}>Publicar banner</div>
                  <div style={{ fontSize:"12px", color:"#888", marginTop:"2px" }}>Los usuarios verán el banner al iniciar sesión</div>
                </div>
                <div onClick={() => setBannerActive(v => !v)} style={{
                  width:"51px", height:"31px", borderRadius:"16px", cursor:"pointer", transition:"all 0.3s",
                  background: bannerActive ? "#34c759" : "#e0e0e0", position:"relative", flexShrink:0,
                }}>
                  <div style={{
                    position:"absolute", top:"2px", width:"27px", height:"27px", borderRadius:"50%",
                    background:"#fff", boxShadow:"0 2px 4px rgba(0,0,0,0.2)", transition:"all 0.3s",
                    left: bannerActive ? "22px" : "2px",
                  }} />
                </div>
              </div>

              {/* Upload images */}
              <div style={{ marginBottom:"16px" }}>
                {/* Header con contador */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <div style={{ fontSize:"12px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1px" }}>IMÁGENES DEL BANNER</div>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} style={{
                        width:"28px", height:"28px", borderRadius:"8px", fontSize:"11px", fontWeight:"700",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: n <= bannerImages.length ? "var(--app-primary)" : "#F0ECE6",
                        color: n <= bannerImages.length ? "#fff" : "#bbb",
                        transition:"all 0.2s",
                      }}>{n}</div>
                    ))}
                  </div>
                </div>

                {/* Contador de texto */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <div style={{ fontSize:"12px", color:"#888" }}>
                    {bannerImages.length === 0
                      ? "Sin imágenes aún"
                      : `${bannerImages.length} de 5 imagen${bannerImages.length !== 1 ? "es" : ""} subida${bannerImages.length !== 1 ? "s" : ""}`}
                  </div>
                  {bannerImages.length >= 5 && (
                    <div style={{ fontSize:"11px", color:"#e74c3c", fontWeight:"700" }}>Límite alcanzado</div>
                  )}
                </div>

                {/* Botón subir */}
                {bannerImages.length < 5 && (
                  <label style={{ display:"block", background: bannerUploading ? "#ccc" : "var(--app-primary)", color:"#fff", padding:"12px", borderRadius:"10px", textAlign:"center", cursor: bannerUploading ? "not-allowed" : "pointer", fontWeight:"700", fontSize:"14px", marginBottom:"12px" }}>
                    {bannerUploading ? "⏳ Subiendo..." : `📤 Agregar imagen (${5 - bannerImages.length} disponible${5 - bannerImages.length !== 1 ? "s" : ""})`}
                    <input type="file" accept="image/*" multiple style={{ display:"none" }} disabled={bannerUploading || bannerImages.length >= 5} onChange={async (e) => {
                      const files = Array.from(e.target.files || []).slice(0, 5 - bannerImages.length);
                      if (!files.length) return;
                      setBannerUploading(true);
                      const newUrls = [];
                      for (const file of files) {
                        const localUrl = await new Promise(resolve => {
                          const r = new FileReader();
                          r.onload = ev => resolve(ev.target.result);
                          r.readAsDataURL(file);
                        });
                        newUrls.push(localUrl);
                        try {
                          const { supabase } = await import("@/lib/supabase");
                          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
                          const path = `banner/img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                          const { error } = await supabase.storage.from("recipe-images").upload(path, file, { upsert:false, cacheControl:"0" });
                          if (!error) {
                            const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
                            newUrls[newUrls.length - 1] = urlData.publicUrl;
                          }
                        } catch {}
                      }
                      setBannerImages(prev => [...prev, ...newUrls]);
                      setBannerUploading(false);
                    }} />
                  </label>
                )}

                {/* Grid miniaturas */}
                {bannerImages.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"28px 20px", color:"#bbb", fontSize:"13px", background:"#F7F3EE", borderRadius:"12px", border:"2px dashed #E0D8CE" }}>
                    <div style={{ fontSize:"28px", marginBottom:"8px" }}>🖼️</div>
                    Sube hasta 5 imágenes para el banner
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:"6px" }}>
                    {bannerImages.map((url, i) => (
                      <div key={i} style={{ position:"relative", borderRadius:"8px", overflow:"hidden", width:"72px", height:"72px", flexShrink:0, background:"#000", boxShadow:"0 2px 6px rgba(0,0,0,0.2)" }}>
                        <img src={url} alt={`Banner ${i+1}`} style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.92 }} />
                        <div style={{ position:"absolute", bottom:"3px", left:"3px", background:"var(--app-primary)", color:"#fff", fontSize:"9px", fontWeight:"700", padding:"1px 5px", borderRadius:"5px" }}>{i + 1}</div>
                        <button onClick={() => setBannerImages(prev => prev.filter((_,idx) => idx !== i))}
                          style={{ position:"absolute", top:"2px", right:"2px", background:"rgba(231,76,60,0.9)", border:"none", borderRadius:"50%", width:"20px", height:"20px", color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>×</button>
                      </div>
                    ))}
                    {Array.from({ length: 5 - bannerImages.length }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ borderRadius:"8px", width:"72px", height:"72px", flexShrink:0, background:"#F7F3EE", border:"2px dashed #E0D8CE", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:"18px", color:"#ddd" }}>+</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview button */}
              {bannerImages.length > 0 && (
                <button onClick={() => { setShowBannerConfig(false); setBannerSlide(0); setShowBanner(true); }}
                  style={{ width:"100%", background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"11px", cursor:"pointer", fontWeight:"600", fontSize:"13px", color:"var(--app-primary)", marginBottom:"10px" }}>
                  👁️ Vista previa del banner
                </button>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:"14px 20px", borderTop:"1px solid #F0ECE6", display:"flex", gap:"10px", flexShrink:0 }}>
              <button onClick={() => setShowBannerConfig(false)} style={{ flex:1, background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
                Cancelar
              </button>
              <button onClick={async () => {
                await saveBannerConfig({ active: bannerActive, images: bannerImages });
                setShowBannerConfig(false);
              }} style={{ flex:2, background:"var(--app-primary)", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS-style theme picker modal */}
      {showThemeModal && (
        <div style={{ position:"fixed", inset:0, zIndex:9996, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(20px)", display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0" }}>
          <div style={{ background:"rgba(28,28,30,0.95)", borderRadius:"28px 28px 0 0", width:"100%", maxWidth:"480px", padding:"12px 0 40px", boxShadow:"0 -20px 60px rgba(0,0,0,0.5)" }}>
            {/* Handle */}
            <div style={{ width:"36px", height:"4px", background:"rgba(255,255,255,0.3)", borderRadius:"2px", margin:"0 auto 20px" }} />
            <div style={{ color:"#fff", fontSize:"17px", fontWeight:"700", textAlign:"center", marginBottom:"6px", letterSpacing:"0.3px" }}>Tema de Color</div>
            <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"13px", textAlign:"center", marginBottom:"24px" }}>Elige el color principal de la app</div>
            {/* Grid de temas */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", padding:"0 24px", marginBottom:"24px" }}>
              {THEMES.map(theme => (
                <div key={theme.id} onClick={() => setTheme(theme.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                  <div style={{
                    width:"64px", height:"64px", borderRadius:"20px",
                    background:`linear-gradient(135deg, ${theme.primary}, ${theme.dark})`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow: themeId === theme.id ? `0 0 0 3px #fff, 0 0 0 5px ${theme.primary}` : "0 4px 12px rgba(0,0,0,0.4)",
                    transition:"all 0.2s",
                    transform: themeId === theme.id ? "scale(1.08)" : "scale(1)",
                  }}>
                    {themeId === theme.id && <div style={{ color:"#fff", fontSize:"22px", fontWeight:"700" }}>✓</div>}
                  </div>
                  <span style={{ color: themeId === theme.id ? "#fff" : "rgba(255,255,255,0.6)", fontSize:"12px", fontWeight: themeId === theme.id ? "700" : "400", transition:"all 0.2s" }}>{theme.label}</span>
                </div>
              ))}
            </div>
            <div style={{ padding:"0 24px" }}>
              <button onClick={() => setShowThemeModal(false)} style={{ width:"100%", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"14px", padding:"14px", color:"#fff", fontSize:"15px", fontWeight:"600", cursor:"pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmModal && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"400px", textAlign:"center", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize:"48px", marginBottom:"16px" }}>⚠️</div>
            <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"8px" }}>
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
      {/* Modal Perfil */}
      {showProfileModal && isAdmin && (
        <div style={{ position:"fixed", inset:0, zIndex:9996, background:"rgba(10,15,25,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#fff", borderRadius:"20px", padding:"28px 24px", width:"100%", maxWidth:"400px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"26px" }}>👤</span>
                <span style={{ fontWeight:"700", color:"var(--app-primary)", fontSize:"17px", fontFamily:"Georgia,serif" }}>{t.profile.title}</span>
              </div>
              <button onClick={() => { setShowProfileModal(false); setProfileSaved(false); }} style={{ background:"rgba(0,0,0,0.08)", border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>×</button>
            </div>

            {/* Info */}
            <div style={{ background:"#f0f7ff", border:"1px solid #c8dff5", borderRadius:"10px", padding:"10px 14px", marginBottom:"18px", fontSize:"12px", color:"#2c5f8a", display:"flex", gap:"8px", alignItems:"flex-start" }}>
              <span>ℹ️</span><span>{t.profile.info}</span>
            </div>

            {/* Nombre */}
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.profile.nameLabel}</label>
              <input value={profileDraft.name} onChange={e => setProfileDraft(d => ({...d, name: e.target.value}))}
                placeholder={t.profile.namePlaceholder}
                style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
            </div>

            {/* Email */}
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.profile.emailLabel}</label>
              <input type="email" value={profileDraft.email} onChange={e => setProfileDraft(d => ({...d, email: e.target.value}))}
                placeholder={t.profile.emailPlaceholder}
                style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
            </div>

            {/* Teléfono */}
            <div style={{ marginBottom:"20px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.profile.phoneLabel}</label>
              <input value={profileDraft.phone} onChange={e => setProfileDraft(d => ({...d, phone: e.target.value}))}
                placeholder={t.profile.phonePlaceholder}
                style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
            </div>

            {profileSaved && <div style={{ color:"#27ae60", fontWeight:"700", textAlign:"center", marginBottom:"12px", fontSize:"14px" }}>{t.profile.saved}</div>}

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => { setShowProfileModal(false); setProfileSaved(false); }}
                style={{ flex:1, padding:"12px", background:"#F0ECE6", border:"none", borderRadius:"10px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
                {t.profile.cancel}
              </button>
              <button onClick={async () => {
                  const saved = await saveProfileConfig(profileDraft);
                  if (saved) { setProfileData(profileDraft); setProfileSaved(true); setTimeout(() => { setProfileSaved(false); setShowProfileModal(false); }, 1200); }
                }}
                style={{ flex:2, padding:"12px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"10px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
                {t.profile.save}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
