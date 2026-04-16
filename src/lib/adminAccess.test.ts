import { describe, expect, it } from 'vitest';
import { getSuperAdminEmail, isSuperAdminEmail } from './adminAccess';

describe('adminAccess', () => {
  it('recognises the canonical super-admin email', () => {
    expect(getSuperAdminEmail()).toBe('daniel.davis@populationmatters.org');
    expect(isSuperAdminEmail('daniel.davis@populationmatters.org')).toBe(true);
    expect(isSuperAdminEmail('Daniel.Davis@populationmatters.org')).toBe(true);
  });

  it('rejects every other account as a super-admin', () => {
    expect(isSuperAdminEmail('someone.else@populationmatters.org')).toBe(false);
    expect(isSuperAdminEmail('')).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
  });
});
