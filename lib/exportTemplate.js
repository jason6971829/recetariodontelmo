/**
 * exportTemplate.js
 * Genera una plantilla Excel lista para llenar y re-importar al recetario.
 * También sirve para exportar las recetas existentes en formato importable.
 */

import * as XLSX from "xlsx";

const ORANGE  = "D4721A";
const NAVY    = "1B3A5C";
const WHITE   = "FFFFFF";
const LGRAY   = "F5F0EA";
const YELLOW  = "FFF9E6";
const GREEN   = "E8F8EF";
const LBLUE   = "EEF4FF";

function s(font = {}, fill, align = {}) {
  return {
    font:      { name: "Calibri", sz: 11, ...font },
    fill:      fill ? { fgColor: { rgb: fill }, patternType: "solid" } : undefined,
    alignment: { wrapText: true, vertical: "top", horizontal: "left", ...align },
    border: {
      top:    { style: "thin", color: { rgb: "D0C8BE" } },
      bottom: { style: "thin", color: { rgb: "D0C8BE" } },
      left:   { style: "thin", color: { rgb: "D0C8BE" } },
      right:  { style: "thin", color: { rgb: "D0C8BE" } },
    },
  };
}

function hdr(fill = NAVY, color = WHITE, sz = 11) {
  return {
    font: { name: "Calibri", sz, bold: true, color: { rgb: color } },
    fill: { fgColor: { rgb: fill }, patternType: "solid" },
    alignment: { wrapText: true, vertical: "center", horizontal: "center" },
    border: {
      top:    { style: "medium", color: { rgb: "555555" } },
      bottom: { style: "medium", color: { rgb: "555555" } },
      left:   { style: "thin",   color: { rgb: "888888" } },
      right:  { style: "thin",   color: { rgb: "888888" } },
    },
  };
}

// ── Hoja de instrucciones ─────────────────────────────────────────

function buildInstructions(brandName, categories) {
  const ws = {};

  const lines = [
    ["", ""],
    [`  ${brandName} — PLANTILLA DE RECETAS`, ""],
    ["  Guía para llenar y cargar recetas en el sistema", ""],
    ["", ""],
    ["  ¿CÓMO FUNCIONA?", ""],
    ["  1. Ve a la hoja llamada  🍽️ RECETAS  (pestaña abajo)", ""],
    ["  2. Llena una fila por cada receta (la fila 2 es un ejemplo)", ""],
    ["  3. Guarda el archivo como .xlsx", ""],
    ["  4. En la app, ve a ⚙️ → Importar recetas → selecciona el archivo", ""],
    ["  5. ¡Listo! Todas las recetas se cargarán automáticamente", ""],
    ["", ""],
    ["  DESCRIPCIÓN DE CADA COLUMNA", ""],
    ["  A  NOMBRE         Nombre completo de la receta (obligatorio)", ""],
    ["  B  CATEGORÍA      Una de las categorías válidas (ver abajo)", ""],
    ["  C  PREPARACIÓN    Tiempo de preparación. Ej: 20 min", ""],
    ["  D  COCCIÓN        Tiempo de cocción. Ej: 45 min", ""],
    ["  E  PORCIONES      Número de porciones. Ej: 4 personas", ""],
    ["  F  DESCRIPCIÓN    Descripción atractiva del plato", ""],
    ["  G  INGREDIENTES   Un ingrediente por línea, formato:", ""],
    ["                    cantidad | unidad | nombre del ingrediente", ""],
    ["                    Ejemplo:", ""],
    ["                    200 | g | Harina de trigo", ""],
    ["                    3 | unidades | Huevos frescos", ""],
    ["                    100 | ml | Leche entera", ""],
    ["  H  PREPARACIÓN    Pasos de preparación (texto libre)", ""],
    ["  I  RECOMENDACIONES  Tips y recomendaciones del chef", ""],
    ["  J  APRENDE A VENDER  Texto para vender el plato al cliente", ""],
    ["  K  VIDEO          URL del video tutorial (opcional)", ""],
    ["", ""],
    ["  CATEGORÍAS VÁLIDAS", ""],
    ...categories.map(c => [`    • ${c}`, ""]),
    ["", ""],
    ["  ⚠️  IMPORTANTE", ""],
    ["  • No borres ni muevas los encabezados de la hoja RECETAS", ""],
    ["  • La fila de ejemplo (fila 2) puede borrarse antes de cargar", ""],
    ["  • Las imágenes NO se cargan por Excel, súbelas desde la app", ""],
  ];

  lines.forEach((([txt, _], i) => {
    const row = i + 1;
    const isTitleRow  = row === 2;
    const isSubtitle  = row === 3;
    const isSection   = [5, 12, 29 + categories.length, 33 + categories.length].includes(row);
    const isWarning   = row >= 34 + categories.length;

    ws[`A${row}`] = {
      v: txt, t: "s",
      s: isTitleRow  ? { font: { name:"Calibri", sz:16, bold:true, color:{ rgb:NAVY } }, fill:{ fgColor:{ rgb:LGRAY }, patternType:"solid" }, alignment:{ vertical:"center" } }
       : isSubtitle  ? { font: { name:"Calibri", sz:12, color:{ rgb:ORANGE } }, fill:{ fgColor:{ rgb:LGRAY }, patternType:"solid" } }
       : isSection   ? { font: { name:"Calibri", sz:12, bold:true, color:{ rgb:NAVY } }, fill:{ fgColor:{ rgb:"E8F0FB" }, patternType:"solid" } }
       : isWarning   ? { font: { name:"Calibri", sz:11, color:{ rgb:"C0392B" } } }
       : { font: { name:"Calibri", sz:11, color:{ rgb:"333333" } } },
    };
  }));

  ws["!ref"] = `A1:A${lines.length}`;
  ws["!cols"] = [{ wch: 80 }];
  ws["!rows"] = lines.map((_, i) => i === 1 ? { hpt: 30 } : { hpt: 18 });
  return ws;
}

