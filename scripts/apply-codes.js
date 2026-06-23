// Script para reasignar los codigos FBH a los ingredientes de las recetas
// a partir del diccionario que esta en data/seed-recipes.js
//
// USO:
//   node scripts/apply-codes.js           → DRY RUN (no toca la DB, solo muestra)
//   node scripts/apply-codes.js --apply   → APLICA los cambios en Supabase
//
// Requiere variables de entorno en .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY

const fs = require("fs");
const path = require("path");

// Cargar .env.local manualmente (sin dotenv para no agregar dependencias)
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
  console.error("❌ Faltan variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

// Cargar seed recipes
const { SEED_RECIPES } = require("../data/seed-recipes.js");

// ── 1) Construir diccionario nombre → codigo ─────────────────────

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\*\s*\d+\s*(gr|g|kg|ml|l|und|unidad|unidades)?/gi, "") // quita *65gr
    .replace(/\s+/g, " ")
    .trim();
}

function nameVariants(name) {
  const base = normalizeName(name);
  const variants = new Set([base]);
  // Quitar prefijo "s. "
  if (base.startsWith("s. ")) variants.add(base.slice(3));
  // Agregar prefijo "s. " si no esta
  if (!base.startsWith("s. ")) variants.add("s. " + base);
  // Sin tildes
  const noAccents = base.normalize("NFD").replace(/[̀-ͯ]/g, "");
  variants.add(noAccents);
  return [...variants];
}

const dict = new Map(); // normalized name → { code, originalName }

// ── 1a) Cargar el catalogo FBH del Excel (si existe) ─────────────
const FBH_XLSX = "C:/Users/jjson/Downloads/FBHcontrol  Mana - 2026-06-22T104402.831.xlsx";
let fbhCount = 0;
if (fs.existsSync(FBH_XLSX)) {
  try {
    const XLSX = require("xlsx");
    const wb = XLSX.readFile(FBH_XLSX);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    rows.slice(3).forEach(r => {
      if (!r || r.length < 2) return;
      const nombre = r[0];
      const codigo = r[1];
      if (!nombre || typeof codigo !== "number") return;
      const codeStr = String(codigo);
      for (const v of nameVariants(nombre)) {
        if (!dict.has(v)) dict.set(v, { code: codeStr, originalName: nombre });
      }
      fbhCount++;
    });
    console.log(`📦 Catalogo FBH cargado: ${fbhCount} productos del Excel`);
  } catch (e) {
    console.warn("⚠️  No pude leer FBH Excel:", e.message);
  }
}

function extractNameFromIngredientText(text) {
  // Formato comun: "X UNIDAD - Nombre" o "X.X KILO - Nombre"
  const m = text.match(/^[\d.,]+\s+(?:KILO|KG|GRAMOS?|GR?|UNIDAD(?:ES)?|UND|LITRO|LT|ML|LIBRA|ONZA|PORCION)\s*-\s*(.+)$/i);
  if (m) return m[1].trim();
  // Sin formato: usar todo el texto
  return text.trim();
}

let seedTotalIngs = 0;
let seedWithCode = 0;
SEED_RECIPES.forEach(r => {
  r.ingredients.forEach(ing => {
    seedTotalIngs++;
    const m = String(ing).match(/^(.*?)\s*\|\s*(\d+)\s*$/);
    if (!m) return;
    seedWithCode++;
    const text = m[1].trim();
    const code = m[2];
    const name = extractNameFromIngredientText(text);
    // Guardar todas las variantes del nombre apuntando al mismo codigo
    for (const v of nameVariants(name)) {
      if (!dict.has(v)) dict.set(v, { code, originalName: name });
    }
  });
});

console.log("📚 Diccionario construido desde seed-recipes.js");
console.log(`   ${SEED_RECIPES.length} recetas, ${seedTotalIngs} ingredientes, ${seedWithCode} con codigo`);
console.log(`   ${dict.size} variantes de nombre indexadas\n`);

// ── 2) Conectar a Supabase ───────────────────────────────────────

