import { NextResponse, after } from "next/server";

// Aviso de cambios a GabyControl (contrato v7, "Aviso de cambios v7").
// La app llama a esta ruta cuando una receta quedó guardada / publicada / borrada en Supabase.
// Responde al instante (202) y el POST a GabyControl sale en segundo plano con after():
// GabyControl tarda 10-20 s porque se trae todas las recetas, y el usuario no debe esperar eso.
// Si el aviso falla, el guardado ya quedó hecho: solo se registra en el log (GabyControl
// igual sincroniza una vez al día como red de seguridad).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // tiempo para que after() espere la respuesta de GabyControl

const GABY_URL = process.env.GABYCONTROL_API_URL || "https://gabycontrol.vercel.app";
const API_KEY = process.env.INSUMOS_API_KEY;
const MIN_GAP_MS = 10_000; // límite: un aviso cada 10 s por instancia (GabyControl también omite los < 10 s)
const TIMEOUT_MS = 30_000;
let lastAt = 0;

export async function POST(req) {
  let motivo = "";
  try { motivo = String((await req.json())?.motivo || "").slice(0, 200); } catch { /* sin cuerpo */ }

  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) {
    console.log(`[recetario-sync] omitido: llegó ${now - lastAt} ms después del anterior · motivo: ${motivo}`);
    return NextResponse.json({ ok: true, omitido: true }, { status: 202 });
  }
  if (!API_KEY) {
    console.error("[recetario-sync] no se avisó: INSUMOS_API_KEY no está configurada");
    return NextResponse.json({ ok: true, avisado: false }, { status: 202 });
  }
  lastAt = now;

  after(async () => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${GABY_URL}/api/recetario/sync`, {
        method: "POST",
        headers: { "X-API-Key": API_KEY },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = (await res.text()).slice(0, 500);
      const log = res.ok ? console.log : console.error;
      log(`[recetario-sync] GabyControl respondió ${res.status} en ${Date.now() - t0} ms · motivo: ${motivo} · ${body}`);
    } catch (e) {
      const why = e?.name === "TimeoutError" ? `timeout (${TIMEOUT_MS / 1000} s)` : `${e?.name || "Error"}: ${e?.message || e}`;
      console.error(`[recetario-sync] falló tras ${Date.now() - t0} ms · motivo: ${motivo} · ${why}`);
    }
  });

  return NextResponse.json({ ok: true, avisado: true }, { status: 202 });
}
