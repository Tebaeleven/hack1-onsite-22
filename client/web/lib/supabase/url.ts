// Supabase の base URL を正規化する。
// .env で末尾に "/rest/v1/" や "/" が付いていると supabase-js が
// "/rest/v1//rest/v1/..." と二重化して 404 になるため、ここで剥がす。
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
}
