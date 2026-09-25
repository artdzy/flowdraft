import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __FLOWDRAFT__?: { supabaseUrl?: string; supabaseAnonKey?: string };
  }
}

const url = window.__FLOWDRAFT__?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = window.__FLOWDRAFT__?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
      // Implicit flow so e-mail confirmation links also work when opened on another device.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Sunucu bağlantısı yapılandırılmamış.');
  return supabase;
}
