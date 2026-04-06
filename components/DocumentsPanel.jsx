"use client";
import { useState, useEffect, useRef } from "react";
import { DOC_CATEGORIES } from "@/lib/constants";
import { getDocuments, saveDocument, deleteDocument, uploadDocFile } from "@/lib/storage";

const FILE_ICONS = {
  "application/pdf": "📄",
  "image/": "🖼️",
  "video/": "🎬",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml": "📝",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml": "📊",
  "application/vnd.ms-powerpoint": "📽️",
  "application/vnd.openxmlformats-officedocument.presentationml": "📽️",
};

function getFileIcon(mimeType) {
  if (!mimeType) return "📎";
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(key)) return icon;
  }
  return "📎";
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({ isAdmin, onClose, currentUser }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "servicio" });
  const [pendingFile, setPendingFile] = useState(null);
  const [customCategories, setCustomCategories] = useState([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatForm, setNewCatForm] = useState({ label: "", icon: "📁" });
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileRef = useRef(null);

  // Todas las categorias: predefinidas + personalizadas
  const allDocCategories = [...DOC_CATEGORIES, ...customCategories];

  // Cargar categorias personalizadas del localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dontelmo:doc_categories");
      if (saved) setCustomCategories(JSON.parse(saved));
    } catch {}
  }, []);

  const saveCustomCategories = (cats) => {
    setCustomCategories(cats);
    localStorage.setItem("dontelmo:doc_categories", JSON.stringify(cats));
  };

  const addCategory = () => {
    if (!newCatForm.label.trim()) return;
    const id = newCatForm.label.trim().toLowerCase().replace(/\s+/g, "_");
    if (allDocCategories.some(c => c.id === id)) { alert("Esa categoría ya existe"); return; }
    saveCustomCategories([...customCategories, { id, label: newCatForm.label.trim(), icon: newCatForm.icon || "📁" }]);
    setNewCatForm({ label: "", icon: "📁" });
    setShowNewCat(false);
  };

  const removeCategory = (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    saveCustomCategories(customCategories.filter(c => c.id !== id));
    if (selectedCat === id) setSelectedCat("all");
  };

  const getPreviewUrl = (doc) => {
    const type = doc.file_type || "";
    // PDFs e imagenes se muestran directamente
    if (type === "application/pdf" || type.startsWith("image/")) return doc.file_url;
    // Office y otros: usar Google Docs Viewer
    return `https://docs.google.com/gview?url=${encodeURIComponent(doc.file_url)}&embedded=true`;
  };

  const canPreviewInline = (doc) => {
    const type = doc.file_type || "";
    return type === "application/pdf" || type.startsWith("image/");
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    const data = await getDocuments();
    setDocs(data);
    setLoading(false);
  };

  const filtered = selectedCat === "all"
    ? docs.filter(d => d.active !== false)
    : docs.filter(d => d.category === selectedCat && d.active !== false);

  const catCounts = {};
  docs.filter(d => d.active !== false).forEach(d => {
    catCounts[d.category] = (catCounts[d.category] || 0) + 1;
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, "") }));
    }
  };

  const handleUpload = async () => {
    if (!pendingFile && !editingDoc) return;
    setUploading(true);
    try {
      let fileUrl = editingDoc?.file_url || "";
      let fileName = editingDoc?.file_name || "";
      let fileSize = editingDoc?.file_size || 0;
      let fileType = editingDoc?.file_type || "";

      if (pendingFile) {
        const url = await uploadDocFile(pendingFile);
        if (!url) { alert("Error al subir el archivo"); setUploading(false); return; }
        fileUrl = url;
        fileName = pendingFile.name;
        fileSize = pendingFile.size;
        fileType = pendingFile.type;
      }

      const doc = {
        ...(editingDoc?.id ? { id: editingDoc.id } : {}),
        title: form.title,
        description: form.description,
        category: form.category,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        uploaded_by: currentUser?.name || "Admin",
        active: true,
      };

      const saved = await saveDocument(doc);
      if (saved) {
        await loadDocs();
        resetForm();
      } else {
        alert("Error al guardar el documento");
      }
    } catch (err) {
      console.error(err);
      alert("Error al subir el documento");
    }
    setUploading(false);
  };

  const handleDelete = async (doc) => {
    if (!confirm(`¿Eliminar "${doc.title}"?`)) return;
    await deleteDocument(doc.id, doc.file_url);
    await loadDocs();
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setForm({ title: doc.title, description: doc.description || "", category: doc.category });
    setPendingFile(null);
    setShowUpload(true);
  };

  const resetForm = () => {
    setShowUpload(false);
    setEditingDoc(null);
    setForm({ title: "", description: "", category: "servicio" });
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const inp = { padding: "9px 12px", border: "1.5px solid #E0D8CE", borderRadius: "8px", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "780px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#D4721A", fontSize: "10px", fontWeight: "700", letterSpacing: "3px", fontFamily: "Georgia,serif" }}>DOCUMENTOS</div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: "17px", fontWeight: "700", marginTop: "3px" }}>📚 Manuales y Documentos</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>

        {/* Category Tabs */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #eee", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => setSelectedCat("all")}
            style={{
              padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600",
              background: selectedCat === "all" ? "var(--app-primary)" : "#F0EBE5",
              color: selectedCat === "all" ? "#fff" : "#666",
            }}
          >
            Todos ({docs.filter(d => d.active !== false).length})
          </button>
          {allDocCategories.map(cat => {
            const isCustom = customCategories.some(c => c.id === cat.id);
            return (
              <span key={cat.id} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <button
                  onClick={() => setSelectedCat(cat.id)}
                  style={{
                    padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                    background: selectedCat === cat.id ? "var(--app-primary)" : "#F0EBE5",
                    color: selectedCat === cat.id ? "#fff" : "#666",
                    paddingRight: isCustom && isAdmin ? "28px" : "14px",
                  }}
                >
                  {cat.icon} {cat.label} {catCounts[cat.id] ? `(${catCounts[cat.id]})` : ""}
                </button>
                {isCustom && isAdmin && (
                  <span
                    onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
                    style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", fontSize: "10px", color: "#e74c3c", lineHeight: 1 }}
                    title="Eliminar categoría"
                  >✕</span>
                )}
              </span>
            );
          })}
          {isAdmin && !showNewCat && (
            <button
              onClick={() => setShowNewCat(true)}
              style={{
                padding: "6px 12px", borderRadius: "20px", border: "1.5px dashed #D4721A", cursor: "pointer",
                fontSize: "12px", fontWeight: "600", background: "transparent", color: "#D4721A",
              }}
            >
              + Categoría
            </button>
          )}
          {showNewCat && (
            <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
              <input
                value={newCatForm.icon}
                onChange={e => setNewCatForm(f => ({ ...f, icon: e.target.value }))}
                style={{ width: "36px", padding: "4px", borderRadius: "8px", border: "1.5px solid #E0D8CE", fontSize: "14px", textAlign: "center" }}
                placeholder="📁"
                maxLength={2}
              />
              <input
                value={newCatForm.label}
                onChange={e => setNewCatForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addCategory()}
                style={{ width: "130px", padding: "5px 8px", borderRadius: "8px", border: "1.5px solid #E0D8CE", fontSize: "12px" }}
                placeholder="Nombre categoría"
                autoFocus
              />
              <button onClick={addCategory} style={{ background: "#D4721A", border: "none", borderRadius: "8px", color: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}>✓</button>
              <button onClick={() => { setShowNewCat(false); setNewCatForm({ label: "", icon: "📁" }); }} style={{ background: "#eee", border: "none", borderRadius: "8px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", color: "#999" }}>✕</button>
            </span>
          )}
        </div>

        {/* Upload button (admin only) */}
        {isAdmin && !showUpload && (
          <div style={{ padding: "12px 20px 0" }}>
            <button
              onClick={() => { resetForm(); setShowUpload(true); }}
              style={{
                background: "linear-gradient(135deg,#D4721A,#c0630f)", border: "none", borderRadius: "10px",
                color: "#fff", padding: "10px 20px", cursor: "pointer", fontSize: "13px", fontWeight: "700",
                display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 3px 12px rgba(212,114,26,0.3)"
              }}
            >
              📤 Subir Documento
            </button>
          </div>
        )}

        {/* Upload form */}
        {showUpload && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", background: "#FDFAF6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "#333" }}>
                {editingDoc ? "✏️ Editar Documento" : "📤 Subir Nuevo Documento"}
              </div>
              <button onClick={resetForm} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#999" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Nombre del documento"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Categoría</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ ...inp, background: "#fff" }}
                >
                  {allDocCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "10px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>Descripción</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Breve descripción (opcional)"
                style={inp}
              />
            </div>
            <div style={{ marginTop: "10px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "4px" }}>
                {editingDoc ? "Reemplazar archivo (opcional)" : "Archivo *"}
              </label>
              <input
                ref={fileRef}
                type="file"
                onChange={handleFileSelect}
                style={{ fontSize: "13px" }}
              />
              {pendingFile && (
                <span style={{ fontSize: "11px", color: "#888", marginLeft: "8px" }}>
                  {getFileIcon(pendingFile.type)} {pendingFile.name} ({formatSize(pendingFile.size)})
                </span>
              )}
            </div>
            <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
              <button
                onClick={handleUpload}
                disabled={uploading || (!pendingFile && !editingDoc) || !form.title}
                style={{
                  background: uploading ? "#ccc" : "linear-gradient(135deg,#D4721A,#c0630f)",
                  border: "none", borderRadius: "8px", color: "#fff", padding: "9px 20px",
                  cursor: uploading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "700",
                }}
              >
                {uploading ? "⏳ Subiendo..." : editingDoc ? "💾 Guardar Cambios" : "📤 Subir"}
              </button>
              <button onClick={resetForm} style={{ background: "#eee", border: "none", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", color: "#666" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Documents list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>⏳ Cargando documentos...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
              <div style={{ fontSize: "40px" }}>📂</div>
              <div style={{ marginTop: "10px", fontSize: "14px" }}>No hay documentos{selectedCat !== "all" ? " en esta categoría" : ""}</div>
              {isAdmin && <div style={{ marginTop: "6px", fontSize: "12px", color: "#aaa" }}>Usa el botón "Subir Documento" para agregar uno</div>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map(doc => {
                const cat = allDocCategories.find(c => c.id === doc.category);
                return (
                  <div
                    key={doc.id}
                    style={{
                      background: "#F7F3EE", borderRadius: "12px", padding: "14px 16px",
                      display: "flex", alignItems: "center", gap: "14px",
                      transition: "all 0.15s",
                    }}
                  >
                    {/* File icon */}
                    <div style={{
                      width: "46px", height: "46px", borderRadius: "10px",
                      background: "var(--app-primary)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "22px", flexShrink: 0,
                    }}>
                      {getFileIcon(doc.file_type)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title}
                      </div>
                      {doc.description && (
                        <div style={{ fontSize: "12px", color: "#888", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.description}</div>
                      )}
                      <div style={{ display: "flex", gap: "10px", marginTop: "4px", fontSize: "11px", color: "#aaa" }}>
                        <span style={{ background: "rgba(212,114,26,0.12)", color: "#D4721A", padding: "1px 8px", borderRadius: "10px", fontWeight: "600" }}>
                          {cat?.icon} {cat?.label || doc.category}
                        </span>
                        {doc.file_size > 0 && <span>{formatSize(doc.file_size)}</span>}
                        <span>{new Date(doc.created_at).toLocaleDateString("es-CO")}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        style={{
                          background: "#2563eb", border: "none", borderRadius: "8px",
                          color: "#fff", padding: "7px 12px", cursor: "pointer", fontSize: "12px",
                          fontWeight: "600", display: "flex", alignItems: "center", gap: "4px",
                        }}
                      >
                        👁️ Ver
                      </button>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={doc.file_name}
                        style={{
                          background: "var(--app-primary)", border: "none", borderRadius: "8px",
                          color: "#fff", padding: "7px 12px", cursor: "pointer", fontSize: "12px",
                          fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px",
                        }}
                      >
                        ⬇️ Descargar
                      </a>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEdit(doc)}
                            style={{
                              background: "rgba(212,114,26,0.12)", border: "none", borderRadius: "8px",
                              color: "#D4721A", padding: "7px 10px", cursor: "pointer", fontSize: "13px",
                            }}
                            title="Editar"
                          >✏️</button>
                          <button
                            onClick={() => handleDelete(doc)}
                            style={{
                              background: "rgba(231,76,60,0.1)", border: "none", borderRadius: "8px",
                              color: "#e74c3c", padding: "7px 10px", cursor: "pointer", fontSize: "13px",
                            }}
                            title="Eliminar"
                          >🗑️</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {previewDoc && (
          <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column" }}>
            {/* Preview header */}
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "#fff", fontSize: "15px", fontWeight: "700", fontFamily: "Georgia,serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "12px" }}>
                {getFileIcon(previewDoc.file_type)} {previewDoc.title}
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <a
                  href={previewDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={previewDoc.file_name}
                  style={{
                    background: "var(--app-primary)", border: "none", borderRadius: "8px",
                    color: "#fff", padding: "7px 14px", cursor: "pointer", fontSize: "12px",
                    fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  ⬇️ Descargar
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "36px", height: "36px", cursor: "pointer", fontSize: "20px" }}
                >×</button>
              </div>
            </div>
            {/* Preview content */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", overflow: "hidden" }}>
              {previewDoc.file_type?.startsWith("image/") ? (
                <img
                  src={previewDoc.file_url}
                  alt={previewDoc.title}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }}
                />
              ) : (
                <iframe
                  src={getPreviewUrl(previewDoc)}
                  style={{ width: "100%", height: "100%", border: "none", borderRadius: "8px", background: "#fff" }}
                  title={previewDoc.title}
                  allowFullScreen
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
