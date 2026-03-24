export function normalizeContentApproach(
  responseMode: string | null | undefined,
): 'Planned' | 'Reactive' {
  return responseMode === 'Reactive' ? 'Reactive' : 'Planned';
}

export function buildUtmUrl(
  base: string,
  source: string,
  medium: string,
  campaign: string,
  content: string,
  term: string,
): string {
  if (!base || !source || !medium || !campaign) return '';

  try {
    const url = new URL(base.startsWith('http') ? base : `https://${base}`);
    if (source) url.searchParams.set('utm_source', source);
    if (medium) url.searchParams.set('utm_medium', medium);
    if (campaign) url.searchParams.set('utm_campaign', campaign);
    if (content) url.searchParams.set('utm_content', content);
    if (term) url.searchParams.set('utm_term', term);
    return url.toString();
  } catch {
    return '';
  }
}
