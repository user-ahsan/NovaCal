// ─── NovaCal Auth Client ───
// Better Auth client wrapper for frontend usage.
// Uses vanilla client (not React-specific) so it's safe for any framework.
//
// Exports:
//   signIn    → { user, sessionToken }
//   signUp    → { user, sessionToken }
//   signOut   → void
//   getSession → session | null

import { createAuthClient } from "better-auth/client";

// Better Auth base URL defaults to the server's URL on the same origin.
// Override via NEXT_PUBLIC_BETTER_AUTH_URL for cross-origin deployments.
const baseURL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

const client = createAuthClient({
  baseURL,
});

// ─── Type Helpers ───

interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
}

interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  deviceInfo?: string | null;
  ipAddress?: string | null;
}

interface AuthResult {
  user: AuthUser;
  sessionToken: string;
}

// ─── Auth Functions ───

/**
 * Sign in with email and password.
 * @returns user object and session token string
 * @throws on invalid credentials or server error
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await client.signIn.email({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message || "Sign in failed");
  }

  if (!data?.user || !data?.session) {
    throw new Error("Sign in returned incomplete data");
  }

  return {
    user: data.user as unknown as AuthUser,
    sessionToken: data.session.token,
  };
}

/**
 * Register a new account with email, password, and display name.
 * @returns user object and session token string
 * @throws if email already exists or validation fails
 */
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<AuthResult> {
  const { data, error } = await client.signUp.email({
    email,
    password,
    name,
  });

  if (error) {
    throw new Error(error.message || "Sign up failed");
  }

  if (!data?.user || !data?.session) {
    throw new Error("Sign up returned incomplete data");
  }

  return {
    user: data.user as unknown as AuthUser,
    sessionToken: data.session.token,
  };
}

/**
 * Sign out the current session. Idempotent — safe to call multiple times.
 */
export async function signOut(): Promise<void> {
  await client.signOut();
}

/**
 * Get the current active session, if any.
 * @returns the session object, or null if not authenticated
 */
export async function getSession(): Promise<AuthSession | null> {
  const { data } = await client.getSession();
  if (!data?.session) return null;
  return data.session as unknown as AuthSession;
}
