import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Con wifi caído o datos malos una consulta puede quedarse colgada minutos: se corta a tiempo
// y la app sigue con su copia local (lecturas 8 s, escrituras/subidas 45 s).
function fetchWithTimeout(input, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const ms = method === "GET" || method === "HEAD" ? 8000 : 45000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  if (init.signal) {
    if (init.signal.aborted) ctrl.abort();
    else init.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchWithTimeout } });
