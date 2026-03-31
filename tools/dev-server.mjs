import { context } from 'esbuild';
import { execSync, exec } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { resolveSupabaseAnonKey, resolveSupabaseUrl, writePublicConfig } from './public-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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
const getEnv = (key) => process.env[key] || env[key] || '';

writePublicConfig(root, getEnv);

// Build Tailwind CSS (initial + watch)
const tailwindInput = resolve(root, 'src/styles/app.css');
const tailwindOutput = resolve(root, 'public/css/app.css');
console.log('Building Tailwind CSS...');
execSync(`npx @tailwindcss/cli -i "${tailwindInput}" -o "${tailwindOutput}"`, {
  stdio: 'inherit',
  cwd: root,
});

// Start Tailwind watcher in background
// CHOKIDAR_USEPOLLING avoids FSEvents crash on Node 25 / macOS
const twWatch = exec(`npx @tailwindcss/cli -i "${tailwindInput}" -o "${tailwindOutput}" --watch`, {
  cwd: root,
  env: { ...process.env, CHOKIDAR_USEPOLLING: '1' },
});
twWatch.stderr?.on('data', (d) => {
  const msg = d.toString().trim();
  if (msg) console.log('[tailwind]', msg);
});

// esbuild context with serve
const ctx = await context({
  entryPoints: [resolve(root, 'src/app.jsx')],
  outdir: resolve(root, 'public/js'),
  bundle: true,
  sourcemap: true,
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  minify: false,
  logLevel: 'info',
  define: {
    'import.meta.env.SUPABASE_URL': JSON.stringify(resolveSupabaseUrl(getEnv)),
    'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(resolveSupabaseAnonKey(getEnv)),
    'import.meta.env.META_APP_ID': JSON.stringify(getEnv('META_APP_ID')),
    'import.meta.env.META_FLOB_CONFIG_ID': JSON.stringify(getEnv('META_FLOB_CONFIG_ID')),
    'import.meta.env.LINKEDIN_CLIENT_ID': JSON.stringify(getEnv('LINKEDIN_CLIENT_ID')),
    'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(getEnv('GOOGLE_CLIENT_ID')),
  },
});

await ctx.watch();

const { host: _host, port } = await ctx.serve({
  servedir: resolve(root, 'public'),
  port: 3000,
});

console.log(`\n  Dev server running at http://localhost:${port}\n`);

// Cleanup on exit
process.on('SIGINT', () => {
  twWatch.kill();
  ctx.dispose();
  process.exit(0);
});
