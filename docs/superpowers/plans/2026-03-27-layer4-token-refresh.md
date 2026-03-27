# Layer 4: Token Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before each publish attempt, check whether the platform's access token is expired or about to expire. Refresh it automatically for LinkedIn and Google/YouTube; return a human-readable "reconnect" error for Meta (no refresh token issued).

**Architecture:** A `resolveAccessToken(conn, supabase)` helper is added to `publish-entry/index.ts`. The handler's `Promise.all` loop calls it before invoking any publisher. On successful refresh, the DB is updated and a fresh token is injected into the connection object. On failure, a structured `PlatformResult` with `status: 'failed'` is returned directly without calling the publisher.

**Pre-requisite:** None — this layer is independent. `expires_at` and `refresh_token` are already present in the `PlatformConnection` type and in the DB rows (returned by `select('*')`).

**Environment secrets required:** Set these in the Supabase Edge Function secrets for the `publish-entry` function:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Tech Stack:** Deno/TypeScript Edge Function, LinkedIn OAuth 2.0 token endpoint, Google OAuth 2.0 token endpoint, Supabase JS client

---

### Task 1: Add token refresh helpers

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts` — add three functions before the router

- [ ] **Step 1: Add `refreshLinkedInToken` helper**

Above the `PUBLISHERS` const (before line 564), add:

```typescript
// ─── Token refresh ───────────────────────────────────────────────────────────

async function refreshLinkedInToken(
  conn: PlatformConnection,
  supabase: ReturnType<typeof createClient>,
): Promise<{ token: string } | { error: string }> {
  if (!conn.refresh_token) {
    return { error: 'LinkedIn token expired — reconnect your account in Publishing settings' };
  }
  const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
  const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return { error: 'LinkedIn token expired — reconnect your account in Publishing settings' };
  }
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    return { error: 'LinkedIn token expired — reconnect your account in Publishing settings' };
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    return { error: 'LinkedIn token expired — reconnect your account in Publishing settings' };
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;
  await supabase
    .from('platform_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? conn.refresh_token,
      expires_at: expiresAt,
    })
    .eq('id', conn.id);
  return { token: data.access_token };
}
```

- [ ] **Step 2: Add `refreshGoogleToken` helper**

Immediately after `refreshLinkedInToken`, add:

```typescript
async function refreshGoogleToken(
  conn: PlatformConnection,
  supabase: ReturnType<typeof createClient>,
): Promise<{ token: string } | { error: string }> {
  if (!conn.refresh_token) {
    return { error: 'Google token expired — reconnect your account in Publishing settings' };
  }
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return { error: 'Google token expired — reconnect your account in Publishing settings' };
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    return { error: 'Google token expired — reconnect your account in Publishing settings' };
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    return { error: 'Google token expired — reconnect your account in Publishing settings' };
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;
  await supabase
    .from('platform_connections')
    .update({ access_token: data.access_token, expires_at: expiresAt })
    .eq('id', conn.id);
  return { token: data.access_token };
}
```

- [ ] **Step 3: Add `resolveAccessToken` orchestrator**

Immediately after `refreshGoogleToken`, add:

```typescript
async function resolveAccessToken(
  conn: PlatformConnection,
  supabase: ReturnType<typeof createClient>,
): Promise<{ token: string | null } | { error: string }> {
  // No expiry stored — trust the token as-is
  if (!conn.expires_at) return { token: conn.access_token };

  const expiresAt = new Date(conn.expires_at);
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Token is still valid for at least 24 hours
  if (expiresAt > in24h) return { token: conn.access_token };

  // Refresh by platform
  if (conn.platform === 'LinkedIn' || conn.platform === 'LinkedIn Org') {
    return refreshLinkedInToken(conn, supabase);
  }
  if (conn.platform === 'YouTube') {
    return refreshGoogleToken(conn, supabase);
  }
  // Meta tokens (Facebook/Instagram) — no refresh token issued
  return {
    error: `${conn.platform} token expired — reconnect your account in Publishing settings`,
  };
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): add token refresh helpers for LinkedIn and Google"
```

---

### Task 2: Wire token refresh into the publish handler loop

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:614-656` (the `Promise.all` loop)

