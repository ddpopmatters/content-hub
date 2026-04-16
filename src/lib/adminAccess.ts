const SUPER_ADMIN_EMAIL = 'daniel.davis@populationmatters.org';

export const getSuperAdminEmail = (): string => SUPER_ADMIN_EMAIL;

export const isSuperAdminEmail = (email: string | null | undefined): boolean =>
  typeof email === 'string' && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
