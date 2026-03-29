/**
 * exportExcel.js
 * Genera un archivo Excel (.xlsx) con todas las recetas del recetario.
 * Usa SheetJS (xlsx) — funciona directo en el navegador.
 */

// xlsx se carga de forma diferida (solo cuando el usuario exporta)
let _XLSX = null;
async function getXLSX() {
  if (!_XLSX) _XLSX = await import("xlsx");
  return _XLSX;
}

// ── Helpers ──────────────────────────────────────────────────────

function str(v) {
  return v ? String(v).trim() : "";
}

function formatIngredients(ingredients) {
  if (!ingredients || ingredients.length === 0) return "Sin ingredientes";
  return ingredients
    .map(ing => {
      const qty  = str(ing.quantity);
      const unit = str(ing.unit);
      const name = str(ing.name || ing);
      return [qty, unit, name].filter(Boolean).join(" ");
    })
    .join("\n");
}

// ── Estilo de celda ───────────────────────────────────────────────

function cellStyle(opts = {}) {
  return {
    font:      { name: "Calibri", sz: opts.sz || 11, bold: opts.bold || false, color: { rgb: opts.color || "000000" } },
    fill:      opts.fill ? { fgColor: { rgb: opts.fill }, patternType: "solid" } : undefined,
    alignment: { wrapText: true, vertical: "top", horizontal: opts.center ? "center" : "left" },
    border: {
      top:    { style: "thin", color: { rgb: "D0C8BE" } },
      bottom: { style: "thin", color: { rgb: "D0C8BE" } },
      left:   { style: "thin", color: { rgb: "D0C8BE" } },
      right:  { style: "thin", color: { rgb: "D0C8BE" } },
    },
  };
}

function hdrStyle(fill = "1B3A5C", color = "FFFFFF") {
  return {
    font:      { name: "Calibri", sz: 11, bold: true, color: { rgb: color } },
    fill:      { fgColor: { rgb: fill }, patternType: "solid" },
    alignment: { wrapText: true, vertical: "center", horizontal: "center" },
    border: {
      top:    { style: "medium", color: { rgb: "000000" } },
      bottom: { style: "medium", color: { rgb: "000000" } },
      left:   { style: "thin",   color: { rgb: "888888" } },
      right:  { style: "thin",   color: { rgb: "888888" } },
    },
  };
}

// ── Hoja 1: Índice general ────────────────────────────────────────

function buildIndex(recipes, brandName, XLSX) {
  const ws = {};
  const cols = ["A","B","C","D","E","F","G"];

  // Título
  ws["A1"] = { v: `${brandName} — Recetario Digital`, t:"s",
    s: { font:{ name:"Calibri", sz:16, bold:true, color:{ rgb:"1B3A5C" } }, alignment:{ horizontal:"center" } } };
  ws["A2"] = { v: `Total: ${recipes.length} recetas`, t:"s",
    s: { font:{ name:"Calibri", sz:11, color:{ rgb:"888888" } }, alignment:{ horizontal:"center" } } };
  ws["A3"] = { v: "", t:"s" };

  // Encabezados
  const headers = ["#", "NOMBRE", "CATEGORÍA", "PREP.", "COCCIÓN", "PORCIONES", "TIENE IMAGEN"];
  headers.forEach((h, i) => {
    ws[`${cols[i]}4`] = { v: h, t:"s", s: hdrStyle() };
  });

  // Filas
  recipes.forEach((r, i) => {
    const row = i + 5;
    const even = i % 2 === 0;
    const bg = even ? "FFFFFF" : "F5F0EA";
    ws[`A${row}`] = { v: i + 1,             t:"n", s: cellStyle({ fill: bg, center:true }) };
    ws[`B${row}`] = { v: str(r.name),        t:"s", s: cellStyle({ fill: bg, bold:true }) };
    ws[`C${row}`] = { v: str(r.category),    t:"s", s: cellStyle({ fill: bg }) };
    ws[`D${row}`] = { v: str(r.prepTime),    t:"s", s: cellStyle({ fill: bg, center:true }) };
    ws[`E${row}`] = { v: str(r.cookTime),    t:"s", s: cellStyle({ fill: bg, center:true }) };
    ws[`F${row}`] = { v: str(r.portions),    t:"s", s: cellStyle({ fill: bg, center:true }) };
    ws[`G${row}`] = { v: r.image ? "✓" : "—", t:"s", s: cellStyle({ fill: bg, center:true, color: r.image ? "27AE60" : "AAAAAA" }) };
  });

  const lastRow = recipes.length + 4;
  ws["!ref"] = `A1:G${lastRow}`;
  ws["!merges"] = [
    { s:{ r:0, c:0 }, e:{ r:0, c:6 } },  // Título ocupa todas las columnas
    { s:{ r:1, c:0 }, e:{ r:1, c:6 } },  // Subtítulo ídem
    { s:{ r:2, c:0 }, e:{ r:2, c:6 } },
  ];
  ws["!cols"] = [
    { wch: 5 },   // #
    { wch: 32 },  // Nombre
    { wch: 18 },  // Categoría
    { wch: 12 },  // Prep
    { wch: 12 },  // Cocción
    { wch: 12 },  // Porciones
    { wch: 14 },  // Imagen
  ];
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];
  return ws;
}

// ── Hoja por categoría ────────────────────────────────────────────

