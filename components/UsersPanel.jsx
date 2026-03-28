"use client";
import { useState } from "react";
import { useLang } from "@/lib/LangContext";

const SEDES = ["Almendros", "Hayuelos", "Capriani", "Campiña", "Felicidad", "Calera", "Granada", "Oficina"];

export function UsersPanel({ users, onSave, onClose }) {
  const [list, setList] = useState(users);
  const [newUser, setNewUser] = useState({ username:"", password:"", name:"", role:"cocinero", sede:"" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const { t } = useLang();
  const inp = { padding:"9px 10px", border:"1.5px solid #E0D8CE", borderRadius:"7px", fontSize:"13px", outline:"none", width:"100%", boxSizing:"border-box" };

  const addUser = () => {
    if (!newUser.username||!newUser.password||!newUser.name){alert("Completa todos los campos");return;}
    setList(l=>[...l,{...newUser,id:Date.now()}]);
    setNewUser({username:"",password:"",name:"",role:"cocinero",sede:""});
  };
  const removeUser = id => {
    if (list.find(u=>u.id===id)?.username==="admin"){alert("No puedes eliminar el administrador principal");return;}
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    setList(l=>l.filter(u=>u.id!==id));
  };
  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, username: u.username, password: u.password, role: u.role, sede: u.sede || "" });
  };
  const saveEdit = (id) => {
    const updated = list.map(u => u.id === id ? { ...u, ...editForm } : u);
    setList(updated);
    setEditingId(null);
    onSave(updated); // Guardar directamente en Supabase
  };
  const cancelEdit = () => setEditingId(null);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(10,15,25,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"620px", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>{t.admin}</div>
            <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700", marginTop:"3px" }}>{t.users.title}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"20px" }}>
          {list.map(u=>(
            <div key={u.id} style={{ padding:"14px", background:"#F7F3EE", borderRadius:"10px", marginBottom:"8px" }}>
              {editingId === u.id ? (
                /* MODO EDICIÓN */
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
                    <input style={inp} placeholder={t.users.name} value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} />
                    <input style={inp} placeholder={t.users.username} value={editForm.username} onChange={e=>setEditForm(f=>({...f,username:e.target.value}))} />
                    <input style={inp} placeholder={t.users.password} value={editForm.password} onChange={e=>setEditForm(f=>({...f,password:e.target.value}))} />
                    <select style={inp} value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))}>
                      <option value="cocinero">{t.users.roleChef}</option>
                      <option value="admin">{t.users.roleAdmin}</option>
                    </select>
                    <select style={inp} value={editForm.sede} onChange={e=>setEditForm(f=>({...f,sede:e.target.value}))}>
                      <option value="">{t.users.sede}</option>
                      {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
                    <button onClick={cancelEdit} style={{ background:"#F0ECE6", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"12px", fontWeight:"600", color:"#5a3e2b" }}>{t.users.cancel}</button>
                    <button onClick={()=>saveEdit(u.id)} style={{ background:"#27ae60", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"12px", fontWeight:"700", color:"#fff" }}>{t.users.save}</button>
                  </div>
                </div>
              ) : (
                /* MODO VISUALIZACIÓN */
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                    <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:u.role==="admin"?"var(--app-primary)":"#D4721A", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:"700", fontSize:"14px", flexShrink:0 }}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:"700", fontSize:"14px", color:"var(--app-primary)" }}>{u.name}</div>
                      <div style={{ fontSize:"12px", color:"#888", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        @{u.username} • {t.users.passwordShort}: {u.password} • <span style={{ color:u.role==="admin"?"var(--app-primary)":"#D4721A", fontWeight:"600" }}>{u.role==="admin"?t.users.roleAdminShort:t.users.roleChefShort}</span>
                        {u.sede && <span> • 📍 {u.sede}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
                      <button onClick={()=>startEdit(u)} style={{ background:"none", border:"1px solid var(--app-primary)", color:"var(--app-primary)", borderRadius:"6px", padding:"5px 10px", cursor:"pointer", fontSize:"12px" }}>{t.users.edit}</button>
                      {u.username!=="admin"&&<button onClick={()=>removeUser(u.id)} style={{ background:"none", border:"1px solid #e74c3c", color:"#e74c3c", borderRadius:"6px", padding:"5px 10px", cursor:"pointer", fontSize:"12px" }}>🗑️</button>}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          <div style={{ borderTop:"2px dashed #E0D8CE", paddingTop:"16px", marginTop:"10px" }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"12px" }}>{t.users.addSection}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
              <input style={inp} placeholder={t.users.fullName} value={newUser.name} onChange={e=>setNewUser(n=>({...n,name:e.target.value}))} />
              <input style={inp} placeholder={t.users.username} value={newUser.username} onChange={e=>setNewUser(n=>({...n,username:e.target.value}))} />
              <input style={inp} placeholder={t.users.password} value={newUser.password} onChange={e=>setNewUser(n=>({...n,password:e.target.value}))} />
              <select style={inp} value={newUser.role} onChange={e=>setNewUser(n=>({...n,role:e.target.value}))}>
                <option value="cocinero">{t.users.roleChef}</option>
                <option value="admin">{t.users.roleAdmin}</option>
              </select>
              <select style={inp} value={newUser.sede} onChange={e=>setNewUser(n=>({...n,sede:e.target.value}))}>
                <option value="">{t.users.sede}</option>
                {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={addUser} style={{ background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"10px 18px", cursor:"pointer", fontWeight:"700" }}>{t.users.add}</button>
          </div>
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid #F0ECE6", display:"flex", justifyContent:"flex-end", gap:"10px", flexShrink:0 }}>
          <button onClick={onClose} style={{ background:"#F0ECE6", border:"none", borderRadius:"8px", padding:"10px 16px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b" }}>{t.users.cancel}</button>
          <button onClick={()=>{onSave(list);onClose();}} style={{ background:"var(--app-primary)", border:"none", borderRadius:"8px", padding:"10px 18px", cursor:"pointer", fontWeight:"700", color:"#fff" }}>{t.users.save}</button>
        </div>
      </div>
    </div>
  );
}
