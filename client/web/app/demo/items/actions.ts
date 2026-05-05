"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function createItem(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim() || null;

  if (!title) return;

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("items")
    .insert({ user_id: user.id, title, content });

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/demo/items");
}

export async function updateItem(formData: FormData) {
  const idRaw = formData.get("id");
  const id = idRaw === null ? NaN : Number(idRaw);
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim() || null;

  if (!Number.isFinite(id) || !title) return;

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("items")
    .update({ title, content })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/demo/items");
}

export async function deleteItem(formData: FormData) {
  const idRaw = formData.get("id");
  const id = idRaw === null ? NaN : Number(idRaw);
  if (!Number.isFinite(id)) return;

  const { supabase } = await requireUser();
  const { error } = await supabase.from("items").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/demo/items");
}
