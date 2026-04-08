import assert from 'node:assert/strict';
import { buildLocalCopyCheckResult } from '../src/lib/copyCheck.ts';

const payload = {
  text: 'Population growth is complex and maybe we could add a link https://example.org',
  platform: 'LinkedIn',
  assetType: 'Design',
  readingLevelTarget: 'Grade 7',
  constraints: { maxChars: 280, maxHashtags: 5, requireCTA: true },
  brand: {
    bannedWords: ['maybe'],
    requiredPhrases: ['Population Matters'],
    tone: { confident: 1, compassionate: 1, evidenceLed: 1 },
  },
};

const json = buildLocalCopyCheckResult(payload);

assert.ok(json?.suggestion?.text, 'has suggestion');
assert.ok(json.suggestion.text.length <= payload.constraints.maxChars, 'respects maxChars');
assert.ok(
  json.suggestion.text.toLowerCase().includes('population matters'),
  'required phrase injected',
);
assert.ok(!/\bmaybe\b/i.test(json.suggestion.text), 'banned word removed');

console.log('✅ copy-check fallback test passed');
