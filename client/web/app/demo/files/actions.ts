"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const USER_BUCKET = "user-files";
const PUBLIC_BUCKET = "public-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 分

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

// 名前衝突を避けつつ安全な文字に正規化
function safeFilename(name: string) {
  const cleaned = name.replace(/[^\w.\-]+/g, "_");
  const stamp = Date.now().toString(36);
  return `${stamp}_${cleaned}`;
}

export async function uploadUserFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const { supabase, user } = await requireUser();
  const path = `${user.id}/${safeFilename(file.name)}`;

  const { error } = await supabase.storage
    .from(USER_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(error.message);
  revalidatePath("/demo/files");
}

export async function deleteUserFile(formData: FormData) {
  const path = String(formData.get("path") ?? "");
  if (!path) return;

  const { supabase, user } = await requireUser();
  // RLS でも防がれるが念のためクライアント側でも uid 配下か確認
  if (!path.startsWith(`${user.id}/`)) {
    throw new Error("permission denied");
  }

  const { error } = await supabase.storage.from(USER_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
  revalidatePath("/demo/files");
}

export async function createUserFileSignedUrl(path: string) {
  const { supabase, user } = await requireUser();
  if (!path.startsWith(`${user.id}/`)) {
    throw new Error("permission denied");
  }

  const { data, error } = await supabase.storage
    .from(USER_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function uploadPublicAsset(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const { supabase } = await requireUser();
  const path = safeFilename(file.name);

  const { error } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(error.message);
  revalidatePath("/demo/files");
}

export async function deletePublicAsset(formData: FormData) {
  const path = String(formData.get("path") ?? "");
  if (!path) return;

  const { supabase } = await requireUser();
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
  revalidatePath("/demo/files");
}
