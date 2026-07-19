import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [reviewPage, emailSource, approvalFunction, migration] = await Promise.all([
  readFile(new URL('../public/review.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/email.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/approve-entry/index.ts', import.meta.url), 'utf8'),
  readFile(
    new URL(
      '../supabase/migrations/20260719112649_lock_down_entry_review_reads.sql',
      import.meta.url,
    ),
    'utf8',
  ),
]);

assert.ok(reviewPage.includes('/approve-entry?token='));
assert.ok(reviewPage.includes("params.get('token')"));
assert.ok(!reviewPage.includes(".from('entries')"));
assert.ok(!reviewPage.includes('supabaseAnonKey'));
assert.ok(!reviewPage.includes('@supabase/supabase-js'));
assert.ok(emailSource.includes('{{CONTENT_REVIEW_URL}}'));
assert.ok(!emailSource.includes('review.html?id='));
assert.ok(!approvalFunction.includes(".select('*')"));
assert.ok(
  migration.includes('DROP POLICY IF EXISTS "Anon users can view entries via review link"'),
);

process.stdout.write('Review-link boundary contract passed.\n');
