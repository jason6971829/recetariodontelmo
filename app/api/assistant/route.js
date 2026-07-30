import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { normalizeIngredient } from "@/lib/ingredients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo. Haiku es barato/rapido y sobra para un bot de recetas.
// Subir a "claude-sonnet-5" o "claude-opus-5" si se quiere mas calidad.
const MODEL = "claude-haiku-4-5";

// ── Cache del catalogo de recetas (5 min) para no pegarle a la DB en cada pregunta
let _catalogCache = null;
let _catalogAt = 0;
const CATALOG_TTL = 5 * 60 * 1000;

function normText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function loadRecipes() {
  if (_catalogCache && Date.now() - _catalogAt < CATALOG_TTL) return _catalogCache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("recipes")
    .select("id, name, category, subcategory, portions, ingredients, published")
    .order("name");
  const recipes = (data || []).map((r) => ({
    name: r.name,
    category: r.category,
    subcategory: r.subcategory || "",
    portions: r.portions || "",
    published: r.published,
    ings: Array.isArray(r.ingredients)
      ? r.ingredients.map((i) => normalizeIngredient(i).text).filter(Boolean)
      : [],
    _search: normText(
      [r.name, r.category, r.subcategory, ...(Array.isArray(r.ingredients) ? r.ingredients.map((i) => normalizeIngredient(i).text) : [])].join(" ")
    ),
  }));
  _catalogCache = recipes;
  _catalogAt = Date.now();
  return recipes;
}

// Indice compacto (nombre por categoria) — va en el bloque cacheado del system
function buildIndex(recipes) {
  const byCat = {};
  for (const r of recipes) {
    (byCat[r.category] = byCat[r.category] || []).push(r.name);
  }
  return Object.entries(byCat)
    .map(([cat, names]) => `## ${cat} (${names.length})\n${names.join(", ")}`)
    .join("\n\n");
}

// Longitud del prefijo comun entre dos strings (para tolerar typos como
// "hawaiana" vs "hawaina": comparten "hawai" = 5).
function sharedPrefix(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Emparejamiento tolerante: la palabra de la pregunta matchea un texto si es
// substring, o si comparte un prefijo largo con alguna palabra del texto
// (cubre typos y plurales: hawaiana/hawaina, lasagna/lasaña, etc.)
function fuzzyHit(word, text) {
  if (text.includes(word)) return true;
  if (word.length < 4) return false;
  for (const tok of text.split(/[^a-z0-9]+/)) {
    if (tok.length < 4) continue;
    if (tok.includes(word) || word.includes(tok)) return true;
    const sp = sharedPrefix(word, tok);
    if (sp >= 4 && sp >= Math.min(word.length, tok.length) - 2) return true;
  }
  return false;
}

// Recupera las recetas mas relevantes a la pregunta (con ingredientes completos)
function retrieve(recipes, question, limit = 30) {
  const q = normText(question);
  const stop = new Set(["que","lleva","tiene","como","para","del","los","las","una","cuanto","cuanta","cuantos","cuantas","hago","hacer","receta","recetas","ingrediente","ingredientes","porcion","porciones"]);
  const words = q.split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w));
  if (!words.length) return [];
  const scored = [];
  for (const r of recipes) {
    const nm = normText(r.name), cat = normText(r.category);
    let score = 0;
    for (const w of words) {
      if (fuzzyHit(w, nm)) score += 5;
      else if (fuzzyHit(w, cat)) score += 2;
      else if (fuzzyHit(w, r._search)) score += 1;
    }
    if (score > 0) scored.push({ r, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.r);
}

function recipeDetail(r) {
  const head = `### ${r.name}  [${r.category}${r.subcategory ? " / " + r.subcategory : ""}]${r.portions ? " — rinde " + r.portions : ""}`;
  const body = r.ings.length ? r.ings.map((t) => `- ${t}`).join("\n") : "- (sin ingredientes cargados)";
  return `${head}\n${body}`;
}

const APP_HELP = `
CÓMO USAR EL RECETARIO (para ayudar al usuario):
- Categorías: en la barra lateral izquierda; "Todas" muestra el menú (no incluye Recetas Bodega).
- Buscar: la barra de búsqueda arriba filtra por nombre, categoría e ingredientes.
- Crear receta: botón "+" (o "Nueva Categoría" para categorías). El título se elige de un selector de productos; los ingredientes con un selector de insumos (busca por nombre o código). No hay botón "Guardar": se autoguarda solo al escribir, como Google Drive.
- Editar: se abre la ficha y se toca "Editar" (solo admin).
- Recetas Bodega: módulo aparte (botón 🏭 arriba de Categorías). Son subrecetas de producción (marinado/empacado) que usa GabyControl. Solo lo ven admin o usuarios con permiso "bodega".
- Por completar: módulo 📝 (solo admin) — recetas-borrador sin ingredientes, listas para llenar.
- Manuales: botón 📚 arriba a la izquierda (documentos: identidad, servicio, higiene, protocolos).
- Calculadora Bambu A1: botón 🖨️ (costo de impresión 3D).
- Los ingredientes se guardan como "cantidad UNIDAD - nombre | código" y GabyControl los usa para descontar inventario.
`.trim();

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY no configurada en el servidor" }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) return Response.json({ error: "Faltan mensajes" }, { status: 400 });

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = typeof lastUser?.content === "string" ? lastUser.content : "";

  const recipes = await loadRecipes();
  const index = buildIndex(recipes);
  const matches = retrieve(recipes, question);
  const detailBlock = matches.length
    ? matches.map(recipeDetail).join("\n\n")
    : "(La pregunta no coincidió con recetas específicas; usá el índice de arriba para ubicar nombres.)";

  const systemCached = `Sos la asistente de cocina del Recetario Don Telmo. Respondés SOLO sobre las recetas del recetario y sobre cómo usar la app. Hablás en español, en tono cálido y directo, y sos concisa. Si te preguntan algo que no está en los datos, decilo claramente en vez de inventar. No des consejos médicos ni información fuera del recetario.

${APP_HELP}

ÍNDICE DE RECETAS (nombres por categoría):
${index}`;

  const systemDetail = `RECETAS RELEVANTES A LA PREGUNTA ACTUAL (con ingredientes):
${detailBlock}`;

  const client = new Anthropic();
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: systemCached, cache_control: { type: "ephemeral" } },
        { type: "text", text: systemDetail },
      ],
      messages: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: String(m.content || "") })),
    });
    const text = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return Response.json({ text: text || "No pude generar una respuesta." });
  } catch (err) {
    console.error("assistant error:", err);
    return Response.json({ error: "Error al consultar la asistente", details: String(err?.message || err) }, { status: 502 });
  }
}
