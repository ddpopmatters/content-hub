import {
  consumeOAuthState,
  issueOAuthState,
  OAuthStateError,
  OAUTH_STATE_TTL_MS,
} from './oauthState.ts';

const OWNER_EMAIL = 'daniel.davis@populationmatters.org';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function assertStateError(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof OAuthStateError) return;
    throw error;
  }
  throw new Error('Expected OAuthStateError');
}

const createStore = () => {
  const records = new Map<string, string>();
  return {
    records,
    store: ({ key, value }: { key: string; value: string }) => {
      records.set(key, value);
      return Promise.resolve();
    },
    take: (key: string) => {
      const value = records.get(key) ?? null;
      records.delete(key);
      return Promise.resolve(value);
    },
  };
};

Deno.test('OAuth state is opaque, owner-bound, platform-bound and short-lived', async () => {
  const stateStore = createStore();
  const now = new Date('2026-07-17T10:00:00.000Z');
  const token = await issueOAuthState({
    platform: 'Instagram',
    ownerEmail: OWNER_EMAIL,
    store: stateStore.store,
    now,
    randomBytes: new Uint8Array(32).fill(7),
  });

  assertEquals(token.length, 43);
  assertEquals(token.includes(OWNER_EMAIL), false);
  assertEquals(Array.from(stateStore.records.keys())[0].startsWith('oauth_state:'), true);

  const record = await consumeOAuthState(token, {
    take: stateStore.take,
    now: new Date(now.getTime() + 1_000),
  });
  assertEquals(record.platform, 'Instagram');
  assertEquals(record.ownerEmail, OWNER_EMAIL);
  assertEquals(Date.parse(record.expiresAt) - Date.parse(record.issuedAt), OAUTH_STATE_TTL_MS);
});

Deno.test('OAuth state can be consumed only once', async () => {
  const stateStore = createStore();
  const token = await issueOAuthState({
    platform: 'Facebook',
    ownerEmail: OWNER_EMAIL,
    store: stateStore.store,
    randomBytes: new Uint8Array(32).fill(8),
  });

  await consumeOAuthState(token, { take: stateStore.take });
  await assertStateError(() => consumeOAuthState(token, { take: stateStore.take }));
});

Deno.test('OAuth state rejects tampering and expiry', async () => {
  const stateStore = createStore();
  const now = new Date('2026-07-17T10:00:00.000Z');
  const token = await issueOAuthState({
    platform: 'LinkedIn',
    ownerEmail: OWNER_EMAIL,
    store: stateStore.store,
    now,
    randomBytes: new Uint8Array(32).fill(9),
  });
  const finalCharacter = token.endsWith('A') ? 'B' : 'A';

  await assertStateError(() =>
    consumeOAuthState(`${token.slice(0, -1)}${finalCharacter}`, { take: stateStore.take, now }),
  );
  await assertStateError(() =>
    consumeOAuthState(token, {
      take: stateStore.take,
      now: new Date(now.getTime() + OAUTH_STATE_TTL_MS + 1),
    }),
  );
});

Deno.test('OAuth state rejects a stored wrong-owner record', async () => {
  const stateStore = createStore();
  const token = await issueOAuthState({
    platform: 'LinkedIn Org',
    ownerEmail: OWNER_EMAIL,
    store: stateStore.store,
    randomBytes: new Uint8Array(32).fill(10),
  });
  const [key, value] = Array.from(stateStore.records.entries())[0];
  stateStore.records.set(
    key,
    JSON.stringify({ ...JSON.parse(value), ownerEmail: 'other@example.org' }),
  );

  await assertStateError(() => consumeOAuthState(token, { take: stateStore.take }));
});