async function fetchAllRecipes() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=id,name,ingredients&order=id.asc`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
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

// ── 3) Procesar cada receta ──────────────────────────────────────

function findCode(ingText) {
  const name = extractNameFromIngredientText(ingText);
  for (const v of nameVariants(name)) {
    if (dict.has(v)) return dict.get(v).code;
  }
  return null;
}

function processIngredient(ing) {
  // Si ya es objeto con codigo, dejarlo
  if (ing && typeof ing === "object") {
    if (ing.code) return { ing, changed: false, matched: true };
    // Objeto sin codigo: intentar matchear
    const code = findCode(ing.text || ing.name || "");
    if (code) return { ing: { ...ing, code }, changed: true, matched: true };
    return { ing, changed: false, matched: false };
  }
  // String: parsear y normalizar a objeto
  const s = String(ing).trim();
  // Si ya tiene codigo al final, parsear y dejarlo en objeto
  const mEnd = s.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  if (mEnd) {
    return { ing: { code: mEnd[2], text: mEnd[1].trim() }, changed: true, matched: true };
  }
  // Buscar codigo en el diccionario
  const code = findCode(s);
  if (code) return { ing: { code, text: s }, changed: true, matched: true };
  // Sin match: convertir a objeto sin codigo
  return { ing: { code: "", text: s }, changed: true, matched: false };
}

// ── 4) Main ──────────────────────────────────────────────────────

(async () => {
  console.log(`🔌 Conectando a ${SUPABASE_URL}`);
  console.log(`🚀 Modo: ${APPLY ? "APLICAR CAMBIOS" : "DRY RUN (solo simulacion)"}\n`);

  const recipes = await fetchAllRecipes();
  console.log(`📋 ${recipes.length} recetas cargadas\n`);

  let recipesChanged = 0;
  let ingsMatched = 0;
  let ingsUnmatched = 0;
  const unmatched = new Set();
  const sample = [];

  for (const r of recipes) {
    if (!Array.isArray(r.ingredients)) continue;
    let recipeChanged = false;
    const newIngs = r.ingredients.map(ing => {
      const { ing: newIng, changed, matched } = processIngredient(ing);
      if (changed) recipeChanged = true;
      if (matched) {
        ingsMatched++;
      } else if (typeof ing === "string" || (ing && typeof ing === "object" && !ing.code)) {
        ingsUnmatched++;
        const txt = typeof ing === "string" ? ing : (ing.text || ing.name || "");
        if (txt) unmatched.add(extractNameFromIngredientText(txt));
      }
      return newIng;
    });
    if (recipeChanged) {
      recipesChanged++;
      if (sample.length < 3) {
        sample.push({ id: r.id, name: r.name, before: r.ingredients, after: newIngs });
      }
      if (APPLY) {
        try {
          await updateRecipeIngredients(r.id, newIngs);
          process.stdout.write(".");
        } catch (e) {
          console.error(`\n❌ Error en receta ${r.id} "${r.name}": ${e.message}`);
        }
      }
    }
  }

  if (APPLY) console.log("");

  console.log("\n📊 Resumen:");
  console.log(`   Recetas modificadas: ${recipesChanged} / ${recipes.length}`);
  console.log(`   Ingredientes con codigo asignado: ${ingsMatched}`);
  console.log(`   Ingredientes sin match (quedan sin codigo): ${ingsUnmatched}`);

  if (unmatched.size > 0) {
    console.log(`\n⚠️  ${unmatched.size} ingredientes unicos sin codigo (primeros 20):`);
    [...unmatched].slice(0, 20).forEach(n => console.log(`   - ${n}`));
  }

  if (sample.length > 0 && !APPLY) {
    console.log("\n🔎 Muestra de 3 recetas modificadas (antes / despues):");
    sample.forEach(s => {
      console.log(`\n   📝 ${s.name} (id ${s.id})`);
      s.before.forEach((b, i) => {
        const a = s.after[i];
        const bStr = typeof b === "string" ? b : JSON.stringify(b);
        const aStr = JSON.stringify(a);
        console.log(`      ${bStr}\n        → ${aStr}`);
      });
    });
  }

  if (!APPLY) {
    console.log("\n👉 Para aplicar realmente los cambios:");
    console.log("   node scripts/apply-codes.js --apply");
  } else {
    console.log("\n✅ Cambios aplicados en Supabase.");
  }
})().catch(e => {
  console.error("\n❌ Error:", e.message);
  process.exit(1);
});
