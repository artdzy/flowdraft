import type { FlowDoc } from '../flow/types';
import { t } from '../i18n';
import { requireClient } from './supabase';

export type ProjectSummary = { id: string; title: string; updated_at: string };

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await requireClient()
    .from('projects')
    .select('id,title,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function countProjects(): Promise<number> {
  const { count, error } = await requireClient().from('projects').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export type ProjectRow = { id: string; title: string; content: unknown; updated_at: string };

export async function fetchProject(id: string): Promise<ProjectRow> {
  const { data, error } = await requireClient()
    .from('projects')
    .select('id,title,content,updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** Null when the row is gone or belongs to someone else. */
export async function fetchUpdatedAt(id: string): Promise<string | null> {
  const { data, error } = await requireClient().from('projects').select('updated_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data?.updated_at ?? null;
}

export async function createProject(title: string, content: FlowDoc): Promise<{ id: string; updated_at: string }> {
  const { data, error } = await requireClient()
    .from('projects')
    .insert({ title, content })
    .select('id,updated_at')
    .single();
  if (error) throw error;
  return data;
}

/** Returns the new updated_at, or null when the row is gone or belongs to someone else (RLS filters it out). */
export async function updateProject(id: string, title: string, content: FlowDoc): Promise<string | null> {
  const { data, error } = await requireClient()
    .from('projects')
    .update({ title, content })
    .eq('id', id)
    .select('updated_at');
  if (error) throw error;
  return data?.[0]?.updated_at ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await requireClient().from('projects').delete().eq('id', id);
  if (error) throw error;
}

export function describeError(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message ?? '';
  if (e?.code === 'PGRST116' || e?.code === '22P02')
    return t(
      'Akış bulunamadı. Silinmiş ya da başka bir hesaba ait olabilir.',
      'Flow not found. It may have been deleted or belong to another account.',
    );
  if (msg.includes('projects_content_size'))
    return t('Akış çok büyük (en fazla 512 KB).', 'This flow is too large (512 KB max).');
  if (msg.includes('projects_no_images')) return t('Görsel içeren akışlar kaydedilemez.', 'Flows with images can’t be saved.');
  if (msg.includes('project quota'))
    return t(
      'Proje sınırına ulaştın (200). Birkaç eski projeyi sil.',
      'You’ve hit the project limit (200). Delete a few old projects.',
    );
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return t('Bağlantı yok. İnternetini kontrol et.', 'No connection. Check your internet connection.');
  return msg || t('Bir şeyler ters gitti.', 'Something went wrong.');
}
