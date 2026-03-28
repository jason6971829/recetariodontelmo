import { supabase } from "@/lib/supabase";
import { cacheRecipes, getCachedRecipes, cacheUsers, getCachedUsers, addToQueue, isOnline } from "@/lib/offlineQueue";

// ── Recetas ──────────────────────────────────────────────────────

export async function getRecipes() {
  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    const recipes = data.map(dbToRecipe);
    cacheRecipes(recipes); // Guardar en cache local
    return recipes;
  } catch (err) {
    console.error("getRecipes error:", err);
    // Si falla (offline), usar cache local
    const cached = getCachedRecipes();
    if (cached) { console.log("📦 Usando recetas del cache local"); return cached; }
    return null;
  }
}

export async function upsertRecipe(recipe) {
  const row = recipeToDb(recipe);
  try {
    const { data, error } = await supabase
      .from("recipes")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    const updated = dbToRecipe(data);
    // Actualizar cache local
    const cached = getCachedRecipes() || [];
    cacheRecipes(cached.map(r => r.id === updated.id ? updated : r));
    return updated;
  } catch (err) {
    console.error("upsertRecipe offline:", err);
    // Guardar en cola offline
    addToQueue({ type: "upsert_recipe", data: row });
    // Actualizar cache local
    const cached = getCachedRecipes() || [];
    const recipeData = dbToRecipe(row);
    cacheRecipes(cached.map(r => r.id === recipeData.id ? recipeData : r));
    return recipeData;
  }
}

export async function insertRecipe(recipe) {
  const row = recipeToDb(recipe);
  delete row.id;
  try {
    const { data, error } = await supabase
      .from("recipes")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    const newRecipe = dbToRecipe(data);
    const cached = getCachedRecipes() || [];
    cacheRecipes([...cached, newRecipe]);
    return newRecipe;
  } catch (err) {
    console.error("insertRecipe offline:", err);
    const tempId = Date.now();
    addToQueue({ type: "insert_recipe", data: { ...row, tempId } });
    const tempRecipe = dbToRecipe({ ...row, id: tempId });
    const cached = getCachedRecipes() || [];
    cacheRecipes([...cached, tempRecipe]);
    return tempRecipe;
  }
}

export async function deleteRecipe(id) {
  try {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) throw error;
    const cached = getCachedRecipes() || [];
    cacheRecipes(cached.filter(r => r.id !== id));
    return true;
  } catch (err) {
    console.error("deleteRecipe offline:", err);
    addToQueue({ type: "delete_recipe", data: { id } });
    const cached = getCachedRecipes() || [];
    cacheRecipes(cached.filter(r => r.id !== id));
    return true;
  }
}

// ── Usuarios ─────────────────────────────────────────────────────

export async function getUsers() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    cacheUsers(data);
    return data;
  } catch (err) {
    console.error("getUsers error:", err);
    const cached = getCachedUsers();
    if (cached) { console.log("📦 Usando usuarios del cache local"); return cached; }
    return null;
  }
}

export async function saveUsers(users) {
  // Obtener usuarios actuales para detectar eliminados
  const { data: existing } = await supabase.from("users").select("id");
  const existingIds = (existing || []).map(u => u.id);
  const newIds = users.filter(u => u.id).map(u => u.id);

  // Eliminar los que ya no están en la lista
  const toDelete = existingIds.filter(id => !newIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from("users").delete().in("id", toDelete);
  }

  // Upsert existentes (con id) y crear nuevos (sin id)
  for (const user of users) {
    if (user.id) {
      const { error } = await supabase.from("users").upsert(user, { onConflict: "id" });
      if (error) console.error("saveUsers upsert error:", error);
    } else {
      const { id, ...rest } = user;
      const { error } = await supabase.from("users").insert(rest);
      if (error) console.error("saveUsers insert error:", error);
    }
  }
  return true;
}

// ── Categorías ───────────────────────────────────────────────────

export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) { console.error("getCategories error:", error); return null; }
  return data;
}

export async function upsertCategory(category) {
  const { error } = await supabase
    .from("categories")
    .upsert(category, { onConflict: "id" });
  if (error) { console.error("upsertCategory error:", error); return false; }
  return true;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) { console.error("deleteCategory error:", error); return false; }
  return true;
}

// ── Configuración global (sincronizada en Supabase Storage) ──────

