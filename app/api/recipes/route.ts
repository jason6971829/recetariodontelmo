import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint de lectura de recetas para integraciones externas (gabycontrol).
 *
 * Auth: header X-API-Key = process.env.RECETARIO_API_KEY
 *
 * Respuesta:
 *   200 → Array<Recipe>
 *   401 → header inválido o faltante
 *   500 → error de DB / config
 */
export async function GET(req: Request) {
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
    .select("id, name, category, portions, ingredients, published, created_at")
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const out = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    portions: r.portions,
    ingredients: r.ingredients,
    published: r.published,
    // recipes no tiene updated_at en su schema, usamos created_at como proxy
    updated_at: r.created_at,
  }));

  return NextResponse.json(out, {
    headers: { "Cache-Control": "no-store" },
  });
}
