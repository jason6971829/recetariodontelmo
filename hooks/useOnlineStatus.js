"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getQueue, removeFromQueue } from "@/lib/offlineQueue";
import { supabase } from "@/lib/supabase";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const retryRef = useRef(null);
  const retryDelayRef = useRef(2000); // backoff inicial 2s

  const syncQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) { retryDelayRef.current = 2000; return; }

    setSyncing(true);
    let synced = 0;
    let failed = 0;

    for (const op of queue) {
      try {
        if (op.type === "upsert_recipe") {
          const { error } = await supabase.from("recipes").upsert(op.data, { onConflict: "id" });
          if (!error) { removeFromQueue(op.id); synced++; } else failed++;
        } else if (op.type === "insert_recipe") {
          const row = { ...op.data };
          delete row.tempId; delete row.id;
          const { error } = await supabase.from("recipes").insert(row);
          if (!error) { removeFromQueue(op.id); synced++; } else failed++;
        } else if (op.type === "delete_recipe") {
          const { error } = await supabase.from("recipes").delete().eq("id", op.data.id);
          if (!error) { removeFromQueue(op.id); synced++; } else failed++;
        }
      } catch { failed++; }
    }

    setPendingCount(getQueue().length);
    setSyncing(false);

    if (synced > 0) console.log(`✅ ${synced} operaciones sincronizadas`);

    // Exponential backoff si hay fallos: 2s → 4s → 8s → … hasta 5 min
    if (failed > 0 && navigator.onLine) {
      clearTimeout(retryRef.current);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 5 * 60 * 1000);
      retryRef.current = setTimeout(syncQueue, retryDelayRef.current);
    } else {
      retryDelayRef.current = 2000; // reset al tener éxito
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setOnline(navigator.onLine);
    setPendingCount(getQueue().length);

    const goOnline = () => {
      setOnline(true);
      retryDelayRef.current = 2000; // reset backoff al reconectar
      clearTimeout(retryRef.current);
      retryRef.current = setTimeout(syncQueue, 1000);
    };
    const goOffline = () => { setOnline(false); clearTimeout(retryRef.current); };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    if (navigator.onLine && getQueue().length > 0) syncQueue();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearTimeout(retryRef.current);
    };
  }, [syncQueue]);

  return { online, syncing, pendingCount, syncQueue };
}
