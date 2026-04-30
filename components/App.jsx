"use client";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Image from "next/image"; // next/image: WebP automático + lazy loading
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { getRecipes, upsertRecipe, insertRecipe, deleteRecipe as deleteRecipeDb, getUsers, saveUsers as saveUsersDb, deleteImage, logActivity, getCategories, upsertCategory, deleteCategory as deleteCategoryDb, saveWatermarkConfig, loadWatermarkConfig, loadBannerConfig, loadProfileConfig, saveAppConfig, loadAppConfig } from "@/lib/storage";
import { DEFAULT_PROFILE_HASH, isLockedOut, getLockoutSecondsLeft, registerFailedAttempt, resetLoginAttempts, getLoginAttempts, touchActivity, isSessionExpired, getSessionMsLeft } from "@/lib/security";
import { CATEGORIES, INITIAL_USERS } from "@/lib/constants";
import { exportToExcel } from "@/lib/exportExcel";
import { exportTemplate } from "@/lib/exportTemplate";
import dynamic from "next/dynamic";
// ── Core — siempre en el bundle inicial ──────────────────────────
import { RecipeDetail } from "@/components/RecipeDetail";
import { RecipeForm } from "@/components/RecipeForm";
import { GlobalWatermark } from "@/components/Watermark";
import { LoginScreen } from "@/components/LoginScreen";
import { BannerCarousel } from "@/components/BannerCarousel";
import { ConfirmModal } from "@/components/ConfirmModal";
// ── Admin / ocasionales — lazy loaded (no bloquean bundle inicial) ─
const UsersPanel       = dynamic(() => import("@/components/UsersPanel").then(m => ({ default: m.UsersPanel })), { ssr: false });
const ActivityReport   = dynamic(() => import("@/components/ActivityReport").then(m => ({ default: m.ActivityReport })), { ssr: false });
const ProgressReport   = dynamic(() => import("@/components/ProgressReport").then(m => ({ default: m.ProgressReport })), { ssr: false });
const CategoryModal    = dynamic(() => import("@/components/CategoryModal").then(m => ({ default: m.CategoryModal })), { ssr: false });
const WatermarkModal   = dynamic(() => import("@/components/WatermarkModal").then(m => ({ default: m.WatermarkModal })), { ssr: false });
const BrandModal       = dynamic(() => import("@/components/BrandModal").then(m => ({ default: m.BrandModal })), { ssr: false });
const BannerConfigModal= dynamic(() => import("@/components/BannerConfigModal").then(m => ({ default: m.BannerConfigModal })), { ssr: false });
const ImportExcelModal = dynamic(() => import("@/components/ImportExcelModal").then(m => ({ default: m.ImportExcelModal })), { ssr: false });
const ProfileGuardModal= dynamic(() => import("@/components/ProfileGuardModal").then(m => ({ default: m.ProfileGuardModal })), { ssr: false });
const ProfileModal     = dynamic(() => import("@/components/ProfileModal").then(m => ({ default: m.ProfileModal })), { ssr: false });
const LangModal        = dynamic(() => import("@/components/LangModal").then(m => ({ default: m.LangModal })), { ssr: false });
const ThemeModal       = dynamic(() => import("@/components/ThemeModal").then(m => ({ default: m.ThemeModal })), { ssr: false });
const BiometricPrompt  = dynamic(() => import("@/components/BiometricPrompt").then(m => ({ default: m.BiometricPrompt })), { ssr: false });
const PizzaBuilderModal= dynamic(() => import("@/components/PizzaBuilderModal").then(m => ({ default: m.PizzaBuilderModal })), { ssr: false });
const DocumentsPanel   = dynamic(() => import("@/components/DocumentsPanel").then(m => ({ default: m.DocumentsPanel })), { ssr: false });
const SuppliesPanel    = dynamic(() => import("@/components/SuppliesPanel").then(m => ({ default: m.SuppliesPanel })), { ssr: false });
const CostingPanel     = dynamic(() => import("@/components/CostingPanel").then(m => ({ default: m.CostingPanel })), { ssr: false });
// ── Inventario y Compras ─────────────────────────────────────────
const ProveedoresPanel = dynamic(() => import("@/components/ProveedoresPanel").then(m => ({ default: m.ProveedoresPanel })), { ssr: false });
const ComprasPanel     = dynamic(() => import("@/components/ComprasPanel").then(m => ({ default: m.ComprasPanel })), { ssr: false });
const InventarioPanel  = dynamic(() => import("@/components/InventarioPanel").then(m => ({ default: m.InventarioPanel })), { ssr: false });
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLang, LangProvider } from "@/lib/LangContext";
import { LANGUAGES } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

