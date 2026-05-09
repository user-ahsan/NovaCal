// ─── Auth Package Barrel Export ───

export {
  createAuthServer,
  createQrChallenge,
  approveQrChallenge,
  accounts,
  verifications,
} from "./server";

export type {
  CreateAuthServerConfig,
  QrChallengeResult,
  BetterAuthInstance,
} from "./server";

export {
  signIn,
  signUp,
  signOut,
  getSession,
} from "./client";

export {
  SESSION_TTL_SECONDS,
  PASSWORD_MIN_LENGTH,
  QR_TTL_SECONDS,
  SESSION_CACHE_TTL_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "./config";
