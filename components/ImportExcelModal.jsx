"use client";
import { insertRecipe } from "@/lib/storage";
import { importFromExcel } from "@/lib/importExcel";

export function ImportExcelModal({ show, isAdmin, onClose, importDone, importPreview, importLoading, setImportPreview, setImportLoading, setImportDone, onRecipeAdded }) {
  if (!show || !isAdmin) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9998, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", width:"100%", maxWidth:"480px", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", padding:"28px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <div>
            <div style={{ fontSize:"22px", fontWeight:"700", color:"#1b3a5c" }}>📤 Importar recetas</div>
            <div style={{ fontSize:"13px", color:"#888", marginTop:"2px" }}>Desde plantilla Excel (.xlsx)</div>
          </div>
          <button onClick={onClose} style={{ background:"#f0ece6", border:"none", borderRadius:"50%", width:"36px", height:"36px", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>

        {importDone ? (
          <div style={{ textAlign:"center", padding:"32px 0" }}>
            <div style={{ fontSize:"52px", marginBottom:"12px" }}>✅</div>
            <div style={{ fontSize:"18px", fontWeight:"700", color:"#27ae60", marginBottom:"8px" }}>¡Recetas importadas!</div>
            <div style={{ fontSize:"13px", color:"#888", marginBottom:"24px" }}>{importPreview?.recipes?.length} recetas cargadas correctamente</div>
            <button onClick={onClose} style={{ background:"var(--app-primary)", border:"none", borderRadius:"10px", padding:"12px 28px", color:"#fff", fontWeight:"700", cursor:"pointer", fontSize:"14px" }}>Cerrar</button>
          </div>
        ) : !importPreview ? (
          <>
            <div style={{ background:"#f5f0ea", borderRadius:"12px", padding:"18px", marginBottom:"20px", fontSize:"13px", color:"#5a3e2b", lineHeight:"1.7" }}>
              <strong>📋 Pasos:</strong><br/>
              1. Descarga la plantilla desde <em>⚙️ → Descargar plantilla Excel</em><br/>
              2. Llena las recetas en la hoja <strong>🍽️ RECETAS</strong><br/>
              3. Guarda el archivo y súbelo aquí
            </div>
            <label style={{ display:"block", background:"var(--app-primary)", color:"#fff", padding:"14px", borderRadius:"12px", textAlign:"center", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>
              📂 Seleccionar archivo .xlsx
              <input type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportLoading(true);
                try {
                  const parsed = await importFromExcel(file);
                  setImportPreview({ recipes: parsed, fileName: file.name });
                } catch (err) {
                  alert("Error al leer el archivo: " + err.message);
                } finally {
                  setImportLoading(false);
                }
              }} />
            </label>
            {importLoading && <div style={{ textAlign:"center", marginTop:"16px", color:"#888" }}>⏳ Leyendo archivo...</div>}
          </>
        ) : (
          <>
            <div style={{ background:"#e8f8ef", border:"1px solid #a8e6c0", borderRadius:"10px", padding:"14px", marginBottom:"16px" }}>
              <div style={{ fontWeight:"700", color:"#1e8449", marginBottom:"4px" }}>✓ Archivo leído: {importPreview.fileName}</div>
              <div style={{ fontSize:"13px", color:"#27ae60" }}>{importPreview.recipes.length} recetas encontradas</div>
            </div>
            <div style={{ maxHeight:"220px", overflowY:"auto", border:"1px solid #e8e0d5", borderRadius:"10px", marginBottom:"18px" }}>
              {importPreview.recipes.map((r, i) => (
                <div key={i} style={{ padding:"10px 14px", borderBottom:"1px solid #f0ebe3", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:"600", fontSize:"13px", color:"#1b3a5c" }}>{r.name}</div>
                    <div style={{ fontSize:"11px", color:"#aaa" }}>{r.category || "Sin categoría"} · {r.ingredients?.length || 0} ingredientes</div>
                  </div>
                  <div style={{ fontSize:"11px", color:"#ccc" }}>#{i+1}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff8e6", border:"1px solid #f5d78e", borderRadius:"10px", padding:"12px", marginBottom:"18px", fontSize:"12px", color:"#7d6000" }}>
              ⚠️ Las recetas se agregarán sin borrar las existentes. Las imágenes deben subirse manualmente desde cada receta.
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setImportPreview(null)} style={{ flex:1, background:"#f0ece6", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>← Cambiar archivo</button>
              <button onClick={async () => {
                setImportLoading(true);
                try {
                  for (const r of importPreview.recipes) {
                    const saved = await insertRecipe(r);
                    if (saved) onRecipeAdded(saved);
                  }
                  setImportDone(true);
                } catch (err) {
                  alert("Error al importar: " + err.message);
                } finally {
                  setImportLoading(false);
                }
              }} disabled={importLoading} style={{ flex:2, background: importLoading ? "#aaa" : "var(--app-primary)", border:"none", borderRadius:"10px", padding:"12px", cursor: importLoading ? "not-allowed" : "pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
                {importLoading ? "⏳ Importando..." : `✅ Importar ${importPreview.recipes.length} recetas`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
