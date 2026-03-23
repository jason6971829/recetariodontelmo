export async function storageGet(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}

export async function storageSet(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), true); } catch {}
}