// ── Hoja de recetas ───────────────────────────────────────────────

const COLUMNS = [
  { key: "name",            label: "NOMBRE *",           width: 28, fill: "FFF0E6", hint: "Nombre de la receta" },
  { key: "category",        label: "CATEGORÍA *",         width: 20, fill: "FFF0E6", hint: "Ver instrucciones" },
  { key: "prepTime",        label: "T. PREPARACIÓN",     width: 16, fill: LGRAY,    hint: "Ej: 20 min" },
  { key: "cookTime",        label: "T. COCCIÓN",         width: 16, fill: LGRAY,    hint: "Ej: 45 min" },
  { key: "portions",        label: "PORCIONES",          width: 14, fill: LGRAY,    hint: "Ej: 4 personas" },
  { key: "description",     label: "DESCRIPCIÓN",        width: 36, fill: LBLUE,    hint: "Descripción del plato" },
  { key: "ingredients",     label: "INGREDIENTES",       width: 38, fill: GREEN,    hint: "cantidad | unidad | nombre (una por línea)" },
  { key: "preparation",     label: "PREPARACIÓN",        width: 42, fill: WHITE,    hint: "Pasos de elaboración" },
  { key: "recommendations", label: "RECOMENDACIONES",    width: 36, fill: YELLOW,   hint: "Tips del chef" },
  { key: "salesPitch",      label: "APRENDE A VENDER",   width: 36, fill: "F5E6FF", hint: "Texto de venta" },
  { key: "video",           label: "VIDEO (URL)",        width: 32, fill: LGRAY,    hint: "https://..." },
];

const COL_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K"];

function recipeToRow(r) {
  const ingredients = (r.ingredients || [])
    .map(ing => `${ing.quantity || ""} | ${ing.unit || ""} | ${ing.name || ""}`.trim())
    .join("\n");
  return [
    r.name            || "",
    r.category        || "",
    r.prepTime        || "",
    r.cookTime        || "",
    r.portions        || "",
    r.description     || "",
    ingredients,
    r.preparation     || "",
    r.recommendations || "",
    r.salesPitch      || "",
    r.video           || "",
  ];
}

const EXAMPLE_ROW = [
  "Crema de Tomate",
  "Sopas",
  "15 min",
  "30 min",
  "6 personas",
  "Deliciosa crema de tomate natural con toque de albahaca fresca, perfecta como entrada elegante.",
  "800 | g | Tomates maduros\n1 | unidad | Cebolla\n3 | dientes | Ajo\n200 | ml | Crema de leche\n1 | cdta | Albahaca seca",
  "1. Sofreír cebolla y ajo en aceite de oliva.\n2. Agregar tomates picados y cocinar 20 min.\n3. Licuar y colar.\n4. Añadir crema, salpimentar y servir.",
  "Servir con crutones tostados y un hilo de aceite de oliva extra virgen. Puede prepararse con 24 h de anticipación.",
  "Ideal para reuniones y eventos. 'Esta crema es nuestra entrada estrella, los clientes siempre preguntan por la receta'.",
  "",
];

