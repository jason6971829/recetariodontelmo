// Helpers para manejar ingredientes con codigo (compatible con formato viejo)
//
// Formato nuevo:  { code: "084", text: "0.05 KILO - Carne Desmechada" }
// Formato viejo:  "0.05 KILO - S. Carne Desmechada | 084"  (string libre)
// Formato viejo:  "[084] 0.05 KILO - Carne"                 (con prefijo)
//
// normalizeIngredient acepta cualquiera de los 3 y devuelve siempre { code, text }.

export function normalizeIngredient(ing) {
  if (ing && typeof ing === "object") {
    return {
      code: String(ing.code || "").trim(),
      text: String(ing.text || ing.name || "").trim(),
    };
  }
  if (typeof ing === "string") {
    const s = ing.trim();
    // Codigo al final: "... | 084"
    const mEnd = s.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
    if (mEnd) return { code: mEnd[2], text: mEnd[1].trim() };
    // Codigo al inicio: "[084] ..."
    const mStart = s.match(/^\[(\d+)\]\s*(.*)$/);
    if (mStart) return { code: mStart[1], text: mStart[2].trim() };
    return { code: "", text: s };
  }
  return { code: "", text: "" };
}

// Convierte una lista de ingredientes a string plano para TTS / texto
export function ingredientToReadable(ing) {
  const { code, text } = normalizeIngredient(ing);
  return code ? `${text} (codigo ${code})` : text;
}

// Para guardar/exportar como string sencillo (Excel viejo, PDF)
export function ingredientToString(ing) {
  const { code, text } = normalizeIngredient(ing);
  return code ? `${text} | ${code}` : text;
}
