import { resolve } from 'path';
import { writeFileSync } from 'fs';

const LEGACY_SUPABASE_URL = 'https://dvhjvtxtkmtsqlnurhfg.supabase.co';
const LEGACY_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aGp2dHh0a210c3FsbnVyaGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTI0OTYsImV4cCI6MjA4MzU2ODQ5Nn0.c4yIpOZXqU8Doci2IN6uNKA_rWwrrMzbMDkMx9HCjcc';
const DEFAULT_SUPABASE_URL = 'https://oepehanwmfelowfumkes.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcGVoYW53bWZlbG93ZnVta2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDE2NTksImV4cCI6MjA4ODExNzY1OX0.VaBVUk4fZSPF17ude4w9x5qcOCniLM8KGXKN8YOTL04';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const resolveSupabaseUrl = (getEnv) => {
  const envValue = trimTrailingSlash(getEnv('SUPABASE_URL') || '');
  return envValue && envValue !== LEGACY_SUPABASE_URL ? envValue : DEFAULT_SUPABASE_URL;
};

export const resolveSupabaseAnonKey = (getEnv) => {
  const envValue = getEnv('SUPABASE_ANON_KEY') || '';
  return envValue && envValue !== LEGACY_SUPABASE_ANON_KEY ? envValue : DEFAULT_SUPABASE_ANON_KEY;
};

export const resolvePublicSupabaseConfig = (getEnv) => {
  const supabaseUrl = resolveSupabaseUrl(getEnv);
  const supabaseAnonKey = resolveSupabaseAnonKey(getEnv);

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseFunctionsUrl: `${supabaseUrl}/functions/v1`,
  };
};

export const writePublicConfig = (root, getEnv) => {
  const publicConfigPath = resolve(root, 'public/content-hub-config.js');
  const publicConfig = resolvePublicSupabaseConfig(getEnv);
  const configSource = `window.CONTENT_HUB_PUBLIC_CONFIG = ${JSON.stringify(publicConfig, null, 2)};\n`;

  writeFileSync(publicConfigPath, configSource);
};