export function exportTemplate(recipes = [], brandName = "Recetario", categories = []) {
  const wb = XLSX.utils.book_new();

  // ── Hoja de instrucciones ──
  const wsInstr = buildInstructions(brandName, categories);
  XLSX.utils.book_append_sheet(wb, wsInstr, "📖 INSTRUCCIONES");

  // ── Hoja de recetas ──
  const ws = {};

  // Fila 1: título general
  ws["A1"] = { v: `${brandName} — Plantilla de Recetas | NO borrar encabezados (fila 3)`, t:"s",
    s: { font:{ name:"Calibri", sz:12, bold:true, color:{ rgb:WHITE } },
         fill:{ fgColor:{ rgb:NAVY }, patternType:"solid" },
         alignment:{ horizontal:"center", vertical:"center" } } };

  // Fila 2: sub-header con colores por tipo de columna
  const colGroups = [
    { label:"DATOS BÁSICOS (obligatorios)", cols:[0,1], fill:ORANGE },
    { label:"TIEMPOS Y PORCIONES",          cols:[2,3,4], fill:"888888" },
    { label:"CONTENIDO DE LA RECETA",       cols:[5,6,7,8,9,10], fill:"2C5F8A" },
  ];
  colGroups.forEach(g => {
    g.cols.forEach((ci, li) => {
      ws[`${COL_LETTERS[ci]}2`] = {
        v: li === 0 ? g.label : "",
        t:"s",
        s: { font:{ name:"Calibri", sz:9, bold:true, color:{ rgb:WHITE } },
             fill:{ fgColor:{ rgb:g.fill }, patternType:"solid" },
             alignment:{ horizontal:"center", vertical:"center" } },
      };
    });
  });

  // Fila 3: encabezados de columnas
  COLUMNS.forEach((col, ci) => {
    ws[`${COL_LETTERS[ci]}3`] = { v: col.label, t:"s", s: hdr(NAVY, WHITE, 11) };
  });

  // Fila 4: hints (texto de ayuda en gris)
  COLUMNS.forEach((col, ci) => {
    ws[`${COL_LETTERS[ci]}4`] = { v: col.hint, t:"s",
      s: { font:{ name:"Calibri", sz:9, italic:true, color:{ rgb:"AAAAAA" } },
           fill:{ fgColor:{ rgb:"FAFAFA" }, patternType:"solid" },
           alignment:{ horizontal:"center", vertical:"center" } } };
  });

  // Fila 5: ejemplo (en color suave para distinguirlo)
  EXAMPLE_ROW.forEach((val, ci) => {
    ws[`${COL_LETTERS[ci]}5`] = { v: val, t:"s",
      s: { font:{ name:"Calibri", sz:10, italic:true, color:{ rgb:"999999" } },
           fill:{ fgColor:{ rgb:"F9F6F2" }, patternType:"solid" },
           alignment:{ wrapText:true, vertical:"top" },
           border:{ top:{ style:"dashed", color:{ rgb:"CCCCCC" } }, bottom:{ style:"dashed", color:{ rgb:"CCCCCC" } },
                    left:{ style:"dashed", color:{ rgb:"CCCCCC" } }, right:{ style:"dashed", color:{ rgb:"CCCCCC" } } } } };
  });
  // Nota en la columna L de la fila 5
  ws["L5"] = { v: "← EJEMPLO (puedes borrar esta fila)", t:"s",
    s: { font:{ name:"Calibri", sz:9, bold:true, color:{ rgb:ORANGE } } } };

  // Filas de datos: recetas existentes (desde fila 6)
  const dataStart = 6;
  if (recipes.length > 0) {
    recipes.forEach((r, i) => {
      const row = dataStart + i;
      const even = i % 2 === 0;
      const vals = recipeToRow(r);
      vals.forEach((val, ci) => {
        ws[`${COL_LETTERS[ci]}${row}`] = { v: val, t:"s",
          s: s({ sz:11 }, even ? COLUMNS[ci].fill : "FEFCF9") };
      });
    });
  } else {
    // Filas vacías (10 filas en blanco para llenar)
    for (let i = 0; i < 10; i++) {
      const row = dataStart + i;
      const even = i % 2 === 0;
      COLUMNS.forEach((col, ci) => {
        ws[`${COL_LETTERS[ci]}${row}`] = { v: "", t:"s",
          s: s({ sz:11 }, even ? col.fill : "FEFCF9") };
      });
    }
  }

  const lastRow = dataStart + Math.max(recipes.length, 10);
  ws["!ref"] = `A1:L${lastRow}`;

  // Merge del título (fila 1)
  ws["!merges"] = [
    { s:{ r:0, c:0 }, e:{ r:0, c:10 } },   // título
    { s:{ r:1, c:0 }, e:{ r:1, c:1  } },   // grupo básicos
    { s:{ r:1, c:2 }, e:{ r:1, c:4  } },   // grupo tiempos
    { s:{ r:1, c:5 }, e:{ r:1, c:10 } },   // grupo contenido
  ];

  ws["!cols"] = COLUMNS.map(c => ({ wch: c.width }));
  ws["!rows"] = [
    { hpt: 26 }, // fila 1 título
    { hpt: 16 }, // fila 2 grupos
    { hpt: 22 }, // fila 3 encabezados
    { hpt: 16 }, // fila 4 hints
    { hpt: 80 }, // fila 5 ejemplo
    ...Array(Math.max(recipes.length, 10)).fill({ hpt: 72 }), // datos
  ];

  // Fijar las primeras 3 filas al hacer scroll
  ws["!freeze"] = { xSplit: 0, ySplit: 3 };

  XLSX.utils.book_append_sheet(wb, ws, "🍽️ RECETAS");

  // Descargar
  const fileName = `Plantilla_${brandName.replace(/[^a-z0-9áéíóúñ ]/gi,"").trim() || "Recetario"}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
