import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type OrgKind = "business" | "organizer" | "gov";

export type Organization = {
  id: string;
  ownerId: string;
  name: string;
  kind: OrgKind;
  verified: boolean;
  createdAt: string;
};

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];

function rowToOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    kind: (row.kind as OrgKind) ?? "business",
    verified: row.verified,
    createdAt: row.created_at,
  };
}

export async function getMyOrganization(
  ownerId: string
): Promise<Organization | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) {
    console.error("[organizations] get", error.message);
    return null;
  }
  return data ? rowToOrg(data as OrgRow) : null;
}

export async function listOrganizationsByOwners(
  ownerIds: string[]
): Promise<Record<string, Organization>> {
  if (ownerIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .in("owner_id", ownerIds);
  if (error) {
    console.error("[organizations] listByOwners", error.message);
    return {};
  }
  const map: Record<string, Organization> = {};
  for (const row of (data ?? []) as OrgRow[]) {
    map[row.owner_id] = rowToOrg(row);
  }
  return map;
}

export async function upsertMyOrganization(
  ownerId: string,
  patch: { name?: string; kind?: OrgKind }
): Promise<Organization | null> {
  const supabase = createClient();
  const existing = await getMyOrganization(ownerId);
  if (existing) {
    const update: Database["public"]["Tables"]["organizations"]["Update"] = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.kind !== undefined) update.kind = patch.kind;
    const { data, error } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) {
      console.error("[organizations] update", error.message);
      return null;
    }
    return rowToOrg(data as OrgRow);
  }
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      owner_id: ownerId,
      name: patch.name ?? "",
      kind: patch.kind ?? "business",
    })
    .select("*")
    .single();
  if (error) {
    console.error("[organizations] insert", error.message);
    return null;
  }
  return rowToOrg(data as OrgRow);
}

// デモ用「自己認証」: ボタンで verified=true にする (本来はメール/ドメイン認証)
export async function selfVerifyMyOrganization(
  ownerId: string
): Promise<Organization | null> {
  const supabase = createClient();
  const existing = await getMyOrganization(ownerId);
  if (!existing) return null;
  const { data, error } = await supabase
    .from("organizations")
    .update({ verified: true })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) {
    console.error("[organizations] verify", error.message);
    return null;
  }
  return rowToOrg(data as OrgRow);
}
