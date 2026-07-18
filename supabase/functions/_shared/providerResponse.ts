/**
 * A timeout, rate-limit or server response after a provider mutation request
 * does not prove that the provider rejected the side effect.
 */
export const isAmbiguousProviderMutationResponse = (response: Response): boolean =>
  response.status === 408 ||
  response.status === 425 ||
  response.status === 429 ||
  response.status >= 500;
