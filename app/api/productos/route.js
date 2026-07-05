// Proxy al endpoint de productos unificados de gabycontrol (contrato v4).
// Devuelve la lista de productos del menu con { nombre, categoria, tiene_receta }
// para el selector de titulo de receta. Misma X-API-Key que /api/insumos.

export const revalidate = 300; // 5 min

const GABY_URL = process.env.GABYCONTROL_API_URL || "https://gabycontrol.vercel.app";
const API_KEY  = process.env.INSUMOS_API_KEY;

export async function GET() {
  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: "INSUMOS_API_KEY no configurada en el servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch(`${GABY_URL}/api/productos`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(
        JSON.stringify({ error: `Gabycontrol respondio ${res.status}`, details: body.slice(0, 500) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "No pude conectar con gabycontrol", details: String(err?.message || err) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
