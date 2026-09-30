import { requireClient } from './supabase';

/** Admin panel: members and their flows, read-only. */
export const ADMIN_PATH = '/yonetim';
/** Profile page (src/profile/ProfilePage.tsx): account details, sign out, delete account. */
export const PROFILE_PATH = '/profil';

/** Rows of the admin functions in supabase/migrations/0004_admin.sql. */
export type Member = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  flow_count: number;
  last_flow_at: string | null;
};

export type MemberFlow = { id: string; title: string; node_count: number; created_at: string; updated_at: string };

/** False for everyone but admins, and also when the migration hasn't been applied yet. */
export async function checkAdmin(): Promise<boolean> {
  const { data, error } = await requireClient().rpc('is_admin');
  return !error && data === true;
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await requireClient().rpc('admin_list_members');
  if (error) throw error;
  return data ?? [];
}

export async function listMemberFlows(memberId: string): Promise<MemberFlow[]> {
  const { data, error } = await requireClient().rpc('admin_list_member_flows', { member: memberId });
  if (error) throw error;
  return data ?? [];
}

/** Raw content of one flow for the read-only preview (supabase/migrations/0005_admin_flow.sql). */
export async function fetchMemberFlow(flowId: string): Promise<unknown> {
  const { data, error } = await requireClient().rpc('admin_get_flow', { flow: flowId });
  if (error) throw error;
  const row = (data as { content: unknown }[] | null)?.[0];
  if (!row) throw { code: 'PGRST116' };
  return row.content;
}
