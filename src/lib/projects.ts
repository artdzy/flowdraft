import type { FlowDoc } from '../flow/types';
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

export async function fetchProject(id: string): Promise<{ id: string; title: string; content: unknown }> {
  const { data, error } = await requireClient().from('projects').select('id,title,content').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createProject(title: string, content: FlowDoc): Promise<string> {
  const { data, error } = await requireClient().from('projects').insert({ title, content }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

/** Returns false when the row is gone or belongs to someone else (RLS filters it out). */
export async function updateProject(id: string, title: string, content: FlowDoc): Promise<boolean> {
  const { data, error } = await requireClient().from('projects').update({ title, content }).eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await requireClient().from('projects').delete().eq('id', id);
  if (error) throw error;
}

export function describeError(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message ?? '';
  if (msg.includes('projects_content_size')) return 'Akış çok büyük (en fazla 512 KB).';
  if (msg.includes('projects_no_images')) return 'Görsel içeren akışlar kaydedilemez.';
  if (msg.includes('project quota')) return 'Proje sınırına ulaştın (200). Birkaç eski projeyi sil.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Bağlantı yok. İnternetini kontrol et.';
  return msg || 'Bir şeyler ters gitti.';
}
