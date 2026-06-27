// Convierte todas las recetas de la DB a unidad base del kardex de gabycontrol.
// El kardex solo maneja KILO, LITRO, UNIDAD — todo lo demas (GRAMOS, ML, LIBRA, ONZA, PORCION)
// se convierte a decimal en la unidad base.
//
// USO:
//   node scripts/convert-units.js           → DRY RUN (no toca la DB)
//   node scripts/convert-units.js --apply   → aplica los cambios en Supabase
//
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY (o ANON).

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY en .env.local");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

// ── Conversiones a unidad base ─────────────────────────────────────

// Sinonimos -> unidad canonica
const UNIT_ALIASES = {
  KILO: "KILO", KG: "KILO", KILOS: "KILO", KILOGRAMO: "KILO", KILOGRAMOS: "KILO",
  GRAMOS: "GRAMOS", GRAMO: "GRAMOS", GR: "GRAMOS", G: "GRAMOS", GRS: "GRAMOS",
  LIBRA: "LIBRA", LIBRAS: "LIBRA", LB: "LIBRA", LBS: "LIBRA",
  ONZA: "ONZA", ONZAS: "ONZA", OZ: "ONZA",
  LITRO: "LITRO", LITROS: "LITRO", LT: "LITRO", L: "LITRO",
  ML: "ML", MILILITRO: "ML", MILILITROS: "ML", CC: "ML",
  UNIDAD: "UNIDAD", UNIDADES: "UNIDAD", UND: "UNIDAD", UN: "UNIDAD", U: "UNIDAD",
  PORCION: "PORCION", PORCIONES: "PORCION", PORC: "PORCION",
};

const TO_BASE = {
  KILO:    { base: "KILO",   factor: 1 },
  GRAMOS:  { base: "KILO",   factor: 0.001 },
  LIBRA:   { base: "KILO",   factor: 0.4536 },
  ONZA:    { base: "KILO",   factor: 0.02835 },
  LITRO:   { base: "LITRO",  factor: 1 },
  ML:      { base: "LITRO",  factor: 0.001 },
  UNIDAD:  { base: "UNIDAD", factor: 1 },
  PORCION: { base: "UNIDAD", factor: 1 },
};

function canonicalUnit(u) {
  return UNIT_ALIASES[String(u || "").toUpperCase().trim()] || null;
}

function formatQty(n) {
  if (!Number.isFinite(n)) return null;
  return Number(n).toFixed(4).replace(/\.?0+$/, "");
}

// Parsea "0.05 KILO - Carne" -> { qty: 0.05, unit: "KILO", rest: "Carne" }
// Devuelve null si no matchea el formato cantidad+unidad
function parseQtyUnit(text) {
  const m = String(text).trim().match(/^([\d.,]+)\s+([A-Za-z]+)\s*-\s*(.+)$/);
  if (!m) return null;
  const qty = Number(m[1].replace(",", "."));
  const unit = canonicalUnit(m[2]);
  if (!Number.isFinite(qty) || !unit) return null;
  return { qty, unit, rest: m[3].trim() };
}

// Convierte el texto "0.02 GRAMOS - Cebolla" -> "0.00002 KILO - Cebolla" (... wait no, 20g = 0.02 KILO).
// Ej real: "20 GRAMOS - Cebolla" -> "0.02 KILO - Cebolla".
function convertText(text) {
  const p = parseQtyUnit(text);
  if (!p) return { text, changed: false, reason: "no_match_format" };
  const conv = TO_BASE[p.unit];
  if (!conv) return { text, changed: false, reason: `unknown_unit_${p.unit}` };
  if (conv.base === p.unit && conv.factor === 1) {
    return { text, changed: false, reason: "already_base" };
  }
  const newQty = formatQty(p.qty * conv.factor);
  if (newQty == null) return { text, changed: false, reason: "bad_qty" };
  const newText = `${newQty} ${conv.base} - ${p.rest}`;
  return { text: newText, changed: true, fromUnit: p.unit, toUnit: conv.base };
}

