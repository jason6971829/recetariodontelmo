"use client";
import { useState } from "react";

export function UsersPanel({ users, onSave, onClose }) {
  const [list, setList] = useState(users);
  const [newUser, setNewUser] = useState({ username:"", password:"", name:"", role:"cocinero" });
  const inp = { padding:"9px 10px", border:"1.5px solid #E0D8CE", borderRadius:"7px", fontSize:"13px", outline:"none", width:"100%", boxSizing:"border-box" };

  const addUser = () => {
    if (!newUser.username||!newUser.password||!newUser.name){alert("Completa todos los campos");return;}
    setList(l=>[...l,{...newUser,id:Date.now()}]);
    setNewUser({username:"",password:"",name:"",role:"cocinero"});
  };
  const removeUser = id => {
    if (list.find(u=>u.id===id)?.role==="admin"){alert("No puedes eliminar el administrador");return;}
    setList(l=>l.filter(u=>u.id!==id));
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(10,15,25,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"560px", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ background:"linear-gradient(135deg,#1B3A5C,#0d2340)", padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>ADMINISTRACIÓN</div>
            <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700", marginTop:"3px" }}>Gestión de Usuarios</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"20px" }}>
          {list.map(u=>(
            <div key={u.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px", background:"#F7F3EE", borderRadius:"10px", marginBottom:"8px" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:u.role==="admin"?"#1B3A5C":"#D4721A", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:"700", fontSize:"14px", flexShrink:0 }}>
                {u.name[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:"700", fontSize:"14px", color:"#1B3A5C" }}>{u.name}</div>
                <div style={{ fontSize:"12px", color:"#888", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>@{u.username} • Clave: {u.password} • <span style={{ color:u.role==="admin"?"#1B3A5C":"#D4721A", fontWeight:"600" }}>{u.role==="admin"?"Admin":"Cocinero"}</span></div>
              </div>
              {u.role!=="admin"&&<button onClick={()=>removeUser(u.id)} style={{ background:"none", border:"1px solid #e74c3c", color:"#e74c3c", borderRadius:"6px", padding:"5px 10px", cursor:"pointer", fontSize:"12px", flexShrink:0 }}>Eliminar</button>}
            </div>
          ))}
          <div style={{ borderTop:"2px dashed #E0D8CE", paddingTop:"16px", marginTop:"10px" }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", marginBottom:"12px" }}>AGREGAR USUARIO</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
              <input style={inp} placeholder="Nombre completo" value={newUser.name} onChange={e=>setNewUser(n=>({...n,name:e.target.value}))} />
              <input style={inp} placeholder="Usuario" value={newUser.username} onChange={e=>setNewUser(n=>({...n,username:e.target.value}))} />
              <input style={inp} placeholder="Contraseña" value={newUser.password} onChange={e=>setNewUser(n=>({...n,password:e.target.value}))} />
              <select style={inp} value={newUser.role} onChange={e=>setNewUser(n=>({...n,role:e.target.value}))}>
                <option value="cocinero">Cocinero (solo lectura)</option>
                <option value="admin">Admin (editor)</option>
              </select>
            </div>
            <button onClick={addUser} style={{ background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"10px 18px", cursor:"pointer", fontWeight:"700" }}>+ Agregar</button>
          </div>
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid #F0ECE6", display:"flex", justifyContent:"flex-end", gap:"10px", flexShrink:0 }}>
          <button onClick={onClose} style={{ background:"#F0ECE6", border:"none", borderRadius:"8px", padding:"10px 16px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b" }}>Cancelar</button>
          <button onClick={()=>{onSave(list);onClose();}} style={{ background:"#1B3A5C", border:"none", borderRadius:"8px", padding:"10px 18px", cursor:"pointer", fontWeight:"700", color:"#fff" }}>💾 Guardar</button>
        </div>
      </div>
    </div>
  );
}
