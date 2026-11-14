"use client";
import { useState } from "react";
import { useLang } from "@/lib/LangContext";
import { useViewport } from "@/hooks/useViewport";
import { Icon } from "@/components/dt/ui";
import { AdminShell, FootBtn, Switch, useToast, A, eyebrow, input } from "@/components/dt/AdminShell";

const SEDES = ["Almendros", "Hayuelos", "Capriani", "Campiña", "Felicidad", "Calera", "Granada", "Oficina"];

// Helper: unique key for each user in the UI (existing users use id, new users use _tempId)
const uid = (u) => u.id ?? u._tempId;

const EMPTY_USER = { username:"", password:"", name:"", role:"cocinero", sede:"", permissions:{} };

// Los textos de i18n traen emojis/símbolos al inicio ("✏️ Editar", "+ Agregar"): se quitan, el ícono va en SVG.
const txt = (s) => String(s || "").replace(/^[^\p{L}\p{N}]+/u, "");

const Svg = ({ d, size = 16, w = 2, stroke = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const P = {
  key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22M14.1 14.1a3 3 0 1 1-4.2-4.2",
  pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l5 5L20 7",
};

export function UsersPanel({ users, onSave, onClose }) {
  const [list, setList] = useState(users);
  // Un solo formulario (abajo) para agregar y para editar; editingId indica el modo.
  const [form, setForm] = useState(EMPTY_USER);
  const [editingId, setEditingId] = useState(null);
  const [rev, setRev] = useState({}); // claves visibles por fila
  const [closing, setClosing] = useState(false);
  const { t } = useLang();
  const { mobile } = useViewport();
  const [toast, showToast] = useToast();
  const editing = editingId != null;

  const addUser = () => {
    if (!form.username||!form.password||!form.name){showToast("Completa todos los campos");return;}
    // No asignar id — saveUsers lo detecta como nuevo y deja que Supabase genere el id
    setList(l=>[...l,{...form, _tempId:Date.now()}]);
    setForm(EMPTY_USER);
    showToast("Usuario agregado · falta Guardar");
  };
  const removeUser = key => {
    if (list.find(u=>uid(u)===key)?.username==="admin"){alert("No puedes eliminar el administrador principal");return;}
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    setList(l=>l.filter(u=>uid(u)!==key));
    if (editingId === key) { setEditingId(null); setForm(EMPTY_USER); }
  };
  const startEdit = (u) => {
    setEditingId(uid(u));
    setForm({ name: u.name, username: u.username, password: u.password, role: u.role, sede: u.sede || "", permissions: u.permissions || {} });
  };
  const saveEdit = (key) => {
    if (!String(form.name||"").trim() || !String(form.username||"").trim()) { showToast("Completa nombre y usuario"); return; }
    const updated = list.map(u => uid(u) === key ? { ...u, ...form } : u);
    setList(updated);
    setEditingId(null);
    setForm(EMPTY_USER);
    const clean = updated.map(({ _tempId, permissions, ...rest }) => {
      const hasPerms = permissions && Object.keys(permissions).length > 0;
      return hasPerms ? { ...rest, permissions } : rest;
    });
    onSave(clean);
    showToast("Usuario actualizado");
  };
  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_USER); };

  // Strip _tempId antes de guardar; tambien omite `permissions` si esta vacio para
  // no enviar el campo si la columna aun no existe en DB (migracion pendiente).
  const handleSave = () => {
    if (closing) return;
    const clean = list.map(({ _tempId, permissions, ...rest }) => {
      const hasPerms = permissions && Object.keys(permissions).length > 0;
      return hasPerms ? { ...rest, permissions } : rest;
    });
    onSave(clean);
    setClosing(true);
    showToast("Usuarios guardados");
    setTimeout(onClose, 700); // deja ver el toast antes de cerrar
  };

  const field = { ...input, borderRadius: 13, fontWeight: 500 };
  const rowBtn = { height: 44, minWidth: 44, borderRadius: 11, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", flex: "none", transition: "all .2s" };

  return (
    <>
    <AdminShell
      icon={Icon.users()}
      title={txt(t.users.title)}
      maxWidth={660}
      onClose={onClose}
      footer={<>
        <FootBtn kind="gray" onClick={onClose} disabled={closing}>{txt(t.users.cancel)}</FootBtn>
        <FootBtn kind="navy" onClick={handleSave} disabled={closing}>{txt(t.users.save)}</FootBtn>
      </>}
    >
      <div className="dt-adm" style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {list.map((u, i) => {
            const k = uid(u);
            const admin = u.role === "admin";
            const shown = !!rev[k];
            return (
              <div key={k} style={{ display:"flex", alignItems:"center", gap: mobile ? 8 : 12, padding:"10px 12px", borderRadius:16, background:"#fff", boxShadow: editingId === k ? `0 0 0 2px ${A.orange}` : "0 0 0 1px rgba(14,34,64,.06)", transition:"box-shadow .3s", animation:"dtUp .45s both", animationDelay: Math.min(i, 8) * 45 + "ms" }}>
                <span style={{ width:44, height:44, borderRadius:"50%", background: admin ? A.navy : A.orange, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, flex:"none" }}>
                  {(String(u.name || "").trim()[0] || "?").toUpperCase()}
                </span>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14.5, fontWeight:800, color:A.navy, overflowWrap:"anywhere" }}>{u.name}</span>
                    <span style={{ height:21, padding:"0 8px", borderRadius:999, background: admin ? "#E7ECF5" : A.orange1, color: admin ? A.navy : A.orange7, fontSize:11, fontWeight:800, display:"flex", alignItems:"center" }}>
                      {admin ? t.users.roleAdminShort : t.users.roleChefShort}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", fontSize:12, color:A.muted2 }}>
                    <span style={{ overflowWrap:"anywhere" }}>@{u.username}</span>
                    <span>·</span>
                    <span title={t.users.passwordShort} style={{ display:"flex", alignItems:"center", gap:4, fontVariantNumeric:"tabular-nums" }}>
                      <Svg d={P.key} size={12} />
                      <span style={{ overflowWrap:"anywhere" }}>{shown ? u.password : "••••••••"}</span>
                      <button type="button" onClick={() => setRev(r => ({ ...r, [k]: !r[k] }))} aria-label={shown ? "Ocultar clave" : "Mostrar clave"} aria-pressed={shown}
                        style={{ width:44, height:44, margin:"-14px -10px -14px -8px", border:0, background:"transparent", color: shown ? A.orange : A.muted2, cursor:"pointer", padding:0, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}>
                        <Svg d={shown ? P.eyeOff : P.eye} size={15} />
                      </button>
                    </span>
                    {u.sede && <><span>·</span><span>{u.sede}</span></>}
                  </div>
                </div>
                <button type="button" className="dt-usr-edit" onClick={() => startEdit(u)} aria-label={txt(t.users.edit)}
                  style={{ ...rowBtn, padding: mobile ? 0 : "0 12px", border:`1.5px solid ${A.line}`, color:A.navy, fontWeight:800, fontSize:13 }}>
                  <Svg d={P.pencil} size={15} stroke={A.orange} />
                  {!mobile && <span>{txt(t.users.edit)}</span>}
                </button>
                {u.username !== "admin" && (
                  <button type="button" className="dt-usr-del" onClick={() => removeUser(k)} aria-label="Eliminar"
                    style={{ ...rowBtn, width:44, padding:0, border:"1.5px solid #F3C9C5", color:A.red }}>
                    <Svg d={P.trash} size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop:"2px dashed #DCD4C7", paddingTop:16, display:"flex", flexDirection:"column", gap:10, animation:"dtUp .45s both", animationDelay: Math.min(list.length, 8) * 45 + "ms" }}>
          <span style={eyebrow}>{editing ? "EDITAR USUARIO" : t.users.addSection}</span>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit,minmax(${mobile ? 220 : 240}px,1fr))`, gap:8 }}>
            <input style={field} aria-label={t.users.fullName} placeholder={t.users.fullName} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            <input style={field} aria-label={t.users.username} placeholder={t.users.username} autoCapitalize="none" autoCorrect="off" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} />
            <input style={field} aria-label={t.users.password} placeholder={t.users.password} autoCapitalize="none" autoCorrect="off" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
            <select style={{ ...field, padding:"0 12px" }} aria-label="Rol" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="cocinero">{t.users.roleChef}</option>
              <option value="admin">{t.users.roleAdmin}</option>
            </select>
            <select style={{ ...field, padding:"0 12px" }} aria-label={t.users.sede} value={form.sede} onChange={e=>setForm(f=>({...f,sede:e.target.value}))}>
              <option value="">{t.users.sede}</option>
              {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {form.role !== "admin" && (
            <div onClick={() => setForm(f => ({ ...f, permissions: { ...(f.permissions||{}), bodega: !(f.permissions?.bodega === true) } }))}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", minHeight:52, borderRadius:13, border:`1.5px solid ${A.line}`, background:"#fff", cursor:"pointer", boxSizing:"border-box" }}>
              <span onClick={e => e.stopPropagation()} style={{ display:"flex" }}>
                <Switch on={form.permissions?.bodega === true} label="Acceso a Recetas Bodega"
                  onChange={v => setForm(f => ({ ...f, permissions: { ...(f.permissions||{}), bodega: v } }))} />
              </span>
              <span style={{ fontSize:13.5, color:A.ink2, lineHeight:1.3 }}><strong style={{ color:A.navy }}>Acceso a Recetas Bodega</strong> · subrecetas de producción</span>
            </div>
          )}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" className="dt-usr-add" onClick={() => editing ? saveEdit(editingId) : addUser()}
              style={{ height:46, padding:"0 20px", borderRadius:13, border:0, background:A.orange, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit", transition:"all .2s" }}>
              <Svg d={editing ? P.check : P.plus} size={16} w={2.6} />
              {editing ? "Guardar cambios" : txt(t.users.add)}
            </button>
            {editing && (
              <button type="button" className="dt-adm-gray" onClick={cancelEdit}
                style={{ height:46, padding:"0 18px", borderRadius:13, border:0, background:A.grayBtn, color:A.ink2, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit", transition:"background .2s" }}>
                {txt(t.users.cancel)}
              </button>
            )}
          </div>
        </div>
        <style>{`
          .dt-usr-edit:hover{border-color:${A.navy}!important}
          .dt-usr-del:hover{background:${A.red}!important;color:#fff!important;border-color:${A.red}!important}
          .dt-usr-add:hover{background:#E8832B!important;transform:translateY(-1px)}
        `}</style>
      </div>
    </AdminShell>
    {toast}
    </>
  );
}
