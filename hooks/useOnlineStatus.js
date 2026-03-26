"use client";
import { useState, useEffect, useCallback } from "react";
import { getQueue, removeFromQueue } from "@/lib/offlineQueue";
import { supabase } from "@/lib/supabase";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const syncQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    let synced = 0;

    for (const op of queue) {
      try {
        if (op.type === "upsert_recipe") {
          const { error } = await supabase.from("recipes").upsert(op.data, { onConflict: "id" });
          if (!error) { removeFromQueue(op.id); synced++; }
        } else if (op.type === "insert_recipe") {
          const row = { ...op.data };
          delete row.tempId;
          delete row.id;
          const { error } = await supabase.from("recipes").insert(row);
          if (!error) { removeFromQueue(op.id); synced++; }
        } else if (op.type === "delete_recipe") {
          const { error } = await supabase.from("recipes").delete().eq("id", op.data.id);
          if (!error) { removeFromQueue(op.id); synced++; }
        }
      } catch {
        // Si falla, dejarlo en la cola
      }
    }

    setPendingCount(getQueue().length);
    setSyncing(false);

    if (synced > 0) {
      console.log(`✅ ${synced} operaciones sincronizadas`);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setOnline(navigator.onLine);
    setPendingCount(getQueue().length);

    const goOnline = () => {
      setOnline(true);
      // Sincronizar cola cuando vuelva la conexión
      setTimeout(syncQueue, 1000);
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Intentar sincronizar al cargar si hay cola pendiente
    if (navigator.onLine && getQueue().length > 0) {
      syncQueue();
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncQueue]);

  return { online, syncing, pendingCount, syncQueue };
}
