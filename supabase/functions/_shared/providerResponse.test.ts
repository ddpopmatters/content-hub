import { isAmbiguousProviderMutationResponse } from './providerResponse.ts';

const assertEquals = (actual: unknown, expected: unknown): void => {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, received ${actual}`);
  }
};

Deno.test('provider mutation responses classify transient outcomes as ambiguous', () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    assertEquals(isAmbiguousProviderMutationResponse(new Response(null, { status })), true);
  }
});

Deno.test('provider mutation responses retain definitive client rejections', () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assertEquals(isAmbiguousProviderMutationResponse(new Response(null, { status })), false);
  }
});