export default function App() {
  const isMobile = useIsMobile();
  const { online, syncing, pendingCount } = useOnlineStatus();
  const { lang, setLang, t, themeId, setTheme } = useLang();
  const { isSupported: biometricSupported, hasCredential: hasBiometric, register: registerBiometric, authenticate: authBiometric } = useWebAuthn();
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState("all");
  const [search, setSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState(""); // debounced — solo para el filtrado
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

  const [showLangModal, setShowLangModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSupplies, setShowSupplies] = useState(false);
  const [showCosting, setShowCosting] = useState(false);
  // Inventario y Compras
  const [showProveedores, setShowProveedores] = useState(false);
  const [showCompras, setShowCompras] = useState(false);
  const [showInventario, setShowInventario] = useState(false);
  const [showBannerConfig, setShowBannerConfig] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);  // { recipes, fileName }
  const [importLoading, setImportLoading] = useState(false);
  const [importDone, setImportDone] = useState(false);
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
  const [profileHash, setProfileHash] = useState(DEFAULT_PROFILE_HASH);
  const [profileNewPass, setProfileNewPass] = useState("");
  const [profileNewPassConfirm, setProfileNewPassConfirm] = useState("");

  // Guard de acceso al perfil
  const [showProfileGuard, setShowProfileGuard] = useState(false);
  const [guardInput, setGuardInput] = useState("");
  const [guardError, setGuardError] = useState("");
  const [guardAttempts, setGuardAttempts] = useState(0);
  const [guardLocked, setGuardLocked] = useState(false);
  const guardLockRef = useRef(null);

  // Brute-force login
  const [loginLocked, setLoginLocked] = useState(false);
  const [loginLockSecs, setLoginLockSecs] = useState(0);
  const [loginAttemptsLeft, setLoginAttemptsLeft] = useState(5);
  const lockTimerRef = useRef(null);

  // Auto-lock inactividad
  const inactivityRef = useRef(null);

  const [showPizzaBuilder, setShowPizzaBuilder] = useState(false);
  const [categoryModal, setCategoryModal] = useState(null); // { mode: "create"|"edit", initial? }
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }
  const searchTimeoutRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const bannerIntervalRef = useRef(null);
  const bannerStripRef = useRef(null);
  const watermarkConfigRef = useRef({ logo: null, opacity: 0.07, size: 45 });

  const saveWatermark = useCallback((updates) => {
    const next = { ...watermarkConfigRef.current, ...updates };
    watermarkConfigRef.current = next;
    if (updates.logo !== undefined) setWatermarkLogo(updates.logo);
    if (updates.opacity !== undefined) setWatermarkOpacity(updates.opacity);
    if (updates.size !== undefined) setWatermarkSize(updates.size);
    // Batch: 1 write en vez de 3 separados
    localStorage.setItem("dontelmo:watermark", JSON.stringify({ logo: next.logo || "", opacity: next.opacity, size: next.size }));
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
    let t1, t2;
    if (bannerStripPos === total - 1) {
      // Esperar que termine la transición (500ms) + buffer holgado
      t1 = setTimeout(() => { setBannerCanTransition(false); setBannerStripPos(1); }, 650);
      t2 = setTimeout(() => setBannerCanTransition(true), 700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (bannerStripPos === 0) {
      t1 = setTimeout(() => { setBannerCanTransition(false); setBannerStripPos(bannerImages.length); }, 650);
      t2 = setTimeout(() => setBannerCanTransition(true), 700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [bannerStripPos, bannerImages.length]);

  // Resetear posición cuando el número de imágenes cambia (ej. al borrar)
  useEffect(() => {
    if (bannerImages.length === 1) {
      // Una sola imagen: posición 0, sin clones
      setBannerStripPos(0);
      setBannerSlide(0);
      setBannerCanTransition(false);
    } else if (bannerImages.length > 1) {
      // Varias imágenes: asegurar que stripPos esté en rango válido [1, n]
      setBannerStripPos(p => (p < 1 || p > bannerImages.length) ? 1 : p);
      setBannerSlide(s => Math.min(s, bannerImages.length - 1));
    }
  }, [bannerImages.length]);

  // Control directo del DOM — carrete estilo iOS (peek de slides adyacentes)
  useLayoutEffect(() => {
    const el = bannerStripRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const slideW = vw * 0.78;          // 78vw exacto — mismo valor que usa el CSS
    const offsetX = (vw - slideW) / 2; // margen para centrar el slide activo
    // Si hay ≤1 imagen no hay clones — la posición siempre es 0
    const pos = bannerImages.length > 1 ? bannerStripPos : 0;
    const px = offsetX - pos * slideW;
    if (!bannerCanTransition) {
      el.style.transition = "none";
      el.style.transform = `translateX(${px}px)`;
      void el.offsetWidth;
    } else {
      el.style.transition = "transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)";
      el.style.transform = `translateX(${px}px)`;
    }
  }, [bannerStripPos, bannerCanTransition, showBanner, bannerImages.length]);

  // Inyectar variables CSS del tema
  useEffect(() => {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const root = document.documentElement;
    root.style.setProperty("--app-primary", theme.primary);
    root.style.setProperty("--app-primary-dark", theme.dark);
    root.style.setProperty("--app-primary-light", theme.light);
    root.style.setProperty("--app-primary-rgb", theme.rgb);
  }, [themeId]);

  // Debounce del search: el input actualiza `search` de inmediato (para mostrar),
  // pero `filterSearch` se actualiza 300ms después (para no re-filtrar en cada tecla)
  useEffect(() => {
    const timer = setTimeout(() => setFilterSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      // ── Fetch paralelo de todas las fuentes de datos ────────────
      const [sr, su, cats, wmConfig, bannerCfg, profCfg, appCfg] = await Promise.all([
        getRecipes(),
        getUsers(),
        getCategories(),
        loadWatermarkConfig(signal),
        loadBannerConfig(signal),
        loadProfileConfig(signal),
        loadAppConfig(signal),
      ]);

      // Recetas
      if (sr) { setRecipes(sr); }
      else {
        // Lazy load seed data solo si la DB está vacía
        const { SEED_RECIPES } = await import("@/data/seed-recipes");
        setRecipes(SEED_RECIPES);
      }
      if (su && su.length > 0) setUsers(su);
      if (cats && cats.length > 0) setDbCategories(cats);

      // Cargar configuración watermark desde Supabase (sincronizado)
      if (wmConfig) {
        watermarkConfigRef.current = { logo: wmConfig.logo || null, opacity: wmConfig.opacity ?? 0.07, size: wmConfig.size ?? 45 };
        if (wmConfig.logo) setWatermarkLogo(wmConfig.logo);
        if (wmConfig.opacity != null) setWatermarkOpacity(wmConfig.opacity);
        if (wmConfig.size != null) setWatermarkSize(wmConfig.size);
        localStorage.setItem("dontelmo:watermark", JSON.stringify({ logo: wmConfig.logo || "", opacity: wmConfig.opacity ?? 0.07, size: wmConfig.size ?? 45 }));
      } else {
        // Fallback a localStorage (nuevo formato batched, con compat hacia atrás)
        const wmRaw = localStorage.getItem("dontelmo:watermark");
        if (wmRaw) {
          try {
            const wm = JSON.parse(wmRaw);
            if (wm.logo) setWatermarkLogo(wm.logo);
            if (wm.opacity != null) setWatermarkOpacity(wm.opacity);
            if (wm.size != null) setWatermarkSize(wm.size);
          } catch {}
        } else {
          // Compat con claves antiguas (usuarios existentes)
          const oldUrl = localStorage.getItem("dontelmo:watermark_url");
          const oldOpacity = localStorage.getItem("dontelmo:watermark_opacity");
          const oldSize = localStorage.getItem("dontelmo:watermark_size");
          if (oldUrl) setWatermarkLogo(oldUrl);
          if (oldOpacity) setWatermarkOpacity(parseFloat(oldOpacity));
          if (oldSize) setWatermarkSize(parseInt(oldSize));
        }
      }
      // Leer brand desde localStorage (nuevo formato batched, con compat hacia atrás)
      let savedLabel = null, savedName = null, savedTagline = null, savedIcon = null;
      let savedLabelColor = null, savedNameColor = null, savedTaglineColor = null;
      const brandRaw = localStorage.getItem("dontelmo:brand");
      if (brandRaw) {
        try {
          const b = JSON.parse(brandRaw);
          savedLabel = b.label ?? null; savedName = b.name ?? null; savedTagline = b.tagline ?? null;
          savedIcon = b.icon || null; savedLabelColor = b.labelColor || null;
          savedNameColor = b.nameColor || null; savedTaglineColor = b.taglineColor || null;
        } catch {}
      } else {
        // Compat con claves antiguas
        savedLabel = localStorage.getItem("dontelmo:brandLabel");
        savedName = localStorage.getItem("dontelmo:brandName");
        savedTagline = localStorage.getItem("dontelmo:tagline");
        savedIcon = localStorage.getItem("dontelmo:brandIcon");
        savedLabelColor = localStorage.getItem("dontelmo:brandLabelColor");
        savedNameColor = localStorage.getItem("dontelmo:brandNameColor");
        savedTaglineColor = localStorage.getItem("dontelmo:brandTaglineColor");
      }
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

      // Banner (ya cargado en paralelo)
      if (bannerCfg) {
        setBannerActive(bannerCfg.active ?? false);
        setBannerImages(bannerCfg.images ?? []);
      }
      // Perfil (ya cargado en paralelo)
      if (profCfg) {
        setProfileData(profCfg);
        setProfileDraft(profCfg);
        if (profCfg.profileHash) setProfileHash(profCfg.profileHash);
      }
      // Cargar marca desde Supabase (ya cargado en paralelo)
      if (appCfg) {
        if (appCfg.brand) {
          const b = appCfg.brand;
          // Aplicar solo los campos que existen en el config de Supabase
          if (b.label  != null) setBrandLabel(b.label);
          if (b.name   != null) setBrandName(b.name);
          if (b.tagline!= null) setCompanyTagline(b.tagline);
          if (b.icon)           setBrandIcon(b.icon);
          if (b.labelColor)     setBrandLabelColor(b.labelColor);
          if (b.nameColor)      setBrandNameColor(b.nameColor);
          if (b.taglineColor)   setBrandTaglineColor(b.taglineColor);
          // 1 write batched en vez de 7 separados
          localStorage.setItem("dontelmo:brand", JSON.stringify({ label: b.label, name: b.name, tagline: b.tagline, icon: b.icon || null, labelColor: b.labelColor, nameColor: b.nameColor, taglineColor: b.taglineColor }));
          // Fusionar con los valores de localStorage ya cargados arriba —
          // si Supabase no tiene el campo (ej. solo trae el ícono), se mantiene
          // lo que ya se leyó de localStorage en el draft.
          setBrandDraft(prev => ({
            ...prev,
            ...(b.label      != null ? { label:       b.label }       : {}),
            ...(b.name       != null ? { name:        b.name }        : {}),
            ...(b.tagline    != null ? { tagline:     b.tagline }     : {}),
            ...(b.icon             ? { icon:        b.icon }        : {}),
            ...(b.labelColor       ? { labelColor:  b.labelColor }  : {}),
            ...(b.nameColor        ? { nameColor:   b.nameColor }   : {}),
            ...(b.taglineColor     ? { taglineColor:b.taglineColor } : {}),
          }));
        }
      }
      setLoading(false);
    }
    load();
    return () => controller.abort(); // cancelar fetches si el componente se desmonta
  }, []);

  // ── Brute-force: inicializar estado si ya hay bloqueo activo ─────
  useEffect(() => {
    if (isLockedOut()) {
      setLoginLocked(true);
      setLoginLockSecs(getLockoutSecondsLeft());
      lockTimerRef.current = setInterval(() => {
        const secs = getLockoutSecondsLeft();
        setLoginLockSecs(secs);
        if (secs <= 0) { clearInterval(lockTimerRef.current); setLoginLocked(false); }
      }, 1000);
    } else {
      setLoginAttemptsLeft(5 - getLoginAttempts());
    }
    return () => clearInterval(lockTimerRef.current);
  }, []);

  // ── Auto-lock por inactividad ────────────────────────────────────
  useEffect(() => {
    if (screen !== "app") return;
    const events = ["mousemove","keydown","touchstart","click","scroll"];
    // Debounce a 2s para no escribir en localStorage en cada mousemove
    let debounceTimer;
    const onActivity = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(touchActivity, 2000); };
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    touchActivity(); // marcar inicio de sesión

    // Smart timeout: se programa para disparar exactamente cuando expira la sesión
    // en vez de hacer polling cada 30s (ahorra CPU y batería)
    const scheduleCheck = () => {
      const msLeft = getSessionMsLeft();
      inactivityRef.current = setTimeout(() => {
        if (isSessionExpired()) {
          setCurrentUser(null);
          setScreen("login");
          setLoginForm({ username:"", password:"" });
          setSelectedRecipe(null);
        } else {
          scheduleCheck(); // la sesión fue tocada, reprogramar
        }
      }, Math.max(msLeft, 60_000)); // mínimo 60s para evitar loops ajustados
    };
    scheduleCheck();

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearTimeout(debounceTimer);
      clearTimeout(inactivityRef.current);
    };
  }, [screen]);

  const saveUsers = useCallback(async u => { setUsers(u); await saveUsersDb(u); }, []);

  const handleLogin = useCallback(() => {
    // Verificar bloqueo por intentos fallidos
    if (isLockedOut()) {
      setLoginLocked(true);
      setLoginLockSecs(getLockoutSecondsLeft());
      return;
    }
    const u = users.find(u => u.username.trim()===loginForm.username.trim() && u.password.trim()===loginForm.password.trim());
    if (!u) {
      const attempts = registerFailedAttempt();
      if (isLockedOut()) {
        setLoginLocked(true);
        setLoginLockSecs(getLockoutSecondsLeft());
        clearInterval(lockTimerRef.current);
        lockTimerRef.current = setInterval(() => {
          const secs = getLockoutSecondsLeft();
          setLoginLockSecs(secs);
          if (secs <= 0) { clearInterval(lockTimerRef.current); setLoginLocked(false); setLoginAttemptsLeft(5); }
        }, 1000);
        setLoginError("");
      } else {
        const left = 5 - getLoginAttempts();
        setLoginAttemptsLeft(left);
        setLoginError(t.login.error);
      }
      return;
    }
    resetLoginAttempts();
    setLoginAttemptsLeft(5);
    setCurrentUser(u); setScreen("app"); setLoginError("");
    logActivity(u.id, "login");
    setTimeout(() => setShowBanner(true), 300);
    if (isMobile && biometricSupported && !hasBiometric) {
      setTimeout(() => setShowBiometricPrompt(true), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, loginForm, isMobile, biometricSupported, hasBiometric, t]);

  const handleBiometricLogin = useCallback(async () => {
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
  }, [authBiometric]);

  const handleRegisterBiometric = useCallback(async () => {
    const ok = await registerBiometric(currentUser);
    setShowBiometricPrompt(false);
    if (!ok) alert("No se pudo registrar el acceso biométrico");
  }, [registerBiometric, currentUser]);

  const handleLogout = useCallback(() => { setCurrentUser(null); setScreen("login"); setLoginForm({username:"",password:""}); setSelectedRecipe(null); }, []);

  const selectCat = useCallback((catId) => {
    setSelectedCat(catId);
    setSearch("");
    setFilterSearch("");
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const openRecipe = useCallback((r) => {
    setSelectedRecipe(r);
    if (isMobile) setSidebarOpen(false);
    if (currentUser) logActivity(currentUser.id, "view_recipe", r.name, r.category);
  }, [isMobile, currentUser]);

  const handleCreate = useCallback(() => { setEditingRecipe(null); setShowForm(true); }, []);
  const handleEdit = useCallback(r => { setEditingRecipe(r); setShowForm(true); setSelectedRecipe(null); }, []);
  const handleSaveRecipe = useCallback(async (form) => {
    if (editingRecipe) {
      if (editingRecipe.image && editingRecipe.image !== form.image && editingRecipe.image.includes("supabase")) {
        await deleteImage(editingRecipe.image);
      }
      const updated = await upsertRecipe({ ...form, id: editingRecipe.id });
      if (updated) {
        setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? updated : r));
        setSelectedRecipe(updated);
      }
    } else {
      const created = await insertRecipe(form);
      if (created) setRecipes(prev => [...prev, created]);
    }
    setShowForm(false); setEditingRecipe(null);
  }, [editingRecipe]);
  const handleTogglePublish = useCallback(async (r) => {
    const updated = { ...r, published: !r.published };
    const saved = await upsertRecipe(updated);
    if (saved) {
      setRecipes(prev => prev.map(x => x.id === r.id ? { ...x, published: !r.published } : x));
      setSelectedRecipe(prev => prev ? { ...prev, published: !r.published } : null);
    }
  }, []);

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
          if (r.image && r.image.includes("supabase")) await deleteImage(r.image);
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
    if (!filterSearch) return visibleRecipes.filter(r => selectedCat === "all" || r.category === selectedCat);
    // Si hay búsqueda, buscar en TODAS las categorías y en múltiples campos
    const terms = filterSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return visibleRecipes.filter(r => {
      const searchable = [
        r.name, r.category, r.description || "", r.preparation || "",
        r.recommendations || "", r.salesPitch || "",
        ...(r.ingredients || [])
      ].join(" ").toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [visibleRecipes, selectedCat, filterSearch]);

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
      <LoginScreen
        loading={loading}
        brandIcon={brandIcon} brandLabel={brandLabel} brandName={brandName}
        brandLabelColor={brandLabelColor} brandNameColor={brandNameColor}
        companyTagline={companyTagline} brandTaglineColor={brandTaglineColor}
        loginForm={loginForm} setLoginForm={setLoginForm}
        handleLogin={handleLogin}
        loginLocked={loginLocked} loginLockSecs={loginLockSecs}
        loginError={loginError} loginAttemptsLeft={loginAttemptsLeft}
        t={t} isMobile={isMobile}
        hasBiometric={hasBiometric} biometricLoading={biometricLoading} handleBiometricLogin={handleBiometricLogin}
      />
    );
  }

  // ══ APP PRINCIPAL ════════════════════════════════════════════════
  const isAdmin = currentUser.role === "admin";

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Segoe UI',sans-serif", overflow:"hidden", background:"#F4F0EB" }}>
{!selectedRecipe && !showForm && !showUsers && !showReport && !showProgress && !showWatermarkUpload && !showLangModal && !categoryModal && !confirmModal && !showBiometricPrompt && !showPizzaBuilder && !showDocuments && !showSupplies && !showCosting && <GlobalWatermark username={currentUser?.name || ""} sede={currentUser?.sede || ""} customLogo={watermarkLogo} opacity={watermarkOpacity} size={watermarkSize} />}

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
                  boxShadow:"0 8px 32px rgba(0,0,0,0.4)", padding:"8px", zIndex:9999, minWidth:"220px",
                  border:"1px solid rgba(255,255,255,0.15)", maxHeight:"80vh", overflowY:"auto",
                }}>
                  <button onClick={()=>{setGuardInput("");setGuardError("");setGuardAttempts(0);setGuardLocked(false);setShowProfileGuard(true);setShowSettingsMenu(false);}} style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"none", border:"none", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    {t.settings.profile}
                  </button>
                  <button onClick={() => { setShowSettingsMenu(false); exportTemplate(recipes, brandName, dbCategories.map(c=>c.name)); }}
                    style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", color:"#fff", padding:"10px 14px", cursor:"pointer", fontSize:"14px", borderRadius:"8px", textAlign:"left", fontWeight:"700" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.22)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.12)"}>
                    📥 Descargar plantilla Excel
                  </button>
                  <button onClick={() => { setShowSettingsMenu(false); exportToExcel(recipes, brandName); }}
                    style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.75)", padding:"10px 14px", cursor:"pointer", fontSize:"13px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
                    📊 Exportar recetario (Excel)
                  </button>
                  <button onClick={() => { setShowSettingsMenu(false); setImportPreview(null); setImportDone(false); setShowImportModal(true); }}
                    style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.75)", padding:"10px 14px", cursor:"pointer", fontSize:"13px", borderRadius:"8px", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
                    📤 Importar desde Excel
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
            <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setShowDocuments(true)}
                style={{
                  width:"100%", display:"flex", alignItems:"center", gap:"10px",
                  background:"linear-gradient(135deg,rgba(212,114,26,0.25),rgba(212,114,26,0.10))",
                  border:"1.5px solid rgba(212,114,26,0.35)", borderRadius:"10px",
                  color:"#fff", padding:"10px 14px", cursor:"pointer",
                  fontSize:"13px", fontWeight:"700", fontFamily:"Georgia,serif",
                  transition:"all 0.2s", letterSpacing:"0.3px",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,114,26,0.35)"; e.currentTarget.style.borderColor = "rgba(212,114,26,0.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(212,114,26,0.25),rgba(212,114,26,0.10))"; e.currentTarget.style.borderColor = "rgba(212,114,26,0.35)"; }}
              >
                <span style={{ fontSize:"18px" }}>📚</span>
                Manuales
              </button>
              {isAdmin && (
                <div style={{ display:"flex", gap:"6px", marginTop:"6px" }}>
                  <button
                    onClick={() => setShowSupplies(true)}
                    style={{
                      flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                      background:"rgba(27,58,92,0.25)",
                      border:"1.5px solid rgba(27,58,92,0.35)", borderRadius:"10px",
                      color:"#fff", padding:"9px 10px", cursor:"pointer",
                      fontSize:"12px", fontWeight:"700", fontFamily:"Georgia,serif",
                      transition:"all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(27,58,92,0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(27,58,92,0.25)"; }}
                  >
                    <span style={{ fontSize:"14px" }}>📦</span>
                    Insumos
                  </button>
                  <button
                    onClick={() => setShowCosting(true)}
                    style={{
                      flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                      background:"rgba(34,197,94,0.15)",
                      border:"1.5px solid rgba(34,197,94,0.3)", borderRadius:"10px",
                      color:"#fff", padding:"9px 10px", cursor:"pointer",
                      fontSize:"12px", fontWeight:"700", fontFamily:"Georgia,serif",
                      transition:"all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.15)"; }}
                  >
                    <span style={{ fontSize:"14px" }}>💰</span>
                    Costeo
                  </button>
                </div>
              )}
            </div>
            {/* ── INVENTARIO Y COMPRAS ── */}
            {isAdmin && (
              <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ color:"#7C6AF5", fontSize:"9px", fontWeight:"700", letterSpacing:"2px", marginBottom:"6px" }}>
                  INVENTARIO Y COMPRAS
                </div>
                {[
                  { icon:"🏭", label:"Proveedores",  action:()=>setShowProveedores(true), ready:true  },
                  { icon:"📦", label:"Inventario",   action:()=>setShowInventario(true),  ready:true  },
                  { icon:"🛒", label:"Compras",      action:()=>setShowCompras(true),     ready:true  },
                  { icon:"📋", label:"Bajas",        action:null,                          ready:false },
                  { icon:"🔢", label:"Conteo físico",action:null,                          ready:false },
                  { icon:"📊", label:"Kardex",       action:null,                          ready:false },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action || undefined}
                    disabled={!item.ready}
                    style={{
                      width:"100%", textAlign:"left", display:"flex", alignItems:"center",
                      justifyContent:"space-between", gap:"8px",
                      background: item.ready ? "rgba(124,106,245,0.08)" : "transparent",
                      border:"none",
                      borderLeft:`3px solid ${item.ready ? "rgba(124,106,245,0.5)" : "transparent"}`,
                      color: item.ready ? "#c4bcff" : "#555",
                      padding:"8px 12px", cursor: item.ready ? "pointer" : "default",
                      fontSize:"12px", fontWeight:"500", transition:"all 0.15s",
                      marginBottom:"1px"
                    }}
                    onMouseEnter={e => { if(item.ready) e.currentTarget.style.background="rgba(124,106,245,0.18)"; }}
                    onMouseLeave={e => { if(item.ready) e.currentTarget.style.background="rgba(124,106,245,0.08)"; }}
                  >
                    <span>{item.icon} {item.label}</span>
                    {!item.ready && (
                      <span style={{ background:"rgba(255,255,255,0.06)", borderRadius:"8px",
                        padding:"1px 7px", fontSize:"9px", color:"#555", fontWeight:"700" }}>
                        PRONTO
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

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
            <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
              <h1 style={{ margin:0, color:"var(--app-primary)", fontFamily:"Georgia,serif", fontSize: isMobile?"18px":"21px", fontWeight:"700" }}>
                {allCategories.find(c=>c.id===selectedCat)?.icon} {allCategories.find(c=>c.id===selectedCat)?.label}
              </h1>
              {selectedCat?.toLowerCase().includes("pizza") && (
                <button
                  onClick={() => setShowPizzaBuilder(true)}
                  style={{ background:"linear-gradient(135deg,#c0392b,#e74c3c)", border:"none", borderRadius:"20px", color:"#fff", padding:"6px 16px", cursor:"pointer", fontFamily:"Georgia,serif", fontSize:"13px", fontWeight:"700", boxShadow:"0 3px 12px rgba(192,57,43,0.4)", letterSpacing:"0.5px", display:"flex", alignItems:"center", gap:"6px" }}
                >
                  🍕 Armar Pizza
                </button>
              )}
            </div>
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
                      ? <Image fill src={r.image} alt={r.name} style={{ objectFit:"cover" }} sizes="(max-width:768px) 50vw, 200px" />
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
      {showPizzaBuilder && (
        <Suspense fallback={null}>
          <PizzaBuilderModal
            pizzaRecipes={recipes.filter(r => r.category?.toLowerCase().includes("pizza"))}
            onClose={() => setShowPizzaBuilder(false)}
          />
        </Suspense>
      )}
      {selectedRecipe && !showForm && (
        <RecipeDetail recipe={selectedRecipe} currentUser={currentUser} onClose={()=>setSelectedRecipe(null)} onEdit={()=>handleEdit(selectedRecipe)} onDelete={()=>handleDelete(selectedRecipe)} onTogglePublish={()=>handleTogglePublish(selectedRecipe)} pizzaRecipes={recipes.filter(r=>r.category?.toLowerCase().includes("pizza"))} brandLabel={brandLabel} brandName={brandName} companyTagline={companyTagline} />
      )}
      {showForm && (
        <RecipeForm initial={editingRecipe} categories={allCategories} onSave={handleSaveRecipe} onCancel={()=>{setShowForm(false);setEditingRecipe(null);}} />
      )}
      <Suspense fallback={null}>
        {showUsers && isAdmin && (
          <UsersPanel users={users} onSave={saveUsers} onClose={()=>setShowUsers(false)} />
        )}
        {showReport && isAdmin && (
          <ActivityReport onClose={()=>setShowReport(false)} />
        )}
        {showProgress && isAdmin && (
          <ProgressReport recipes={recipes} onClose={()=>setShowProgress(false)} />
        )}
        {showDocuments && (
          <DocumentsPanel isAdmin={isAdmin} currentUser={currentUser} onClose={()=>setShowDocuments(false)} />
        )}
        {showSupplies && isAdmin && (
          <SuppliesPanel onClose={()=>setShowSupplies(false)} />
        )}
        {showCosting && isAdmin && (
          <CostingPanel recipes={recipes} onClose={()=>setShowCosting(false)} />
        )}
        {showProveedores && isAdmin && (
          <ProveedoresPanel onClose={()=>setShowProveedores(false)} />
        )}
        {showCompras && isAdmin && (
          <ComprasPanel onClose={()=>setShowCompras(false)} currentUser={currentUser} />
        )}
        {showInventario && isAdmin && (
          <InventarioPanel onClose={()=>setShowInventario(false)} />
        )}
      </Suspense>
      {categoryModal && isAdmin && (
        <CategoryModal
          mode={categoryModal.mode}
          initial={categoryModal.initial}
          onClose={() => setCategoryModal(null)}
          onSave={async (cat) => {
            if (cat.oldId && cat.oldId !== cat.id) {
              // Editar: renombrar categoría en todas las recetas
              const toUpdate = recipes.filter(r => r.category === cat.oldId);
              await Promise.all(toUpdate.map(r => upsertRecipe({ ...r, category: cat.id })));
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

      <LangModal show={showLangModal} onClose={() => setShowLangModal(false)} t={t} lang={lang} setLang={setLang} LANGUAGES={LANGUAGES} />

      <WatermarkModal
        show={showWatermarkUpload} isAdmin={isAdmin} onClose={() => setShowWatermarkUpload(false)}
        t={t} watermarkLogo={watermarkLogo} setWatermarkLogo={setWatermarkLogo}
        watermarkOpacity={watermarkOpacity} watermarkSize={watermarkSize} saveWatermark={saveWatermark}
      />

      {/* Banner de anuncios - mostrado al iniciar sesión */}
      {showBanner && bannerActive && bannerImages.length > 0 && (
        <BannerCarousel
          bannerImages={bannerImages} bannerSlide={bannerSlide} bannerStripPos={bannerStripPos}
          bannerStripRef={bannerStripRef} bannerCanTransition={bannerCanTransition} bannerIntervalRef={bannerIntervalRef}
          setBannerSlide={setBannerSlide} setBannerStripPos={setBannerStripPos}
          setBannerCanTransition={setBannerCanTransition} setShowBanner={setShowBanner}
        />
      )}

      <BrandModal
        show={showBrandModal} isAdmin={isAdmin} onClose={() => setShowBrandModal(false)} t={t}
        brandDraft={brandDraft} setBrandDraft={setBrandDraft}
        brandLabel={brandLabel} brandName={brandName} companyTagline={companyTagline}
        brandIcon={brandIcon} brandLabelColor={brandLabelColor} brandNameColor={brandNameColor} brandTaglineColor={brandTaglineColor}
        setBrandLabel={setBrandLabel} setBrandName={setBrandName} setCompanyTagline={setCompanyTagline}
        setBrandIcon={setBrandIcon} setBrandLabelColor={setBrandLabelColor} setBrandNameColor={setBrandNameColor} setBrandTaglineColor={setBrandTaglineColor}
        themeId={themeId}
      />

      <Suspense fallback={null}>
        <BiometricPrompt show={showBiometricPrompt} onClose={() => setShowBiometricPrompt(false)} onActivate={handleRegisterBiometric} />
        <ImportExcelModal
          show={showImportModal} isAdmin={isAdmin} onClose={() => setShowImportModal(false)}
          importDone={importDone} importPreview={importPreview} importLoading={importLoading}
          setImportPreview={setImportPreview} setImportLoading={setImportLoading} setImportDone={setImportDone}
          onRecipeAdded={saved => setRecipes(prev => [...prev, saved])}
        />
        <BannerConfigModal
          show={showBannerConfig} isAdmin={isAdmin} onClose={() => setShowBannerConfig(false)}
          bannerActive={bannerActive} setBannerActive={setBannerActive}
          bannerImages={bannerImages} setBannerImages={setBannerImages}
          bannerUploading={bannerUploading} setBannerUploading={setBannerUploading}
          setBannerSlide={setBannerSlide} setShowBanner={setShowBanner}
        />
        <ThemeModal
          show={showThemeModal} onClose={() => setShowThemeModal(false)}
          themeId={themeId} setTheme={setTheme} THEMES={THEMES} saveAppConfig={saveAppConfig}
          brandLabel={brandLabel} brandName={brandName} companyTagline={companyTagline}
          brandIcon={brandIcon} brandLabelColor={brandLabelColor} brandNameColor={brandNameColor} brandTaglineColor={brandTaglineColor}
        />
        <ProfileGuardModal
          show={showProfileGuard} isAdmin={isAdmin}
          onClose={() => { setShowProfileGuard(false); setGuardInput(""); setGuardError(""); }}
          profileHash={profileHash} profileData={profileData}
          setProfileDraft={setProfileDraft} setProfileNewPass={setProfileNewPass} setProfileNewPassConfirm={setProfileNewPassConfirm}
          guardInput={guardInput} setGuardInput={setGuardInput}
          guardError={guardError} setGuardError={setGuardError}
          guardAttempts={guardAttempts} setGuardAttempts={setGuardAttempts}
          guardLocked={guardLocked} setGuardLocked={setGuardLocked} guardLockRef={guardLockRef}
          onUnlock={() => { setShowProfileGuard(false); setShowProfileModal(true); }}
        />
        <ProfileModal
          show={showProfileModal} isAdmin={isAdmin} onClose={() => setShowProfileModal(false)} t={t}
          profileData={profileData} setProfileData={setProfileData}
          profileDraft={profileDraft} setProfileDraft={setProfileDraft}
          profileSaved={profileSaved} setProfileSaved={setProfileSaved}
          profileHash={profileHash} setProfileHash={setProfileHash}
          profileNewPass={profileNewPass} setProfileNewPass={setProfileNewPass}
          profileNewPassConfirm={profileNewPassConfirm} setProfileNewPassConfirm={setProfileNewPassConfirm}
        />
      </Suspense>

      <ConfirmModal confirmModal={confirmModal} onCancel={() => setConfirmModal(null)} />

    </div>
  );
}
