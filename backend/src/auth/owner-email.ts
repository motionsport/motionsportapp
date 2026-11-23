const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The owner's login: stored and looked up lowercased, so case and spaces don't matter
export function normalizeOwnerEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}
