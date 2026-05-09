// ─── Auth Configuration ───
// All duration values in seconds.
// Referenced by server.ts for Better Auth and QR challenge setup.
// AGENTS.md Rule 42: Sessions use text PK, QR challenges have 60s hard TTL.
// AGENTS.md Rule 55: QR flow stores challenge in Redis with 60s TTL.

/** Session token TTL: 7 days (604800 seconds) */
export const SESSION_TTL_SECONDS = 604800 as const;

/** Minimum password length for email/password registration */
export const PASSWORD_MIN_LENGTH = 8 as const;

/** QR challenge TTL: 60 seconds (strict, per AGENTS.md Rule 42 & 56) */
export const QR_TTL_SECONDS = 60 as const;

/** Session cache TTL: 1 hour (3600 seconds) — reduces Redis lookups */
export const SESSION_CACHE_TTL_SECONDS = 3600 as const;

/** Session update age: 24 hours — how often session expiry is refreshed */
export const SESSION_UPDATE_AGE_SECONDS = 86400 as const;
