#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { resolvePublicSupabaseConfig } from './public-config.mjs';

export const PUBLICATION_CONTRACT_VERSION = 'durable-manual-v1';
export const PRODUCTION_SUPABASE_URL = 'https://oepehanwmfelowfumkes.supabase.co';

export const resolvePublicationBackendConfiguration = (getEnv) => {
  const publicConfig = resolvePublicSupabaseConfig(getEnv);
  if (publicConfig.supabaseUrl !== PRODUCTION_SUPABASE_URL) {
    throw new Error(
      'The production publication backend target is not the approved shared project.',
    );
  }
  return {
    supabaseUrl: publicConfig.supabaseUrl,
    publishableKey: publicConfig.supabaseAnonKey,
  };
};

const requireConfiguration = (value, label) => {
  const normalised = typeof value === 'string' ? value.trim() : '';
  if (!normalised) {
    throw new Error(`${label} is required for the publication rollout check.`);
  }
  return normalised;
};

export async function verifyPublicationBackend({
  supabaseUrl,
  publishableKey,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  const configuredUrl = requireConfiguration(supabaseUrl, 'Supabase URL');
  const configuredKey = requireConfiguration(publishableKey, 'Supabase publishable key');
  const baseUrl = new URL(configuredUrl);
  if (baseUrl.protocol !== 'https:') {
    throw new Error('The publication rollout check requires an HTTPS Supabase URL.');
  }

  const functionUrl = new URL('/functions/v1/publish-entry', baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(functionUrl, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${configuredKey}`,
        apikey: configuredKey,
      },
      signal: controller.signal,
    });
  } catch {
    throw new Error('The durable publication backend could not be verified.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `The durable publication backend is not ready (HTTP ${response.status}). Deployment is blocked.`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The publication backend returned an invalid readiness response.');
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 2 ||
    payload.ready !== true ||
    payload.contractVersion !== PUBLICATION_CONTRACT_VERSION
  ) {
    throw new Error('The publication backend contract does not match this frontend release.');
  }

  return { contractVersion: PUBLICATION_CONTRACT_VERSION };
}

export async function main() {
  const configuration = resolvePublicationBackendConfiguration((key) => process.env[key] || '');
  await verifyPublicationBackend(configuration);
  console.log(`Publication backend ready: ${PUBLICATION_CONTRACT_VERSION}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Publication backend check failed.');
    process.exitCode = 1;
  });
}