// Procesa un ingrediente (string u objeto). Conserva su shape.
function processIngredient(ing) {
  if (ing && typeof ing === "object") {
    const text = ing.text || ing.name || "";
    const { text: newText, changed, reason, fromUnit, toUnit } = convertText(text);
    if (!changed) return { ing, changed: false, reason };
    return { ing: { ...ing, text: newText }, changed: true, fromUnit, toUnit };
  }
  const s = String(ing);
  // Si tiene "| codigo" al final, separamos para no romperlo
  const mEnd = s.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  if (mEnd) {
    const { text: newText, changed, reason, fromUnit, toUnit } = convertText(mEnd[1]);
    if (!changed) return { ing, changed: false, reason };
    return { ing: `${newText} | ${mEnd[2]}`, changed: true, fromUnit, toUnit };
  }
  // Sin codigo
  const { text: newText, changed, reason, fromUnit, toUnit } = convertText(s);
  if (!changed) return { ing, changed: false, reason };
  return { ing: newText, changed: true, fromUnit, toUnit };
}

// ── Supabase ───────────────────────────────────────────────────────

async function fetchAllRecipes() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=id,name,ingredients&order=id.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Fetch recipes failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function updateRecipeIngredients(id, ingredients) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ingredients }),
  });
  if (!res.ok) throw new Error(`Update recipe ${id} failed: ${res.status} ${await res.text()}`);
}

// ── Main ───────────────────────────────────────────────────────────

(async () => {
  console.log(`Conectando a ${SUPABASE_URL}`);
  console.log(`Modo: ${APPLY ? "APLICAR CAMBIOS" : "DRY RUN (solo simulacion)"}\n`);

  const recipes = await fetchAllRecipes();
  console.log(`${recipes.length} recetas cargadas\n`);

  let recipesChanged = 0;
  let ingsChanged = 0;
  const byConversion = {};   // "GRAMOS->KILO" -> count
  const sample = [];
  const skipped = {};        // reason -> count
  const unmatchedFormats = new Set();

  for (const r of recipes) {
    if (!Array.isArray(r.ingredients)) continue;
    let recipeChanged = false;
    const newIngs = r.ingredients.map(ing => {
      const res = processIngredient(ing);
      if (res.changed) {
        recipeChanged = true;
        ingsChanged++;
        const key = `${res.fromUnit}->${res.toUnit}`;
        byConversion[key] = (byConversion[key] || 0) + 1;
      } else if (res.reason) {
        skipped[res.reason] = (skipped[res.reason] || 0) + 1;
        if (res.reason === "no_match_format") {
          const txt = typeof ing === "string" ? ing : (ing?.text || ing?.name || "");
          if (txt) unmatchedFormats.add(txt.slice(0, 60));
        }
      }
      return res.ing;
    });
    if (recipeChanged) {
      recipesChanged++;
      if (sample.length < 5) {
        sample.push({ id: r.id, name: r.name, before: r.ingredients, after: newIngs });
      }
      if (APPLY) {
        try {
          await updateRecipeIngredients(r.id, newIngs);
          process.stdout.write(".");
        } catch (e) {
          console.error(`\nError en receta ${r.id} "${r.name}": ${e.message}`);
        }
      }
    }
  }
  if (APPLY) console.log("");

  console.log("\nResumen:");
  console.log(`  Recetas modificadas: ${recipesChanged} / ${recipes.length}`);
  console.log(`  Ingredientes convertidos: ${ingsChanged}`);
  console.log(`  Conversiones aplicadas:`);
  Object.entries(byConversion).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    console.log(`    ${k.padEnd(20)} ${v}`);
  });

  if (Object.keys(skipped).length) {
    console.log(`\nIngredientes sin cambios (por motivo):`);
    Object.entries(skipped).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
      console.log(`    ${k.padEnd(25)} ${v}`);
    });
  }

  if (unmatchedFormats.size > 0 && !APPLY) {
    console.log(`\n${unmatchedFormats.size} formatos no reconocidos (primeros 15):`);
    [...unmatchedFormats].slice(0, 15).forEach(t => console.log(`   - ${t}`));
  }

  if (sample.length && !APPLY) {
    console.log("\nMuestra de recetas modificadas (antes / despues):");
    sample.forEach(s => {
      console.log(`\n  ${s.name} (id ${s.id})`);
      s.before.forEach((b, i) => {
        const a = s.after[i];
        const bStr = typeof b === "string" ? b : JSON.stringify(b);
        const aStr = typeof a === "string" ? a : JSON.stringify(a);
        if (bStr !== aStr) console.log(`    ${bStr}\n      -> ${aStr}`);
      });
    });
  }

  console.log(APPLY
    ? "\n✅ Cambios aplicados."
    : "\nPara aplicar realmente: node scripts/convert-units.js --apply");
})().catch(e => {
  console.error("\nError:", e.message);
  process.exit(1);
});
