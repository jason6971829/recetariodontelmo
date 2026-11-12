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
const BiometricPrompt  = dynamic(() => import("@/components/BiometricPrompt").then(m => ({ default: m.BiometricPrompt })), { ssr: false });
const PizzaBuilderModal= dynamic(() => import("@/components/PizzaBuilderModal").then(m => ({ default: m.PizzaBuilderModal })), { ssr: false });
const DocumentsPanel   = dynamic(() => import("@/components/DocumentsPanel").then(m => ({ default: m.DocumentsPanel })), { ssr: false });
const SuppliesPanel    = dynamic(() => import("@/components/SuppliesPanel").then(m => ({ default: m.SuppliesPanel })), { ssr: false });
const CostingPanel     = dynamic(() => import("@/components/CostingPanel").then(m => ({ default: m.CostingPanel })), { ssr: false });
const Calculadora3D    = dynamic(() => import("@/components/Calculadora3D").then(m => ({ default: m.Calculadora3D })), { ssr: false });
const CalculadoraPan   = dynamic(() => import("@/components/CalculadoraPan").then(m => ({ default: m.CalculadoraPan })), { ssr: false });
const ChefAssistant    = dynamic(() => import("@/components/ChefAssistant").then(m => ({ default: m.ChefAssistant })), { ssr: false });
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLang, LangProvider } from "@/lib/LangContext";
import { LANGUAGES } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";
import { useViewport } from "@/hooks/useViewport";
import { saveSession, loadSession, clearSession, saveCtx, loadCtx } from "@/lib/session";
import { setZoom, ZOOM_OPTS } from "@/lib/viewZoom";
import { Icon, Monogram, catColor, initialOf, titleCase } from "@/components/dt/ui";

