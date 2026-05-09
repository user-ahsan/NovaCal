// ─── Standard Error Response Helpers ───
// Source: docs/03-api-websocket-contract.md §Global API Configuration
// Error codes: UNAUTHORIZED | VALIDATION_ERROR | CONFLICT | INTERNAL_ERROR | RATE_LIMITED | NOT_FOUND

import { NextResponse } from "next/server";

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
} as const;

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
};

export class ApiRequestError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.statusCode = HTTP_STATUS[code] ?? 500;
    this.details = details;
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status?: number,
  details: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status: status ?? HTTP_STATUS[code] ?? 500 },
  );
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiRequestError) {
    return errorResponse(error.code, error.message, error.statusCode, error.details);
  }

  console.error("Unhandled API error:", error);
  return errorResponse(
    ERROR_CODES.INTERNAL_ERROR,
    error instanceof Error ? error.message : "An unexpected error occurred",
  );
}
