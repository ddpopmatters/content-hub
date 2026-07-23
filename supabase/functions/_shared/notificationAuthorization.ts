const normaliseIdentity = (value: string): string => value.trim().toLowerCase();

export function notificationRecipientsAreAuthorised(input: {
  requestedNames: string[];
  directEmails: string[];
  allowedNames: string[];
  allowedEmails: string[];
}): boolean {
  const allowedNameKeys = new Set(input.allowedNames.map(normaliseIdentity));
  const allowedEmailKeys = new Set(input.allowedEmails.map(normaliseIdentity));
  return (
    input.requestedNames.every((name) => {
      const key = normaliseIdentity(name);
      return Boolean(key) && (allowedNameKeys.has(key) || allowedEmailKeys.has(key));
    }) &&
    input.directEmails.every((email) => {
      const key = normaliseIdentity(email);
      return Boolean(key) && allowedEmailKeys.has(key);
    })
  );
}