function buildCategorySheet(catRecipes, XLSX) {
  const ws = {};
  let row = 1;

  catRecipes.forEach((r, idx) => {
    const baseRow = row;

    // ── Nombre de la receta ──
    ws[`A${row}`] = { v: `${idx + 1}. ${str(r.name)}`, t:"s",
      s: { font:{ name:"Calibri", sz:13, bold:true, color:{ rgb:"FFFFFF" } },
           fill:{ fgColor:{ rgb:"1B3A5C" }, patternType:"solid" },
           alignment:{ vertical:"center" } } };
    // Merge nombre sobre columnas A-D
    // Se añadirá luego en merges

    row++;

    // ── Datos básicos ──
    const basics = [
      ["⏱ Preparación", str(r.prepTime) || "—"],
      ["🔥 Cocción",     str(r.cookTime) || "—"],
      ["🍽️ Porciones",   str(r.portions) || "—"],
    ];
    basics.forEach(([label, val]) => {
      ws[`A${row}`] = { v: label, t:"s", s: hdrStyle("D4721A") };
      ws[`B${row}`] = { v: val,   t:"s", s: cellStyle({ fill:"FEF9F0" }) };
      row++;
    });

    // ── Descripción ──
    if (r.description) {
      ws[`A${row}`] = { v: "📝 Descripción", t:"s", s: hdrStyle("2C5F8A") };
      row++;
      ws[`A${row}`] = { v: str(r.description), t:"s", s: cellStyle({ fill:"F0F6FF", sz:10 }) };
      row++;
    }

    // ── Ingredientes ──
    ws[`A${row}`] = { v: "🥕 Ingredientes", t:"s", s: hdrStyle("2C5F8A") };
    row++;
    if (r.ingredients && r.ingredients.length > 0) {
      // Encabezados de ingredientes
      ws[`A${row}`] = { v: "CANTIDAD", t:"s", s: hdrStyle("D4A574", "1B3A5C") };
      ws[`B${row}`] = { v: "UNIDAD",   t:"s", s: hdrStyle("D4A574", "1B3A5C") };
      ws[`C${row}`] = { v: "INGREDIENTE", t:"s", s: hdrStyle("D4A574", "1B3A5C") };
      row++;
      r.ingredients.forEach((ing, i) => {
        const bg = i % 2 === 0 ? "FFFFFF" : "FDF8F2";
        ws[`A${row}`] = { v: str(ing.quantity), t:"s", s: cellStyle({ fill: bg, center:true }) };
        ws[`B${row}`] = { v: str(ing.unit),     t:"s", s: cellStyle({ fill: bg, center:true }) };
        ws[`C${row}`] = { v: str(ing.name || ing), t:"s", s: cellStyle({ fill: bg }) };
        row++;
      });
    } else {
      ws[`A${row}`] = { v: "Sin ingredientes registrados", t:"s", s: cellStyle({ fill:"FFFFFF", color:"AAAAAA" }) };
      row++;
    }

    // ── Preparación ──
    if (r.preparation) {
      ws[`A${row}`] = { v: "🍳 Preparación", t:"s", s: hdrStyle("2C5F8A") };
      row++;
      ws[`A${row}`] = { v: str(r.preparation), t:"s", s: cellStyle({ fill:"FFFFFF", sz:10 }) };
      row++;
    }

    // ── Recomendaciones ──
    if (r.recommendations) {
      ws[`A${row}`] = { v: "💡 Recomendaciones del Chef", t:"s", s: hdrStyle("27AE60") };
      row++;
      ws[`A${row}`] = { v: str(r.recommendations), t:"s", s: cellStyle({ fill:"F0FFF5", sz:10 }) };
      row++;
    }

    // ── Aprende a vender ──
    if (r.salesPitch) {
      ws[`A${row}`] = { v: "🎯 Aprende a Vender", t:"s", s: hdrStyle("8E44AD") };
      row++;
      ws[`A${row}`] = { v: str(r.salesPitch), t:"s", s: cellStyle({ fill:"F9F0FF", sz:10 }) };
      row++;
    }

    // ── Video ──
    if (r.video) {
      ws[`A${row}`] = { v: "🎥 Video: " + str(r.video), t:"s", s: cellStyle({ fill:"EEF8FF", color:"1B3A5C" }) };
      row++;
    }

    // ── Espacio entre recetas ──
    ws[`A${row}`] = { v: "", t:"s" };
    row++;

    // Merge del nombre de la receta sobre A-D
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s:{ r: baseRow - 1, c:0 }, e:{ r: baseRow - 1, c:3 } });

    // Merge de celdas de texto largo (descripción, preparación, etc.)
    // Las añadimos dinámicamente según las filas generadas
  });

  // Merge de columnas A-D para celdas de texto largo (descripción, preparación, etc.)
  // Recorremos y hacemos merge de todo lo que no sea tabla de ingredientes
  if (!ws["!merges"]) ws["!merges"] = [];

  ws["!ref"] = `A1:D${row}`;
  ws["!cols"] = [
    { wch: 20 },  // A
    { wch: 22 },  // B
    { wch: 22 },  // C
    { wch: 22 },  // D
  ];
  return ws;
}

// ── Función principal de exportación ─────────────────────────────

export async function exportToExcel(recipes, brandName = "Recetario") {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  // Hoja 1: Índice
  const wsIndex = buildIndex(recipes, brandName, XLSX);
  XLSX.utils.book_append_sheet(wb, wsIndex, "📋 Índice");

  // Hojas por categoría
  const byCategory = {};
  recipes.forEach(r => {
    const cat = r.category || "Sin categoría";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  });

  Object.entries(byCategory).forEach(([cat, recs]) => {
    const ws = buildCategorySheet(recs, XLSX);
    const sheetName = cat.substring(0, 28).replace(/[:\\/?*[\]]/g, "");
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const fileName = `${brandName.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim() || "Recetario"}_${new Date().getFullYear()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
