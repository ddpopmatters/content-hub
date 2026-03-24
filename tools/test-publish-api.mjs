#!/usr/bin/env node
/**
 * test-publish-api.mjs
 * Tests the deployed publish-entry edge function.
 *
 * Usage:
 *   node tools/test-publish-api.mjs [platform1,platform2,...]
 *   node tools/test-publish-api.mjs Bluesky
 *   node tools/test-publish-api.mjs LinkedIn,Instagram
 *   node tools/test-publish-api.mjs          # tests all platforms
 */

const FUNCTION_URL = 'https://dvhjvtxtkmtsqlnurhfg.supabase.co/functions/v1/publish-entry';

const ALL_PLATFORMS = ['Bluesky', 'LinkedIn', 'Instagram', 'Facebook', 'YouTube'];

const platforms = process.argv[2] ? process.argv[2].split(',').map((p) => p.trim()) : ALL_PLATFORMS;

// Minimal test payload — caption + previewUrl let us exercise image paths too.
const payload = {
  entryId: '00000000-0000-0000-0000-000000000001', // fake — function doesn't look it up
  platforms,
  caption:
    '[TEST] Access to family planning is a reproductive right — not a population management tool. #ReproductiveRights',
  platformCaptions: {},
  mediaUrls: [],
  previewUrl: null, // set to a real image URL to test photo-post paths
  scheduledDate: new Date().toISOString().split('T')[0],
  firstComment: '',
  campaign: 'test',
  contentPillar: 'SRHR',
  links: [],
  callbackUrl: null,
};

console.log(`\nTesting publish-entry edge function`);
console.log(`URL: ${FUNCTION_URL}`);
console.log(`Platforms: ${platforms.join(', ')}`);
console.log(`Caption: ${payload.caption.slice(0, 60)}…\n`);

const res = await fetch(FUNCTION_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error(`Non-JSON response (${res.status}):\n${text}`);
  process.exit(1);
}

console.log(`HTTP status: ${res.status}`);
console.log(`\nResults per platform:`);

if (data.results) {
  for (const [platform, result] of Object.entries(data.results)) {
    const icon = result.status === 'published' ? '✓' : result.status === 'skipped' ? '–' : '✗';
    const detail = result.url ?? result.error ?? '';
    console.log(`  ${icon} ${platform.padEnd(12)} ${result.status.padEnd(10)}  ${detail}`);
  }
} else {
  console.log(JSON.stringify(data, null, 2));
}

console.log(`\nFull response:`);
console.log(JSON.stringify(data, null, 2));