export default function App() {
  const isMobile = useIsMobile();
  const { online, syncing, pendingCount } = useOnlineStatus();
  const { lang, setLang, t, themeId } = useLang();
  const { isSupported: biometricSupported, hasCredential: hasBiometric, register: registerBiometric, authenticate: authBiometric } = useWebAuthn();
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState("all");
  const [selectedBodegaSub, setSelectedBodegaSub] = useState("all");
  const [search, setSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState(""); // debounced — solo para el filtrado
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  // Rediseño: menú deslizable / rail, buscador móvil, filtros y vista
  const vp = useViewport();
  const [navOpen, setNavOpen] = useState(false);
  const [railHover, setRailHover] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pubFilter, setPubFilter] = useState("Todas");
  const [listView, setListView] = useState(null);
  const [editCats, setEditCats] = useState(false);
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
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSupplies, setShowSupplies] = useState(false);
  const [showCosting, setShowCosting] = useState(false);
  const [showCalc3D, setShowCalc3D] = useState(false);
  const [showCalcPan, setShowCalcPan] = useState(false);
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

  // Sin internet: descargar de antemano la Calculadora de Masas (y el pesaje con báscula)
  // para que el service worker la guarde y funcione después sin datos ni wifi.
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    const t = setTimeout(() => {
      // todo lo que se abre aparte (paneles, calculadoras, pizza…) queda guardado para usarse sin internet
      [
        () => import("@/components/CalculadoraPan"), () => import("@/components/Calculadora3D"),
        () => import("@/components/PizzaBuilderModal"), () => import("@/components/CostingPanel"),
        () => import("@/components/SuppliesPanel"), () => import("@/components/DocumentsPanel"),
        () => import("@/components/UsersPanel"), () => import("@/components/ActivityReport"),
        () => import("@/components/ProgressReport"), () => import("@/components/CategoryModal"),
        () => import("@/components/WatermarkModal"), () => import("@/components/BrandModal"),
        () => import("@/components/BannerConfigModal"), () => import("@/components/ImportExcelModal"),
        () => import("@/components/ProfileGuardModal"), () => import("@/components/ProfileModal"),
        () => import("@/components/LangModal"), () => import("@/components/BiometricPrompt"),
        () => import("@/components/ChefAssistant"), () => import("@/data/seed-recipes"),
        () => import("jspdf"), () => import("xlsx"),
      ].reduce((p, f) => p.then(() => f().catch(() => {})), Promise.resolve());
    }, 4000);
    return () => clearTimeout(t);
  }, []);

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

  // Tema fijo Don Telmo (navy "ocean"). Se quito el selector de tema de color
  // para no quedar con los tonos de gabycontrol (morado).
  useEffect(() => {
    const theme = THEMES.find(t => t.id === "ocean") || THEMES[0];
    const root = document.documentElement;
    root.style.setProperty("--app-primary", theme.primary);
    root.style.setProperty("--app-primary-dark", theme.dark);
    root.style.setProperty("--app-primary-light", theme.light);
    root.style.setProperty("--app-primary-rgb", theme.rgb);
  }, []);

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
          clearSession();
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

  // ── Sesión que sobrevive a recargas + volver a la ventana donde estaba ──
  // (el Zebra/celular puede cerrar la pestaña al bloquearse: al volver se entra solo y se reabre lo que estaba)
  const ctxReadyRef = useRef(false);
  useEffect(() => {
    if (loading || currentUser) return;
    const ses = loadSession();
    if (!ses) return;
    if (isSessionExpired()) { clearSession(); return; }
    const u = users.find(x => String(x.id) === String(ses.id) && x.username === ses.username);
    if (u) { setCurrentUser(u); setScreen("app"); }
  }, [loading, users, currentUser]);
  useEffect(() => {
    if (screen !== "app" || ctxReadyRef.current) return;
    ctxReadyRef.current = true;
    const c = loadCtx();
    if (c?.modal === "calc") setShowCalcPan(true);
    else if (c?.modal === "recipe") {
      const r = recipes.find(x => String(x.id) === String(c.id));
      if (r) setSelectedRecipe(r);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  useEffect(() => {
    if (screen !== "app" || !ctxReadyRef.current) return;
    saveCtx(showCalcPan ? { modal: "calc" } : selectedRecipe ? { modal: "recipe", id: selectedRecipe.id } : null);
  }, [screen, showCalcPan, selectedRecipe]);

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
    saveSession(u);
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
      saveSession(user);
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

  const handleLogout = useCallback(() => { clearSession(); ctxReadyRef.current = false; setCurrentUser(null); setScreen("login"); setLoginForm({username:"",password:""}); setSelectedRecipe(null); }, []);

  const selectCat = useCallback((catId) => {
    setSelectedCat(catId);
    setSelectedBodegaSub("all");
    setSearch("");
    setFilterSearch("");
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Crear receta nueva de Bodega (preselecciona category + subcategory actual)
  const handleCreateBodega = useCallback(() => {
    const sub = (selectedBodegaSub && selectedBodegaSub !== "all" && selectedBodegaSub !== "Sin clasificar")
      ? selectedBodegaSub : "";
    setEditingRecipe({
      name:"", category:"RECETAS BODEGA", subcategory: sub,
      prepTime:"", cookTime:"", portions:"",
      ingredients:[], preparation:"", recommendations:"",
      image:null, video:"", description:"", salesPitch:"",
      published: true,
    });
    setShowForm(true);
  }, [selectedBodegaSub]);

  const openRecipe = useCallback((r) => {
    setSelectedRecipe(r);
    if (isMobile) setSidebarOpen(false);
    if (currentUser) logActivity(currentUser.id, "view_recipe", r.name, r.category);
  }, [isMobile, currentUser]);

  const handleCreate = useCallback(() => { setEditingRecipe(null); setShowForm(true); }, []);
  const handleEdit = useCallback(r => { setEditingRecipe(r); setShowForm(true); setSelectedRecipe(null); }, []);
  // Autosave: NO cierra el modal, solo persiste. Devuelve la receta guardada
  // para que el form pueda capturar el id en altas nuevas.
  const handleSaveRecipe = useCallback(async (form) => {
    const isUpdate = !!form.id;
    if (isUpdate && editingRecipe?.image && editingRecipe.image !== form.image && editingRecipe.image.includes("supabase")) {
      await deleteImage(editingRecipe.image);
    }
    const saved = isUpdate
      ? await upsertRecipe(form)
      : await insertRecipe(form);
    if (saved) {
      setRecipes(prev => {
        const exists = prev.some(r => r.id === saved.id);
        return exists ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved];
      });
      // Mantener editingRecipe sincronizado para que el proximo save sepa la imagen anterior
      setEditingRecipe(saved);
    }
    return saved;
  }, [editingRecipe]);

  const handleCloseRecipeForm = useCallback(() => {
    setShowForm(false);
    setEditingRecipe(null);
  }, []);
  const handleTogglePublish = useCallback(async (r) => {
    const updated = { ...r, published: !r.published };
    const saved = await upsertRecipe(updated);
    if (saved) {
      setRecipes(prev => prev.map(x => x.id === r.id ? { ...x, published: !r.published } : x));
      setSelectedRecipe(prev => prev ? { ...prev, published: !r.published } : null);
    }
  }, []);

  // Eliminar: solo admin, con doble filtro (aviso + clave de seguridad del Perfil)
  const handleDelete = (r) => {
    if (currentUser?.role !== "admin") return;
    setConfirmModal({
      title: "Eliminar receta",
      message: `¿Seguro que quieres eliminar «${r.name}»? Esta acción no se puede deshacer.`,
      details: [`Receta: ${r.name}`, `Categoría: ${r.category}`, `${(r.ingredients || []).length} ingredientes${r.image ? " y su foto" : ""}`],
      requireKey: true,
      confirmLabel: "Eliminar receta",
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
    if (currentUser?.role !== "admin") return;
    const catLabel = allCategories.find(c => c.id === catId)?.label || catId;
    const catRecipes = recipes.filter(r => r.category === catId);
    const n = catRecipes.length;
    setConfirmModal({
      title: "Eliminar categoría completa",
      message: n
        ? `¿Seguro que quieres eliminar la categoría «${catLabel}» y sus ${n} receta${n !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`
        : `¿Seguro que quieres eliminar la categoría «${catLabel}»? No tiene recetas.`,
      details: [`Categoría: ${catLabel}`, ...catRecipes.slice(0, 30).map(r => r.name), ...(n > 30 ? [`… y ${n - 30} más`] : [])],
      requireKey: true,
      confirmLabel: n ? `Eliminar categoría y ${n} receta${n !== 1 ? "s" : ""}` : "Eliminar categoría",
      onConfirm: async () => {
        for (const r of catRecipes) {
          if (r.image && r.image.includes("supabase")) await deleteImage(r.image);
          await deleteRecipeDb(r.id);
        }
        await deleteCategoryDb(catId);
        setRecipes(prev => prev.filter(r => r.category !== catId));
        setDbCategories(prev => prev.filter(c => c.id !== catId));
        setSelectedCat("all");
        setSelectedRecipe(null);
        setConfirmModal(null);
      }
    });
  };

  // Filtrado
  // Cocineros solo ven publicadas, admin ve todo.
  // RECETAS BODEGA es un MODULO APARTE: nunca se mezcla con las recetas de
  // menu. Solo se ve cuando selectedCat === "RECETAS BODEGA" y el user tiene
  // role="admin" o permissions.bodega === true.
  const isAdminUser = currentUser?.role === "admin";
  const canSeeBodega = isAdminUser || currentUser?.permissions?.bodega === true;
  const isBodegaView = selectedCat === "RECETAS BODEGA";
  const BODEGA_CAT = "RECETAS BODEGA";
  // Modulo "Por completar": recetas-borrador sin ingredientes (los stubs de barcode).
  const PENDING_CAT = "__PENDING__";
  const isPendingView = selectedCat === PENDING_CAT;
  const isEmptyRecipe = (r) => !Array.isArray(r.ingredients) || r.ingredients.length === 0;

  const recipesByPublish = useMemo(
    () => (isAdminUser ? recipes : recipes.filter(r => r.published)),
    [recipes, isAdminUser]
  );

  // Pool del grid: bodega / por-completar / menu segun la vista
  const visibleForView = useMemo(() => {
    if (isPendingView) {
      return isAdminUser ? recipes.filter(isEmptyRecipe) : [];
    }
    if (isBodegaView) {
      return canSeeBodega ? recipesByPublish.filter(r => r.category === BODEGA_CAT) : [];
    }
    return recipesByPublish.filter(r => r.category !== BODEGA_CAT);
  }, [recipes, recipesByPublish, isPendingView, isBodegaView, isAdminUser, canSeeBodega]);

  const toCompleteCount = useMemo(
    () => (isAdminUser ? recipes.filter(isEmptyRecipe).length : 0),
    [recipes, isAdminUser]
  );

  const filtered = useMemo(() => {
    const subFilter = (r) => {
      if (!isBodegaView || selectedBodegaSub === "all") return true;
      const s = (r.subcategory || "").trim() || "Sin clasificar";
      return s === selectedBodegaSub;
    };
    if (!filterSearch) {
      if (isPendingView) return visibleForView;
      if (isBodegaView) return visibleForView.filter(subFilter);
      return visibleForView.filter(r => selectedCat === "all" || r.category === selectedCat);
    }
    const terms = filterSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return visibleForView.filter(r => {
      if (!subFilter(r)) return false;
      const searchable = [
        r.name, r.category, r.subcategory || "", r.description || "", r.preparation || "",
        r.recommendations || "", r.salesPitch || "",
        ...(r.ingredients || [])
      ].join(" ").toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [visibleForView, isBodegaView, selectedCat, selectedBodegaSub, filterSearch]);

  // catCounts: solo categorias de menu (bodega va aparte)
  const catCounts = useMemo(() => {
    const counts = {};
    recipesByPublish
      .filter(r => r.category !== BODEGA_CAT)
      .forEach(r => { counts[r.category] = (counts[r.category]||0)+1; });
    return counts;
  }, [recipesByPublish]);

  const bodegaCount = useMemo(() => {
    if (!canSeeBodega) return 0;
    return recipesByPublish.filter(r => r.category === BODEGA_CAT).length;
  }, [recipesByPublish, canSeeBodega]);

  // Sub-categorias presentes en RECETAS BODEGA, con conteo. Para los chips dentro del modulo.
  const bodegaSubs = useMemo(() => {
    const counts = {};
    recipesByPublish
      .filter(r => r.category === BODEGA_CAT)
      .forEach(r => {
        const s = (r.subcategory || "").trim() || "Sin clasificar";
        counts[s] = (counts[s] || 0) + 1;
      });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]);
  }, [recipesByPublish]);
  const bodegaSubList = useMemo(() => bodegaSubs.map(([s]) => s).filter(s => s !== "Sin clasificar"), [bodegaSubs]);

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
    // RECETAS BODEGA es modulo aparte (boton dedicado arriba), no va en la lista
    return [...base, ...extraCats].filter(c => c.id !== BODEGA_CAT);
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

  // ── Rediseño: medidas según el ancho efectivo (innerWidth / zoom) ──
  const vpMobile = vp.mobile;
  const drawerMode = vp.w < 1024 || vp.touch;          // celular, tablet o iPad: menú deslizable
  const navExpanded = drawerMode ? navOpen : railHover; // computador: barra de 76 px que se expande al pasar el cursor
  const padX = vpMobile ? 16 : vp.w < 1024 ? 24 : 36;
  const showLabels = vp.w >= 760;
  const viewMode = listView ?? (vpMobile ? "list" : "grid");
  const shown = isAdmin && pubFilter !== "Todas"
    ? filtered.filter(r => (pubFilter === "Publicadas" ? r.published : !r.published))
    : filtered;
  const totalMenu = recipes.filter(r => r.category !== BODEGA_CAT).length;
  const catLabelOf = (id) => allCategories.find(c => c.id === id)?.label || id;
  const pickCat = (id) => { selectCat(id); setNavOpen(false); };
  const headTitle = isPendingView ? "Por completar" : isBodegaView ? "Recetas Bodega" : (selectedCat === "all" ? "Todas las recetas" : titleCase(catLabelOf(selectedCat)));
  const hdrBtn = (active) => ({ width: 44, height: 44, borderRadius: 12, border: 0, background: active ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", transition: "background .2s" });
  const navRow = (active) => ({ width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 12px", borderRadius: 12, border: 0, background: active ? "rgba(217,115,26,.22)" : "transparent", color: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "var(--dt-sans)", fontSize: 14, fontWeight: 600, transition: "background .15s" });
  const labelStyle = { opacity: navExpanded || drawerMode ? 1 : 0, transition: "opacity .2s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 };
  const badge = (bg, fg = "#fff") => ({ background: bg, color: fg, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 800, opacity: navExpanded || drawerMode ? 1 : 0, transition: "opacity .2s", flex: "none" });
  const settingsItem = { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 40, padding: "0 10px", border: 0, borderRadius: 10, background: "transparent", color: "#14213D", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "var(--dt-sans)" };
  const closeSettings = () => setShowSettingsMenu(false);
  const settingsGroups = isAdmin ? [
    { title: "CUENTA", items: [
      [Icon.user, "Perfil", () => { setGuardInput(""); setGuardError(""); setGuardAttempts(0); setGuardLocked(false); setShowProfileGuard(true); }],
      [Icon.users, "Gestión de usuarios", () => setShowUsers(true)],
      [Icon.globe, "Idioma", () => setShowLangModal(true)],
    ] },
    { title: "EXCEL", items: [
      [Icon.download, "Descargar plantilla", () => exportTemplate(recipes, brandName, dbCategories.map(c => c.name))],
      [Icon.sheet, "Exportar recetario", () => exportToExcel(recipes, brandName)],
      [Icon.upload, "Importar desde Excel", () => { setImportPreview(null); setImportDone(false); setShowImportModal(true); }],
    ] },
    { title: "RECETARIO", items: [
      [Icon.chart, "Estado del recetario", () => setShowProgress(true)],
      [Icon.activity, "Reporte de actividad", () => setShowReport(true)],
    ] },
    { title: "MARCA", items: [
      [Icon.drop, "Marca de agua", () => setShowWatermarkUpload(true)],
      [Icon.tag, "Nombre de marca", () => { setBrandDraft({ label: brandLabel, name: brandName, tagline: companyTagline, icon: brandIcon, labelColor: brandLabelColor, nameColor: brandNameColor, taglineColor: brandTaglineColor }); setShowBrandModal(true); }],
      [Icon.megaphone, "Banner de anuncios", () => setShowBannerConfig(true)],
    ] },
  ] : [
    { title: "CUENTA", items: [[Icon.globe, "Idioma", () => setShowLangModal(true)]] },
  ];

  return (
    <div className="dt-scope" style={{ height: "var(--app-height, 100vh)", display: "flex", flexDirection: "column", fontFamily: "var(--dt-sans)", color: "#14213D", overflow: "hidden", background: "#F6F3EE", position: "relative" }}>
{!selectedRecipe && !showForm && !showUsers && !showReport && !showProgress && !showWatermarkUpload && !showLangModal && !categoryModal && !confirmModal && !showBiometricPrompt && !showPizzaBuilder && !showDocuments && !showSupplies && !showCosting && !showCalc3D && <GlobalWatermark username={currentUser?.name || ""} sede={currentUser?.sede || ""} customLogo={watermarkLogo} opacity={watermarkOpacity} size={watermarkSize} />}

      {/* OFFLINE BANNER */}
      {!online && (
        <div style={{ background: "#C8423B", color: "#fff", textAlign: "center", padding: "8px 14px", fontSize: 13, fontWeight: 700, zIndex: 100, flexShrink: 0 }}>
          Sin conexión — Los cambios se guardarán en el equipo y se sincronizarán al reconectar
        </div>
      )}
      {online && syncing && (
        <div style={{ background: "#D9731A", color: "#fff", textAlign: "center", padding: "6px 14px", fontSize: 12, fontWeight: 700, zIndex: 100, flexShrink: 0 }}>
          Sincronizando {pendingCount} cambios pendientes…
        </div>
      )}

      {/* HEADER */}
      <header style={{ flexShrink: 0, minHeight: vpMobile ? 58 : 64, background: "rgba(14,34,64,.94)", backdropFilter: "saturate(1.4) blur(14px)", WebkitBackdropFilter: "saturate(1.4) blur(14px)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: vpMobile ? 6 : 10, padding: `${vpMobile ? 8 : 10}px ${padX}px`, zIndex: 50, color: "#fff" }}>
        {drawerMode && (
          <button aria-label="Menú" onClick={() => setNavOpen(true)} style={hdrBtn(false)}><Icon.menu /></button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: vpMobile ? "1 1 0" : "0 1 auto" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, overflow: "hidden", flex: "none", background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {brandIcon ? <img src={brandIcon} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "var(--dt-serif)", fontWeight: 700 }}>DT</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".24em", color: "#F0A35E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandLabel}</span>
            <span style={{ fontFamily: "var(--dt-serif)", fontSize: 17, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}{companyTagline && !vpMobile ? <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)", fontWeight: 500 }}> {companyTagline}</span> : null}</span>
          </div>
        </div>

        {/* Buscador: pill en tablet/computador; en celular se abre en una 2ª fila */}
        {(!vpMobile || searchOpen || search) && (
          <div style={{ position: "relative", flex: vpMobile ? "1 1 100%" : "1 1 260px", order: vpMobile ? 10 : 0, minWidth: 0, animation: vpMobile ? "dtDrop .22s both" : "none" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.55)", display: "flex" }}><Icon.search width={18} height={18} /></span>
            <input
              autoFocus={vpMobile && searchOpen && !search}
              style={{ width: "100%", height: 44, padding: "0 16px 0 42px", border: 0, borderRadius: 999, background: "rgba(255,255,255,.07)", color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box" }}
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setNavOpen(false);
                clearTimeout(searchTimeoutRef.current);
                if (e.target.value.length >= 3) {
                  const val = e.target.value;
                  searchTimeoutRef.current = setTimeout(() => { if (currentUser) logActivity(currentUser.id, "search", val); }, 1500);
                }
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: vpMobile ? 6 : 8, alignItems: "center", flex: "none", marginLeft: vpMobile ? 0 : "auto" }}>
          {vpMobile && (
            <button aria-label="Buscar" onClick={() => setSearchOpen(o => !o)} style={hdrBtn(searchOpen)}><Icon.search /></button>
          )}
          {isAdmin && (
            <button onClick={handleCreate} aria-label={t.newRecipe}
              style={{ height: 44, minWidth: 44, padding: showLabels ? "0 16px" : 0, borderRadius: 12, border: 0, background: "#D9731A", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}>
              <Icon.plus />{showLabels && "Nueva"}
            </button>
          )}
          <div style={{ position: "relative" }} ref={settingsMenuRef}>
            <button aria-label="Ajustes" onClick={() => setShowSettingsMenu(v => !v)} style={hdrBtn(showSettingsMenu)}><Icon.gear /></button>
            {showSettingsMenu && (
              <div style={{ position: vpMobile ? "fixed" : "absolute", top: vpMobile ? 64 : 52, right: vpMobile ? 12 : 0, width: "min(300px, calc(100vw - 24px))", maxHeight: "calc(var(--app-height, 100vh) - 90px)", overflowY: "auto", background: "#fff", borderRadius: 18, boxShadow: "0 30px 60px -20px rgba(14,34,64,.45), 0 0 0 1px rgba(14,34,64,.06)", padding: 10, zIndex: 9999, animation: "dtDrop .22s both", color: "#14213D" }}>
                <div style={{ padding: "6px 8px 10px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".2em", color: "#D9731A", marginBottom: 8 }}>TAMAÑO DE VISTA</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, background: "#F3EFE8", borderRadius: 12, padding: 4 }}>
                    {ZOOM_OPTS.map(([label, z], k) => {
                      const on = Math.abs(vp.zoom - z) < 0.04;
                      return (
                        <button key={label} onClick={() => setZoom(z)} style={{ height: 36, borderRadius: 9, border: 0, background: on ? "#fff" : "transparent", color: on ? "#0E2240" : "#8A847A", boxShadow: on ? "0 1px 3px rgba(14,34,64,.15)" : "none", fontWeight: 800, fontSize: [13, 15, 17][k], cursor: "pointer" }}>{label}</button>
                      );
                    })}
                  </div>
                </div>
                {settingsGroups.map(g => (
                  <div key={g.title} style={{ borderTop: "1px solid #F0ECE5", padding: "8px 0 4px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".2em", color: "#A39D92", padding: "4px 10px 6px" }}>{g.title}</div>
                    {g.items.map(([Ic, label, fn]) => (
                      <button key={label} className="dt-hov-light" onClick={() => { closeSettings(); fn(); }} style={settingsItem}>
                        <span style={{ color: "#D9731A", display: "flex" }}><Ic width={18} height={18} /></span>{label}
                      </button>
                    ))}
                  </div>
                ))}
                {vpMobile && (
                  <div style={{ borderTop: "1px solid #F0ECE5", paddingTop: 6 }}>
                    <button onClick={() => { closeSettings(); handleLogout(); }} style={{ ...settingsItem, color: "#C8423B", fontWeight: 700 }}>
                      <span style={{ display: "flex" }}><Icon.logout width={18} height={18} /></span>{t.logout}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {!vpMobile && (
            <button onClick={handleLogout} className="dt-logout" title={t.logout}
              style={{ height: 44, padding: showLabels ? "0 16px" : 0, minWidth: 44, borderRadius: 12, border: "1.5px solid rgba(255,255,255,.22)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon.logout width={18} height={18} />{showLabels && "Salir"}
            </button>
          )}
        </div>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Fondo del menú deslizable */}
        {drawerMode && navOpen && (
          <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(9,24,49,.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 59, animation: "dtFade .25s both" }} />
        )}

        {/* Espacio del rail en computador (el menú expandido se superpone, no empuja el contenido) */}
        {!drawerMode && <div style={{ width: 76, flex: "none" }} />}

        {/* MENÚ LATERAL */}
        <aside
          onMouseEnter={() => { if (!drawerMode) setRailHover(true); }}
          onMouseLeave={() => { if (!drawerMode) setRailHover(false); }}
          style={{
            position: drawerMode ? "fixed" : "absolute", top: 0, bottom: 0, left: 0,
            width: drawerMode ? "min(320px, 88vw)" : (navExpanded ? 288 : 76),
            transform: drawerMode && !navOpen ? "translateX(-105%)" : "none",
            transition: drawerMode ? "transform .35s cubic-bezier(.2,.8,.2,1)" : "width .32s cubic-bezier(.2,.8,.2,1)",
            background: "#0E2240", color: "#fff", zIndex: drawerMode ? 60 : 35, overflow: "hidden",
            boxShadow: navExpanded ? "24px 0 60px -20px rgba(9,24,49,.55)" : "none",
            paddingTop: drawerMode ? "env(safe-area-inset-top)" : 0, paddingBottom: "env(safe-area-inset-bottom)",
          }}>
          <div style={{ width: drawerMode ? "min(320px, 88vw)" : 288, height: "100%", overflowY: "auto", overflowX: "hidden", padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
            {drawerMode && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 2px 10px" }}>
                <span style={{ fontFamily: "var(--dt-serif)", fontSize: 20, fontWeight: 600 }}>Menú</span>
                <button aria-label="Cerrar menú" onClick={() => setNavOpen(false)} style={hdrBtn(false)}><Icon.close width={18} height={18} /></button>
              </div>
            )}
            {[
              [Icon.book, "Manuales", () => { setShowDocuments(true); setNavOpen(false); }],
              [Icon.printer3d, "Bambu A1", () => { setShowCalc3D(true); setNavOpen(false); }],
              [Icon.calc, "Calculadora de Masas", () => { setShowCalcPan(true); setNavOpen(false); }],
            ].map(([Ic, label, fn]) => (
              <button key={label} onClick={fn} className="dt-hov-dark" title={label} style={navRow(false)}>
                <span style={{ width: 30, display: "flex", justifyContent: "center", color: "#F0A35E", flex: "none" }}><Ic /></span>
                <span style={labelStyle}>{label}</span>
              </button>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "8px 4px" }} />
            {canSeeBodega && (
              <button onClick={() => pickCat(BODEGA_CAT)} className="dt-hov-dark" title="Recetas Bodega" style={navRow(isBodegaView)}>
                <span style={{ width: 30, display: "flex", justifyContent: "center", color: "#F0A35E", flex: "none" }}><Icon.box /></span>
                <span style={labelStyle}>Recetas Bodega</span>
                <span style={badge("rgba(255,255,255,.14)")}>{bodegaCount}</span>
              </button>
            )}
            {isAdmin && toCompleteCount > 0 && (
              <button onClick={() => pickCat(PENDING_CAT)} className="dt-hov-dark" title="Por completar" style={navRow(isPendingView)}>
                <span style={{ width: 30, display: "flex", justifyContent: "center", color: "#F0A35E", flex: "none" }}><Icon.pencil /></span>
                <span style={labelStyle}>Por completar</span>
                <span style={badge("#D9731A")}>{toCompleteCount}</span>
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px 6px", opacity: navExpanded || drawerMode ? 1 : 0, transition: "opacity .2s" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".22em", color: "rgba(255,255,255,.5)" }}>{String(t.categories || "CATEGORÍAS").toUpperCase()}</span>
              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); setEditCats(v => !v); }} style={{ height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.18)", background: editCats ? "#D9731A" : "transparent", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{editCats ? "Listo" : "Editar"}</button>
              )}
            </div>
            {allCategories.map(cat => {
              const count = cat.id === "all" ? totalMenu : (catCounts[cat.id] || 0);
              const active = selectedCat === cat.id;
              const isAll = cat.id === "all";
              const label = isAll ? "Todas las recetas" : titleCase(cat.label);
              return (
                <button key={cat.id} onClick={() => pickCat(cat.id)} className="dt-hov-dark" title={label} style={navRow(active)}>
                  {isAll
                    ? <span style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "#D9731A", color: "#fff", fontSize: 14 }}>★</span>
                    : <Monogram name={cat.label} />}
                  <span style={{ ...labelStyle, fontWeight: active ? 700 : 600 }}>{label}</span>
                  {editCats && isAdmin && !isAll ? (
                    <span style={{ display: "flex", gap: 4, flex: "none" }}>
                      <span role="button" title={`Editar categoría ${cat.label}`} onClick={(e) => { e.stopPropagation(); setCategoryModal({ mode: "edit", initial: cat }); }} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.pencil width={14} height={14} /></span>
                      {<span role="button" title={`Eliminar categoría ${cat.label}`} onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(200,66,59,.25)", color: "#FFB1AB", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.trash width={14} height={14} /></span>}
                    </span>
                  ) : (
                    <span style={{ ...badge("transparent", "rgba(255,255,255,.55)"), padding: 0, fontWeight: 700, fontSize: 12 }}>{count}</span>
                  )}
                </button>
              );
            })}
            {isAdmin && (navExpanded || drawerMode) && (
              <button onClick={() => { setCategoryModal({ mode: "create" }); setNavOpen(false); }} style={{ ...navRow(false), color: "#F0A35E", marginTop: 4, border: "1px dashed rgba(240,163,94,.5)" }}>
                <span style={{ width: 30, display: "flex", justifyContent: "center", flex: "none" }}><Icon.plus width={18} height={18} /></span>
                <span>{String(t.newCategory || "Nueva categoría").replace(/^\+\s*/, "")}</span>
              </button>
            )}
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main style={{ flex: 1, overflowY: "auto", padding: `${vpMobile ? 16 : 34}px ${padX}px calc(96px + env(safe-area-inset-bottom))`, minWidth: 0, position: "relative", zIndex: 1 }}>
          {/* Encabezado de la categoría */}
          <div style={{ display: "flex", flexDirection: "column", gap: vpMobile ? 10 : 14, marginBottom: vpMobile ? 14 : 22 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".28em", color: "#D9731A" }}>CATEGORÍA</span>
                <h1 style={{ margin: 0, fontFamily: "var(--dt-serif)", fontSize: vpMobile ? 28 : 46, fontWeight: 600, color: "#0E2240", lineHeight: 1.05 }}>{headTitle}</h1>
                <span style={{ fontSize: 14, color: "#8A847A" }}>{shown.length} {shown.length !== 1 ? t.recipes : t.recipe}{search && ` — “${search}”`}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {String(selectedCat || "").toLowerCase().includes("pizza") && (
                  <button onClick={() => setShowPizzaBuilder(true)} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: 0, background: "#C8423B", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Icon.pizza width={16} height={16} />Armar pizza</button>
                )}
                {isBodegaView && isAdmin && (
                  <button onClick={handleCreateBodega} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: 0, background: "#3F5E8C", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Icon.plus width={16} height={16} />Nueva receta bodega</button>
                )}
              </div>
            </div>

            {isBodegaView && bodegaSubs.length > 0 && (
              <div className="dt-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", margin: `0 -${padX}px`, padding: `0 ${padX}px 2px` }}>
                {[["all", "Todas", bodegaCount], ...bodegaSubs.map(([sub, count]) => [sub, sub, count])].map(([key, label, count]) => {
                  const on = selectedBodegaSub === key;
                  return <button key={key} onClick={() => setSelectedBodegaSub(key)} style={{ flex: "none", height: 34, padding: "0 13px", borderRadius: 999, border: `1.5px solid ${on ? "#0E2240" : "#E7E1D7"}`, background: on ? "#0E2240" : "#fff", color: on ? "#fff" : "#0E2240", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>{label} <span style={{ opacity: .6 }}>{count}</span></button>;
                })}
              </div>
            )}

            {/* Barra: Todas / Publicadas / Borradores + Cuadrícula / Lista */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isAdmin && (
                <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 999, padding: 4, boxShadow: "0 0 0 1px rgba(14,34,64,.06)", flex: vpMobile ? 1 : "none" }}>
                  {["Todas", "Publicadas", "Borradores"].map(f => (
                    <button key={f} onClick={() => setPubFilter(f)} style={{ flex: vpMobile ? 1 : "none", height: 34, padding: "0 14px", borderRadius: 999, border: 0, background: pubFilter === f ? "#0E2240" : "transparent", color: pubFilter === f ? "#fff" : "#6E6A63", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{f}</button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 999, padding: 4, boxShadow: "0 0 0 1px rgba(14,34,64,.06)", marginLeft: "auto" }}>
                {[["grid", Icon.grid, "Cuadrícula"], ["list", Icon.list, "Lista"]].map(([m, Ic, label]) => (
                  <button key={m} aria-label={label} onClick={() => setListView(m)} style={{ width: 38, height: 34, borderRadius: 999, border: 0, background: viewMode === m ? "#0E2240" : "transparent", color: viewMode === m ? "#fff" : "#8A847A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic width={17} height={17} /></button>
                ))}
              </div>
            </div>
          </div>

          {/* Recetas */}
          {shown.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#8A847A", fontSize: 15, animation: "dtFade .4s both" }}>
              {t.noResults}{search && <>{" "}<button onClick={() => setSearch("")} style={{ marginLeft: 6, height: 36, padding: "0 14px", borderRadius: 10, border: 0, background: "#0E2240", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.clearSearch}</button></>}
            </div>
          ) : viewMode === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.map((r, i) => (
                <div key={r.id} onClick={() => openRecipe(r)} className="dt-row"
                  style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "9px 12px", borderRadius: 16, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", boxShadow: "0 0 0 1px rgba(14,34,64,.06)", cursor: "pointer", animation: "dtUp .5s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${Math.min(i, 14) * 25}ms` }}>
                  {r.image
                    ? <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", position: "relative", flex: "none" }}><Image fill src={r.image} alt={r.name} style={{ objectFit: "cover" }} sizes="42px" /></div>
                    : <Monogram name={r.name} color={catColor(catLabelOf(r.category))} size={42} radius={12} />}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0E2240", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: "#8A847A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ color: "#D9731A", fontWeight: 700 }}>{titleCase(catLabelOf(r.category))}</span> · {t.ingredients_count((r.ingredients || []).length)}</span>
                  </div>
                  {isAdmin && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: r.published ? "#1F9D6B" : "#B85E10", flex: "none" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />{r.published ? "Pub." : "Borr."}</span>}
                  <span style={{ color: "#C9C2B6", display: "flex", flex: "none" }}><Icon.chevron width={18} height={18} /></span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${vpMobile ? 140 : vp.w < 1024 ? 190 : 220}px, 1fr))`, gap: vpMobile ? 10 : 20 }}>
              {shown.map((r, i) => {
                const cc = catColor(catLabelOf(r.category));
                return (
                  <article key={r.id} onClick={() => openRecipe(r)} className="dt-card"
                    style={{ borderRadius: 20, overflow: "hidden", background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", boxShadow: "0 0 0 1px rgba(14,34,64,.06)", cursor: "pointer", animation: "dtUp .55s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${Math.min(i, 18) * 35}ms`, display: "flex", flexDirection: "column" }}>
                    <div style={{ aspectRatio: vpMobile ? "16/10" : "4/3", position: "relative", overflow: "hidden", background: `linear-gradient(140deg, ${cc}14, ${cc}26)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {r.image
                        ? <Image fill src={r.image} alt={r.name} style={{ objectFit: "cover" }} sizes="(max-width:640px) 50vw, 260px" />
                        : <span style={{ fontFamily: "var(--dt-serif)", fontWeight: 700, fontSize: vpMobile ? 44 : 76, color: cc, opacity: .28 }}>{initialOf(r.name)}</span>}
                      {isAdmin && (
                        <span style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 999, background: "rgba(255,255,255,.92)", color: r.published ? "#1F9D6B" : "#B85E10", fontSize: 11, fontWeight: 800 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />{r.published ? "Publicada" : "Borrador"}
                        </span>
                      )}
                      {r.video && <span style={{ position: "absolute", top: 10, right: 10, height: 24, padding: "0 8px", borderRadius: 999, background: "rgba(14,34,64,.8)", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center" }}>▶</span>}
                    </div>
                    <div style={{ padding: vpMobile ? "10px 12px 12px" : "14px 16px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".18em", color: "#D9731A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(catLabelOf(r.category)).toUpperCase()}</span>
                      <span style={{ fontFamily: "var(--dt-serif)", fontSize: vpMobile ? 14.5 : 18, fontWeight: 600, color: "#0E2240", lineHeight: 1.2 }}>{r.name}</span>
                      <span style={{ fontSize: 12, color: "#8A847A" }}>{t.ingredients_count((r.ingredients || []).length)}</span>
                    </div>
                  </article>
                );
              })}
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
        <RecipeDetail key={selectedRecipe.id} recipe={selectedRecipe} currentUser={currentUser} onClose={()=>setSelectedRecipe(null)} onEdit={()=>handleEdit(selectedRecipe)} onDelete={()=>handleDelete(selectedRecipe)} onTogglePublish={()=>handleTogglePublish(selectedRecipe)} pizzaRecipes={recipes.filter(r=>r.category?.toLowerCase().includes("pizza"))} brandLabel={brandLabel} brandName={brandName} companyTagline={companyTagline} />
      )}
      {showForm && (
        <RecipeForm initial={editingRecipe} categories={allCategories} bodegaSubcategories={bodegaSubList} onSave={handleSaveRecipe} onCancel={handleCloseRecipeForm} />
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
        {showCalcPan && (
          <CalculadoraPan isAdmin={isAdmin} onClose={()=>setShowCalcPan(false)} />
        )}
        {showCalc3D && (
          <Calculadora3D onClose={()=>setShowCalc3D(false)} />
        )}
        {showCosting && isAdmin && (
          <CostingPanel recipes={recipes} onClose={()=>setShowCosting(false)} />
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

      <ConfirmModal confirmModal={confirmModal} profileHash={profileHash} onCancel={() => setConfirmModal(null)} />

      {/* Asistente de cocina (avatar flotante). Solo cuando hay ninguna ficha/modal a pantalla completa abierto. */}
      {!showForm && !selectedRecipe && <ChefAssistant />}

    </div>
  );
}
