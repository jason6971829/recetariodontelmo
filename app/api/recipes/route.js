import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ingredientToString } from "@/lib/ingredients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint de lectura de recetas para integraciones externas (gabycontrol).
 *
 * Auth: header X-API-Key = process.env.RECETARIO_API_KEY
 *
 * Respuesta:
 *   200 → Array<Recipe>  (contrato v6: incluye description, preparation, recommendations,
 *         selling_tips, image_url, video_url, prep_time, cook_time — null si estan vacios)
 *   401 → header inválido o faltante
 *   500 → error de DB / config
 */
export async function GET(req) {
  const expected = process.env.RECETARIO_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "RECETARIO_API_KEY no está configurada en el servidor" },
      { status: 500 }
    );
  }

  const provided = req.headers.get("x-api-key");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase no configurada (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, category, portions, ingredients, published, created_at, barcode, description, preparation, recommendations, sales_pitch, image_url, video, prep_time, cook_time")
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Texto opcional: sin espacios sobrantes y null si esta vacio (contrato v6)
  const txt = (v) => {
    const t = typeof v === "string" ? v.trim() : "";
    return t ? t : null;
  };

  // Cada ingrediente sale como string canonico: "cant UNIDAD - nombre | codigo"
  // (gabycontrol espera STRINGS, no objetos). El "|" solo aparece antes del codigo.
  const out = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    portions: r.portions,
    ingredients: Array.isArray(r.ingredients)
      ? r.ingredients.map(ingredientToString).filter(Boolean)
      : [],
    published: r.published,
    // barcode del producto (contrato v5): gabycontrol vincula por aqui, no por nombre
    barcode: r.barcode || null,
    // Contenido de la ficha (contrato v6): null si esta vacio
    description: txt(r.description),
    preparation: txt(r.preparation),
    recommendations: txt(r.recommendations),
    selling_tips: txt(r.sales_pitch),   // "Aprende a vender"
    image_url: txt(r.image_url),
    video_url: txt(r.video),
    prep_time: txt(r.prep_time),
    cook_time: txt(r.cook_time),
    // recipes no tiene updated_at, usamos created_at como proxy
    updated_at: r.created_at,
  }));

  return NextResponse.json(out, {
    headers: { "Cache-Control": "no-store" },
  });
}
