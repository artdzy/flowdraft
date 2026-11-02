import { t } from '../i18n';
import { siteOrigin } from './platform';
import { describeError } from './projects';
import { requireClient } from './supabase';

/** Flow sharing (supabase/migrations/0006_flow_sharing.sql): a /s/<token> link plus people added by email. */

export type ShareRole = 'viewer' | 'editor';
export type ShareVisibility = 'public' | 'private';
export type ShareMember = { email: string; role: ShareRole };
export type ShareSettings = { token: string; visibility: ShareVisibility; has_password: boolean; members: ShareMember[] };
export type SharedFlow = { id: string; title: string; updated_at: string; role: ShareRole; token: string };

/** What opening a link gives back. Only owners and editors learn the flow's id. */
export type SharedView =
  | { status: 'not_found' | 'password' | 'wrong_password' | 'locked' | 'invite_only' }
  | {
      status: 'ok';
      title: string;
      content: unknown;
      updated_at: string;
      role: 'owner' | ShareRole | 'link';
      project_id: string | null;
    };

const TOKEN_PATH = /^\/s\/([0-9a-f]{32})\/*$/;

export const shareTokenFromPath = (pathname: string) => TOKEN_PATH.exec(pathname)?.[1] ?? null;
export const shareUrl = (token: string) => `${siteOrigin}/s/${token}`;

export async function getShare(flow: string): Promise<ShareSettings | null> {
  const { data, error } = await requireClient().rpc('get_flow_share', { flow });
  if (error) throw error;
  return data;
}

/** A null password keeps the current one. */
export async function saveShare(
  flow: string,
  visibility: ShareVisibility,
  password: string | null,
  members: ShareMember[],
): Promise<ShareSettings> {
  const { data, error } = await requireClient().rpc('save_flow_share', {
    flow,
    new_visibility: visibility,
    new_password: password,
    new_members: members,
  });
  if (error) throw error;
  return data;
}

export async function stopShare(flow: string): Promise<void> {
  const { error } = await requireClient().rpc('stop_flow_share', { flow });
  if (error) throw error;
}

export async function openSharedFlow(token: string, password?: string): Promise<SharedView> {
  const { data, error } = await requireClient().rpc('open_shared_flow', { share_token: token, pass: password ?? null });
  if (error) throw error;
  return data;
}

export async function listSharedWithMe(): Promise<SharedFlow[]> {
  const { data, error } = await requireClient().rpc('shared_with_me');
  if (error) throw error;
  return data ?? [];
}

export function describeShareError(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? '';
  if (msg.includes('not flow owner'))
    return t('Paylaşım ayarlarını sadece akışın sahibi değiştirebilir.', 'Only the flow’s owner can change its sharing settings.');
  if (msg.includes('share password required'))
    return t('Gizli akış için şifre yaz ya da en az bir kişi ekle.', 'Set a password or add at least one person for a private flow.');
  if (msg.includes('invalid share password'))
    return t('Şifre 4 ile 72 karakter arasında olmalı.', 'The password must be 4 to 72 characters long.');
  if (msg.includes('invalid member')) return t('Geçerli bir e-posta adresi yaz.', 'Enter a valid email address.');
  if (msg.includes('too many members')) return t('En fazla 50 kişi eklenebilir.', 'You can add up to 50 people.');
  return describeError(err);
}