export async function saveWatermarkConfig(config) {
  try {
    const json = JSON.stringify(config);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload("watermark/config.json", bytes, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("saveWatermarkConfig error:", error); return false; }
    return true;
  } catch (err) { console.error("saveWatermarkConfig exception:", err); return false; }
}

export async function loadWatermarkConfig() {
  try {
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl("watermark/config.json");
    const res = await fetch(urlData.publicUrl + "?t=" + Date.now());
    if (!res.ok) return null;
    const config = await res.json();
    // Si no hay logo guardado, buscar si existe custom-watermark en storage
    if (!config.logo) {
      for (const ext of ["png", "jpg", "jpeg", "webp", "gif", "svg"]) {
        const path = `watermark/custom-watermark.${ext}`;
        const { data: imgUrl } = supabase.storage.from("recipe-images").getPublicUrl(path);
        try {
          const check = await fetch(imgUrl.publicUrl + "?t=" + Date.now(), { method: "HEAD" });
          if (check.ok) { config.logo = imgUrl.publicUrl; break; }
        } catch {}
      }
    }
    return config;
  } catch (err) { console.error("loadWatermarkConfig error:", err); return null; }
}

// ── Imágenes (Supabase Storage) ──────────────────────────────────

export async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `recipes/${fileName}`;

  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (error) { console.error("uploadImage error:", error); return null; }

  const { data: urlData } = supabase.storage
    .from("recipe-images")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export async function deleteImage(imageUrl) {
  if (!imageUrl) return;
  // Extraer path del URL: .../recipe-images/recipes/filename.jpg
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split("/recipe-images/");
    if (parts.length < 2) return;
    const filePath = parts[1];
    await supabase.storage.from("recipe-images").remove([filePath]);
  } catch {}
}

// ── Passkeys (acceso biométrico) ─────────────────────────────────

export async function savePasskey(credentialId, userId) {
  const { error } = await supabase
    .from("passkeys")
    .upsert({ credential_id: credentialId, user_id: userId }, { onConflict: "credential_id" });
  if (error) { console.error("savePasskey error:", error); return false; }
  return true;
}

export async function getPasskeyUser(credentialId) {
  const { data, error } = await supabase
    .from("passkeys")
    .select("user_id, users(*)")
    .eq("credential_id", credentialId)
    .single();
  if (error || !data) { console.error("getPasskeyUser error:", error); return null; }
  return data.users;
}

// ── Actividad (tracking) ─────────────────────────────────────────

export async function logActivity(userId, action, recipeName = null, category = null) {
  const { error } = await supabase
    .from("activity_log")
    .insert({ user_id: userId, action, recipe_name: recipeName, category });
  if (error) console.error("logActivity error:", error);
}

export async function getActivityReport() {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*, users(name, username, role, sede)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) { console.error("getActivityReport error:", error); return []; }
  return data;
}

// ── Banner de anuncios ────────────────────────────────────────────

export async function saveBannerConfig(config) {
  try {
    const json = JSON.stringify(config);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload("banner/config.json", bytes, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("saveBannerConfig error:", error); return false; }
    return true;
  } catch (err) { console.error("saveBannerConfig exception:", err); return false; }
}

export async function loadBannerConfig() {
  try {
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl("banner/config.json");
    const res = await fetch(urlData.publicUrl + "?t=" + Date.now());
    if (!res.ok) return null;
    return await res.json();
  } catch (err) { console.error("loadBannerConfig error:", err); return null; }
}

// ── Helpers de mapeo ─────────────────────────────────────────────

function dbToRecipe(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    prepTime: row.prep_time || "",
    cookTime: row.cook_time || "",
    portions: row.portions || "",
    ingredients: row.ingredients || [],
    preparation: row.preparation || "",
    recommendations: row.recommendations || "",
    image: row.image_url || null,
    video: row.video || "",
    description: row.description || "",
    salesPitch: row.sales_pitch || "",
    published: row.published || false,
  };
}

function recipeToDb(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    prep_time: recipe.prepTime || "",
    cook_time: recipe.cookTime || "",
    portions: recipe.portions || "",
    ingredients: recipe.ingredients || [],
    preparation: recipe.preparation || "",
    recommendations: recipe.recommendations || "",
    image_url: recipe.image || null,
    video: recipe.video || "",
    description: recipe.description || "",
    sales_pitch: recipe.salesPitch || "",
    published: recipe.published || false,
  };
}
