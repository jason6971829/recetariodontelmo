import { supabase } from "@/lib/supabase";

// ── Recetas ──────────────────────────────────────────────────────

export async function getRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("id", { ascending: true });
  if (error) { console.error("getRecipes error:", error); return null; }
  // Mapear snake_case de DB a camelCase de la app
  return data.map(dbToRecipe);
}

export async function upsertRecipe(recipe) {
  const row = recipeToDb(recipe);
  const { data, error } = await supabase
    .from("recipes")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) { console.error("upsertRecipe error:", error); return null; }
  return dbToRecipe(data);
}

export async function insertRecipe(recipe) {
  const row = recipeToDb(recipe);
  delete row.id; // Let DB auto-generate
  const { data, error } = await supabase
    .from("recipes")
    .insert(row)
    .select()
    .single();
  if (error) { console.error("insertRecipe error:", error); return null; }
  return dbToRecipe(data);
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) console.error("deleteRecipe error:", error);
  return !error;
}

// ── Usuarios ─────────────────────────────────────────────────────

export async function getUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("id", { ascending: true });
  if (error) { console.error("getUsers error:", error); return null; }
  return data;
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
  };
}
