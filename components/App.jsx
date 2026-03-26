"use client";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { getRecipes, upsertRecipe, insertRecipe, deleteRecipe as deleteRecipeDb, getUsers, saveUsers as saveUsersDb, uploadImage, deleteImage, logActivity } from "@/lib/storage";
import { CATEGORIES, INITIAL_USERS } from "@/lib/constants";
import { SEED_RECIPES } from "@/data/seed-recipes";
import { RecipeDetail } from "@/components/RecipeDetail";
import { RecipeForm } from "@/components/RecipeForm";
import { UsersPanel } from "@/components/UsersPanel";
import { ActivityReport } from "@/components/ActivityReport";
import { ScreenProtection } from "@/components/ScreenProtection";
import { GlobalWatermark } from "@/components/Watermark";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function App() {
  const isMobile = useIsMobile();
  const { online, syncing, pendingCount } = useOnlineStatus();
  const { isSupported: biometricSupported, hasCredential: hasBiometric, register: registerBiometric, authenticate: authBiometric, clearCredential } = useWebAuthn();
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState(INITIAL_USERS);
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
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }

  // En móvil: cerrar sidebar por defecto
  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  useEffect(() => {
    async function load() {
      const sr = await getRecipes();
      const su = await getUsers();
      setRecipes(sr || SEED_RECIPES);
      if (su && su.length > 0) setUsers(su);
      setLoading(false);
    }
    load();
  }, []);

  const saveUsers = async u => { setUsers(u); await saveUsersDb(u); };

  const handleLogin = () => {
    const u = users.find(u => u.username===loginForm.username && u.password===loginForm.password);
    if (!u) { setLoginError("Usuario o contraseña incorrectos"); return; }
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
    const catLabel = CATEGORIES.find(c => c.id === catId)?.label || catId;
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
  const filtered = recipes.filter(r => {
    const matchCat = selectedCat==="all" || r.category===selectedCat;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const catCounts = {};
  recipes.forEach(r => { catCounts[r.category] = (catCounts[r.category]||0)+1; });

  // ══ LOGIN ═══════════════════════════════════════════════════════
  if (screen==="login" || loading) {
    return (
      <div style={{ height:"100vh", background:"linear-gradient(135deg,#0d2340 0%,#1B3A5C 50%,#0d2340 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"Georgia,serif" }}>
        <div style={{ background:"#fff", borderRadius:"24px", padding: isMobile?"36px 28px":"48px 44px", width:"100%", maxWidth:"420px", boxShadow:"0 40px 100px rgba(0,0,0,0.5)" }}>
          <div style={{ textAlign:"center", marginBottom:"32px" }}>
            <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"72px", height:"72px", background:"linear-gradient(135deg,#1B3A5C,#0d2340)", borderRadius:"18px", marginBottom:"14px", boxShadow:"0 8px 24px rgba(27,58,92,0.4)" }}>
              <span style={{ fontSize:"30px" }}>🍽️</span>
            </div>
            <div style={{ color:"#D4721A", fontSize:"11px", fontWeight:"700", letterSpacing:"4px", marginBottom:"5px" }}>RECETARIO DIGITAL</div>
            <div style={{ color:"#1B3A5C", fontSize:"26px", fontWeight:"700", lineHeight:"1.1" }}>Don Telmo®</div>
            <div style={{ color:"#888", fontSize:"13px", marginTop:"3px" }}>1958 — Company</div>
          </div>
          {loading ? (
            <div style={{ textAlign:"center", padding:"20px", color:"#888" }}>
              <div style={{ fontSize:"24px", marginBottom:"10px" }}>⏳</div>Cargando recetario...
            </div>
          ) : <>
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"6px" }}>USUARIO</label>
              <input style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
                value={loginForm.username} onChange={e=>setLoginForm(f=>({...f,username:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Usuario" autoFocus />
            </div>
            <div style={{ marginBottom:"22px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"6px" }}>CONTRASEÑA</label>
              <input type="password" style={{ width:"100%", padding:"13px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
                value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Contraseña" />
            </div>
            {loginError && <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"14px", textAlign:"center", background:"#fef0ef", padding:"10px", borderRadius:"8px" }}>{loginError}</div>}
            <button onClick={handleLogin} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,#1B3A5C,#0d2340)", border:"none", borderRadius:"10px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"1px" }}>
              INGRESAR AL RECETARIO
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
                {biometricLoading ? "⏳ Verificando..." : "🔐 Acceso con Face ID / Huella"}
              </button>
            )}

            <div style={{ textAlign:"center", marginTop:"18px", fontSize:"11px", color:"#bbb" }}>Acceso exclusivo personal Don Telmo</div>
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
      <GlobalWatermark username={currentUser?.name || ""} sede={currentUser?.sede || ""} />

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
          <div style={{ flexShrink:0 }}>
            <div style={{ color:"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>RECETARIO DIGITAL</div>
            <div style={{ color:"#fff", fontSize:"15px", fontWeight:"700", fontFamily:"Georgia,serif", lineHeight:"1" }}>Don Telmo® <span style={{ color:"#8BAACC", fontSize:"11px" }}>1958</span></div>
          </div>
        )}

        {/* Buscador */}
        <div style={{ flex:1, position:"relative" }}>
          <span style={{ position:"absolute", left:"11px", top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.5)", fontSize:"13px" }}>🔍</span>
          <input
            style={{ width:"100%", padding:"8px 12px 8px 34px", border:"none", borderRadius:"20px", background:"rgba(255,255,255,0.13)", color:"#fff", fontSize:"13px", outline:"none", boxSizing:"border-box" }}
            placeholder="Buscar receta..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (isMobile) setSidebarOpen(false);
              // Log search after user stops typing (debounced via timeout)
              clearTimeout(window._searchTimeout);
              if (e.target.value.length >= 3) {
                const val = e.target.value;
                window._searchTimeout = setTimeout(() => {
                  if (currentUser) logActivity(currentUser.id, "search", val);
                }, 1500);
              }
            }}
          />
        </div>

        {/* Acciones */}
        <div style={{ display:"flex", gap:"8px", alignItems:"center", flexShrink:0 }}>
          {isAdmin && <>
            <button onClick={handleCreate} style={{ background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 12px", cursor:"pointer", fontWeight:"700", fontSize:"13px", whiteSpace:"nowrap" }}>+ Nueva</button>
            <button onClick={()=>setShowReport(true)} title="Reporte de actividad" style={{ background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"16px" }}>📊</button>
            <button onClick={()=>setShowUsers(true)} style={{ background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"16px" }}>👥</button>
          </>}
          <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:isAdmin?"#D4721A":"#27ae60", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:"700", fontSize:"12px", cursor:"pointer" }} onClick={handleLogout} title="Cerrar sesión">
            {currentUser.name[0]}
          </div>
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
              <div style={{ color:"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"2px", fontFamily:"Georgia,serif" }}>CATEGORÍAS</div>
            </div>
            {CATEGORIES.map(cat => {
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
                    {isAdmin && cat.id !== "all" && count > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                        style={{ background:"rgba(231,76,60,0.15)", borderRadius:"6px", padding:"2px 5px", fontSize:"11px", cursor:"pointer", color:"#e74c3c", lineHeight:1, opacity:0.6, transition:"opacity 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
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
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main style={{ flex:1, overflowY:"auto", padding: isMobile ? "14px" : "22px", minWidth:0 }}>
          {/* Título */}
          <div style={{ marginBottom:"18px" }}>
            <h1 style={{ margin:0, color:"#1B3A5C", fontFamily:"Georgia,serif", fontSize: isMobile?"18px":"21px", fontWeight:"700" }}>
              {CATEGORIES.find(c=>c.id===selectedCat)?.icon} {CATEGORIES.find(c=>c.id===selectedCat)?.label}
            </h1>
            <div style={{ color:"#888", fontSize:"13px", marginTop:"3px" }}>
              {filtered.length} receta{filtered.length!==1?"s":""}{search && ` — "${search}"`}
            </div>
          </div>

          {/* Grid */}
          {filtered.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#888" }}>
              <div style={{ fontSize:"48px" }}>🔍</div>
              <div style={{ marginTop:"12px", fontSize:"15px" }}>No se encontraron recetas</div>
              {search && <button onClick={()=>setSearch("")} style={{ marginTop:"10px", background:"#1B3A5C", border:"none", borderRadius:"8px", color:"#fff", padding:"8px 16px", cursor:"pointer" }}>Limpiar búsqueda</button>}
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
                          <div style={{ fontSize:"28px" }}>{CATEGORIES.find(c=>c.id===r.category)?.icon||"🍽️"}</div>
                        </div>
                    }
                    {r.video && <div style={{ position:"absolute", top:"6px", right:"6px", background:"#e74c3c", borderRadius:"5px", padding:"2px 6px", fontSize:"10px", color:"#fff", fontWeight:"700" }}>▶</div>}
                  </div>
                  <div style={{ padding: isMobile?"10px":"13px" }}>
                    <div style={{ background:"#F7F3EE", borderRadius:"5px", padding:"2px 7px", fontSize:"9px", fontWeight:"700", color:"#D4721A", display:"inline-block", marginBottom:"5px", letterSpacing:"0.5px" }}>
                      {r.category.toUpperCase()}
                    </div>
                    <div style={{ fontWeight:"700", color:"#1B3A5C", fontSize: isMobile?"12px":"13px", lineHeight:"1.3", fontFamily:"Georgia,serif" }}>{r.name}</div>
                    <div style={{ color:"#aaa", fontSize:"11px", marginTop:"6px" }}>{r.ingredients.length} ingredientes</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* MODALES */}
      {selectedRecipe && !showForm && (
        <RecipeDetail recipe={selectedRecipe} currentUser={currentUser} onClose={()=>setSelectedRecipe(null)} onEdit={()=>handleEdit(selectedRecipe)} onDelete={()=>handleDelete(selectedRecipe)} />
      )}
      {showForm && (
        <RecipeForm initial={editingRecipe} onSave={handleSaveRecipe} onCancel={()=>{setShowForm(false);setEditingRecipe(null);}} />
      )}
      {showUsers && isAdmin && (
        <UsersPanel users={users} onSave={saveUsers} onClose={()=>setShowUsers(false)} />
      )}
      {showReport && isAdmin && (
        <ActivityReport onClose={()=>setShowReport(false)} />
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
