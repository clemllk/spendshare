/**
 * SpendShare — Main data hook
 * Handles: rooms, members, categories, transactions (encrypted), realtime sync
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { deriveRoomKey, encryptPayload, decryptPayload } from "./crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface TransactionPayload {
  amount: number;
  currency: string;
  note: string;
  date: string;
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId: string;
  date: string;
  // Decrypted fields (null until decrypted)
  amount?: number;
  currency?: string;
  note?: string;
  decrypted: boolean;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  color: string;
}

export function useSpendShare() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);

  // ── Auth helpers ──────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } }
    });
    if (error) throw error;
  }, []);

  // ── Room: create ──────────────────────────────────────────
  const createRoom = useCallback(async (name: string, displayName: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (roomErr) throw roomErr;

      // Add self as member
      await supabase.from("room_members").insert({
        room_id: room.id, user_id: user.id, display_name: displayName
      });

      // Derive crypto key from share code
      cryptoKeyRef.current = await deriveRoomKey(room.share_code);
      setRoomId(room.id);
      setShareCode(room.share_code);

      // Seed default categories
      await seedDefaultCategories(room.id, user.id);
      await loadRoomData(room.id, room.share_code);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Room: join by share code ──────────────────────────────
  const joinRoom = useCallback(async (code: string, displayName: string) => {
    setLoading(true);
    try {
      const { data: joinedRoomId, error } = await supabase
        .rpc("join_room_by_code", { p_code: code, p_display_name: displayName });

      if (error) throw error;

      cryptoKeyRef.current = await deriveRoomKey(code.toUpperCase());
      setRoomId(joinedRoomId);
      setShareCode(code.toUpperCase());
      await loadRoomData(joinedRoomId, code.toUpperCase());
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load room data ────────────────────────────────────────
  const loadRoomData = useCallback(async (rid: string, code: string) => {
    const key = cryptoKeyRef.current ?? await deriveRoomKey(code);
    cryptoKeyRef.current = key;

    // Members
    const { data: memberData } = await supabase
      .from("room_members")
      .select("user_id, display_name, color")
      .eq("room_id", rid);

    setMembers((memberData ?? []).map(m => ({
      userId: m.user_id, displayName: m.display_name, color: m.color
    })));

    // Categories
    const { data: catData } = await supabase
      .from("categories")
      .select("id, label, icon, color")
      .eq("room_id", rid);

    setCategories(catData ?? []);

    // Transactions — fetch encrypted, then decrypt
    const { data: txnData } = await supabase
      .from("transactions")
      .select("id, user_id, category_id, date_bucket, payload, iv")
      .eq("room_id", rid)
      .order("date_bucket", { ascending: false })
      .limit(200);

    if (txnData) {
      const decrypted = await Promise.all(
        txnData.map(async (t) => {
          try {
            const plain = await decryptPayload<TransactionPayload>(t.payload, t.iv, key);
            return {
              id: t.id, userId: t.user_id, categoryId: t.category_id,
              date: plain.date, amount: plain.amount,
              currency: plain.currency, note: plain.note,
              decrypted: true,
            } as Transaction;
          } catch {
            // Wrong key or corrupted — show placeholder
            return { id: t.id, userId: t.user_id, categoryId: t.category_id, date: t.date_bucket, decrypted: false } as Transaction;
          }
        })
      );
      setTransactions(decrypted);
    }
  }, []);

  // ── Realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!roomId || !shareCode) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "transactions",
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        setSyncing(true);
        if (payload.eventType === "INSERT") {
          const t = payload.new as any;
          const key = cryptoKeyRef.current;
          if (!key) return;
          try {
            const plain = await decryptPayload<TransactionPayload>(t.payload, t.iv, key);
            setTransactions(prev => [{
              id: t.id, userId: t.user_id, categoryId: t.category_id,
              date: plain.date, amount: plain.amount,
              currency: plain.currency, note: plain.note, decrypted: true
            }, ...prev]);
          } catch {}
        } else if (payload.eventType === "DELETE") {
          setTransactions(prev => prev.filter(t => t.id !== payload.old.id));
        }
        setTimeout(() => setSyncing(false), 800);
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "categories",
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const c = payload.new as any;
        setCategories(prev => [...prev, { id: c.id, label: c.label, icon: c.icon, color: c.color }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, shareCode]);

  // ── Add transaction ───────────────────────────────────────
  const addTransaction = useCallback(async (
    categoryId: string,
    data: TransactionPayload
  ) => {
    if (!roomId || !cryptoKeyRef.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSyncing(true);
    const { payload, iv } = await encryptPayload(data, cryptoKeyRef.current);

    const { error } = await supabase.from("transactions").insert({
      room_id: roomId,
      user_id: user.id,
      category_id: categoryId,
      payload, iv,
      date_bucket: data.date,
    });

    if (error) setError(error.message);
    setTimeout(() => setSyncing(false), 800);
  }, [roomId]);

  // ── Delete transaction ────────────────────────────────────
  const deleteTransaction = useCallback(async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
  }, []);

  // ── Add custom category ───────────────────────────────────
  const addCategory = useCallback(async (label: string, icon: string, color: string) => {
    if (!roomId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("categories").insert({ room_id: roomId, label, icon, color, created_by: user.id });
  }, [roomId]);

  return {
    roomId, shareCode, transactions, categories, members,
    loading, syncing, error,
    signIn, signUp, createRoom, joinRoom,
    addTransaction, deleteTransaction, addCategory,
  };
}

// ── Seed defaults ─────────────────────────────────────────
async function seedDefaultCategories(roomId: string, userId: string) {
  const defaults = [
    { label: "Food & Dining", icon: "🍽", color: "#F97316" },
    { label: "Transport", icon: "🚗", color: "#3B82F6" },
    { label: "Groceries", icon: "🛒", color: "#22C55E" },
    { label: "Shopping", icon: "🛍", color: "#EC4899" },
    { label: "Bills & Utilities", icon: "💡", color: "#EAB308" },
    { label: "Health", icon: "❤️", color: "#EF4444" },
    { label: "Entertainment", icon: "🎬", color: "#8B5CF6" },
    { label: "Travel", icon: "✈️", color: "#14B8A6" },
  ];
  await supabase.from("categories").insert(
    defaults.map(d => ({ ...d, room_id: roomId, created_by: userId, is_default: true }))
  );
}
