import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { resolvePublicSupabaseConfig } from './public-config.mjs';

const STORAGE_BUCKET = 'content-media';
const PUBLIC_PROBE_PATH = '__codex_bucket_probe__';
const TEST_EMAIL_ENV = 'SUPABASE_STORAGE_TEST_EMAIL';
const TEST_PASSWORD_ENV = 'SUPABASE_STORAGE_TEST_PASSWORD';

const getEnv = (key) => process.env[key] ?? '';

const config = resolvePublicSupabaseConfig(getEnv);
const publicProbeUrl = `${config.supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${PUBLIC_PROBE_PATH}`;

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function verifyPublicBucket() {
  const response = await fetch(publicProbeUrl);
  const text = await response.text();
  const payload = parseJson(text);
  const message = payload?.message || payload?.error || text;

  if (/bucket not found/i.test(message)) {
    throw new Error(
      `Storage bucket "${STORAGE_BUCKET}" is missing in ${config.supabaseUrl}. Create it before enabling uploads.`,
    );
  }

  if (response.status >= 500) {
    throw new Error(`Storage probe failed with HTTP ${response.status}: ${message}`);
  }

  return {
    status: response.status,
    message,
  };
}

async function verifyAuthenticatedUpload() {
  const email = getEnv(TEST_EMAIL_ENV);
  const password = getEnv(TEST_PASSWORD_ENV);

  if (!email || !password) {
    console.log(
      `⚠️  Upload policy probe skipped. Set ${TEST_EMAIL_ENV} and ${TEST_PASSWORD_ENV} to run it.`,
    );
    return;
  }

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) {
    throw new Error(`Storage auth probe failed: ${authError.message}`);
  }

  const uploadPath = `codex-probes/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1EAAAAASUVORK5CYII=',
    'base64',
  );
  const fileBody = new Blob([pngBytes], { type: 'image/png' });

  try {
    const { error: uploadError } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(uploadPath, fileBody, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(uploadPath);
    assert.ok(publicUrlData?.publicUrl, 'uploaded object exposes a public URL');

    const publicResponse = await fetch(publicUrlData.publicUrl);
    assert.equal(publicResponse.status, 200, 'uploaded object is publicly readable');
    assert.equal(
      publicResponse.headers.get('content-type'),
      'image/png',
      'public object keeps PNG mime',
    );

    const { error: deleteError } = await client.storage.from(STORAGE_BUCKET).remove([uploadPath]);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    console.log('✅ content-media authenticated upload probe passed');
  } finally {
    await client.auth.signOut();
  }
}

const publicProbe = await verifyPublicBucket();
console.log(
  `✅ content-media public bucket probe passed (${publicProbe.status}${publicProbe.message ? `: ${publicProbe.message}` : ''})`,
);
await verifyAuthenticatedUpload();