- [ ] **Step 1: Update the `Promise.all` loop to check tokens before publishing**

The current loop body (lines 615–656) looks like:

```typescript
      payload.platforms.map(async (platform) => {
        const conn = (connections ?? []).find((c) => c.platform === platform);
        if (!conn) {
          results[platform] = { status: 'failed', url: null, postId: null, error: `No active connection found for ${platform}`, timestamp };
          return;
        }

        const platformPayload = { ...payload, caption: payload.platformCaptions?.[platform] || payload.caption };

        const publisher = PUBLISHERS[platform];
        if (!publisher) {
          results[platform] = { status: 'failed', url: null, postId: null, error: `No publisher implemented for ${platform}`, timestamp };
          return;
        }

        results[platform] = await publisher(conn, platformPayload);
        // ... update last_used_at
      }),
```

Replace it with:

```typescript
      payload.platforms.map(async (platform) => {
        const conn = (connections ?? []).find((c) => c.platform === platform);
        if (!conn) {
          results[platform] = { status: 'failed', url: null, postId: null, error: `No active connection found for ${platform}`, timestamp };
          return;
        }

        const platformPayload = { ...payload, caption: payload.platformCaptions?.[platform] || payload.caption };

        const publisher = PUBLISHERS[platform];
        if (!publisher) {
          results[platform] = { status: 'failed', url: null, postId: null, error: `No publisher implemented for ${platform}`, timestamp };
          return;
        }

        // Refresh token if expired or expiring within 24 hours
        const tokenResult = await resolveAccessToken(conn, supabase);
        if ('error' in tokenResult) {
          results[platform] = { status: 'failed', url: null, postId: null, error: tokenResult.error, timestamp };
          return;
        }
        const connWithFreshToken =
          tokenResult.token !== null && tokenResult.token !== conn.access_token
            ? { ...conn, access_token: tokenResult.token }
            : conn;

        results[platform] = await publisher(connWithFreshToken, platformPayload);

        await supabase
          .from('platform_connections')
          .update({
            last_used_at: timestamp,
            last_error: results[platform].status === 'failed' ? results[platform].error : null,
          })
          .eq('id', conn.id);
      }),
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): pre-publish token expiry check with auto-refresh for LinkedIn and Google"
```

---

### Task 3: Set Edge Function secrets

**Files:**

- Manual step: Supabase dashboard

- [ ] **Step 1: Add secrets to `publish-entry` Edge Function**

In the Supabase dashboard → Edge Functions → `publish-entry` → Secrets:

Add the following (values from the OAuth apps configured for Content Hub):

- `LINKEDIN_CLIENT_ID` — from LinkedIn Developer Portal app settings
- `LINKEDIN_CLIENT_SECRET` — from LinkedIn Developer Portal app settings
- `GOOGLE_CLIENT_ID` — from Google Cloud Console OAuth 2.0 credentials
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console OAuth 2.0 credentials

These match the secrets used by the `oauth-callback` function. If that function already has them set as shared secrets, they will be available automatically.

---

## Self-Review

**Spec coverage:**

- LinkedIn token refresh → Task 1 Step 1 ✓
- Google/YouTube token refresh → Task 1 Step 2 ✓
- Meta "reconnect" error (no refresh token) → Task 1 Step 3 ✓
- Bluesky exempt (app passwords don't expire) → `resolveAccessToken` falls through via `if (!conn.expires_at)` since Bluesky connections never set `expires_at` ✓
- Pre-publish check wired into handler loop → Task 2 ✓
- DB updated with fresh token after refresh → Tasks 1 Steps 1–2 ✓
- Refresh failure returns structured `failed` result → all helpers return `{ error: string }` which Task 2 maps to `PlatformResult` ✓

**Placeholder scan:** No TBDs. OAuth endpoints, request parameters, and error messages are all fully specified.

**Type consistency:** `resolveAccessToken` returns `Promise<{ token: string | null } | { error: string }>`. In Task 2, `'error' in tokenResult` correctly narrows to the error case. `connWithFreshToken` is a spread of `conn` which satisfies `PlatformConnection`.
