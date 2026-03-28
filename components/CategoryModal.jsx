"use client";
import { useState } from "react";
import { useLang } from "@/lib/LangContext";

const EMOJI_OPTIONS = ["🍽️","🍔","🍕","🌭","🍟","🥪","🍝","🌽","🍌","🫓","🥗","🍲","🍖","🥩","🍗","🐟","🦐","🍣","🥘","🍛","🧆","🥙","🌯","🍜","🍱","🥟","🍊","🥤","🍺","🍷","🍹","🍨","🍰","🧁","☕","🍵","➕","⚙️","👶","♨️"];

export function CategoryModal({ mode, initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.label || initial?.id || "");
  const [icon, setIcon] = useState(initial?.icon || "🍽️");
  const [showEmojis, setShowEmojis] = useState(false);
  const { t } = useLang();

  const title = mode === "edit" ? t.category.editTitle : t.category.newTitle;

  const handleSave = () => {
    if (!name.trim()) { alert("El nombre es obligatorio"); return; }
    onSave({ id: mode === "edit" ? initial.id : name.trim(), label: name.trim(), icon, oldId: mode === "edit" ? initial.id : null });
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"420px", overflow:"hidden", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1B3A5C,#0d2340)", padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>RECETARIO DON TELMO</div>
            <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700", marginTop:"3px" }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:"24px" }}>
          {/* Ícono */}
          <div style={{ textAlign:"center", marginBottom:"20px" }}>
            <div
              onClick={(ev) => { ev.stopPropagation(); setShowEmojis(!showEmojis); }}
              style={{ width:"70px", height:"70px", borderRadius:"50%", background: showEmojis ? "#1B3A5C" : "#F7F3EE", border:"2px solid #E0D8CE", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:"36px", cursor:"pointer", transition:"all 0.2s" }}
            >
              {icon}
            </div>
            <div style={{ fontSize:"11px", color:"#888", marginTop:"6px" }}>{showEmojis ? t.category.chooseIcon : t.category.tapIcon}</div>
            {showEmojis && (
              <div onClick={(ev) => ev.stopPropagation()} style={{ display:"flex", flexWrap:"wrap", gap:"8px", justifyContent:"center", marginTop:"12px", padding:"14px", background:"#F7F3EE", borderRadius:"12px", maxHeight:"160px", overflowY:"auto" }}>
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={(ev) => { ev.stopPropagation(); setIcon(e); setShowEmojis(false); }} style={{ background: icon === e ? "#1B3A5C" : "#fff", border: icon === e ? "2px solid #D4721A" : "2px solid #E0D8CE", borderRadius:"10px", fontSize:"24px", padding:"8px", cursor:"pointer", transition:"all 0.1s", minWidth:"44px", minHeight:"44px" }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nombre */}
          <label style={{ fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", display:"block", marginBottom:"6px" }}>{t.category.nameLabel}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t.category.namePlaceholder}
            autoFocus
            style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />

          {/* Preview */}
          <div style={{ marginTop:"16px", padding:"12px 16px", background:"#0d2340", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ color:"#9BBACC", fontSize:"13px" }}>{icon} {name || t.category.preview}</span>
            <span style={{ background:"rgba(255,255,255,0.1)", borderRadius:"10px", padding:"2px 7px", fontSize:"11px", fontWeight:"700", color:"#9BBACC" }}>0</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 24px", borderTop:"1px solid #F0ECE6", display:"flex", justifyContent:"flex-end", gap:"10px" }}>
          <button onClick={onClose} style={{ background:"#F0ECE6", border:"none", borderRadius:"8px", padding:"10px 18px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>{t.category.cancel}</button>
          <button onClick={handleSave} style={{ background:"#1B3A5C", border:"none", borderRadius:"8px", padding:"10px 22px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
            {mode === "edit" ? t.category.save : t.category.create}
          </button>
        </div>
      </div>
    </div>
  );
}
