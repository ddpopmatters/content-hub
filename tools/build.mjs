import { build, context } from 'esbuild';
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, rmSync, mkdirSync } from 'fs';
import { resolveSupabaseAnonKey, resolveSupabaseUrl, writePublicConfig } from './public-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const isWatch = process.argv.includes('--watch');

// Load .env file for build-time constants
const loadEnv = () => {
  try {
    const envFile = readFileSync(resolve(root, '.env'), 'utf-8');
    const env = {};
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return env;
  } catch {
    return {};
  }
};
const env = loadEnv();

// Merge file env with process.env (process.env takes precedence for CI/injection)
const getEnv = (key) => process.env[key] || env[key] || '';

writePublicConfig(root, getEnv);

const config = {
  entryPoints: [resolve(root, 'src/app.jsx')],
  outdir: resolve(root, 'public/js'),
  bundle: true,
  sourcemap: true,
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  minify: !isWatch,
  metafile: true,
  logLevel: 'info',
  define: {
    'import.meta.env.SUPABASE_URL': JSON.stringify(resolveSupabaseUrl(getEnv)),
    'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(resolveSupabaseAnonKey(getEnv)),
    'import.meta.env.META_APP_ID': JSON.stringify(getEnv('META_APP_ID')),
    'import.meta.env.META_FLOB_CONFIG_ID': JSON.stringify(getEnv('META_FLOB_CONFIG_ID')),
    'import.meta.env.LINKEDIN_CLIENT_ID': JSON.stringify(getEnv('LINKEDIN_CLIENT_ID')),
    'import.meta.env.LINKEDIN_ORG_CLIENT_ID': JSON.stringify(getEnv('LINKEDIN_ORG_CLIENT_ID')),
    'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(getEnv('GOOGLE_CLIENT_ID')),
    'import.meta.env.CONTENT_MEDIA_UPLOADS_ENABLED': JSON.stringify(
      getEnv('CONTENT_MEDIA_UPLOADS_ENABLED'),
    ),
  },
};

// Clean previous build output to prevent stale chunk accumulation
if (!isWatch) {
  rmSync(resolve(root, 'public/js'), { recursive: true, force: true });
  mkdirSync(resolve(root, 'public/js/chunks'), { recursive: true });
}

// Build Tailwind CSS
const tailwindInput = resolve(root, 'src/styles/app.css');
const tailwindOutput = resolve(root, 'public/css/app.css');
const tailwindBin = resolve(root, 'node_modules/.bin/tailwindcss');
const tailwindArgs = ['-i', tailwindInput, '-o', tailwindOutput];
if (!isWatch) {
  tailwindArgs.push('--minify');
}
console.log('Building Tailwind CSS...');
execFileSync(tailwindBin, tailwindArgs, { stdio: 'inherit', cwd: root });

if (isWatch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  const result = await build(config);
  if (result.metafile) {
    const outputs = Object.keys(result.metafile.outputs);
    console.log(`Built ${outputs.length} files`);
  }
}
