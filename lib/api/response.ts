import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function err(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { message, ...(code ? { code } : {}) } }, { status });
}

export const ApiError = {
  badRequest: (msg = "Bad request") => err(msg, 400, "BAD_REQUEST"),
  unauthorized: () => err("Unauthorized", 401, "UNAUTHORIZED"),
  forbidden: () => err("Forbidden", 403, "FORBIDDEN"),
  notFound: (msg = "Not found") => err(msg, 404, "NOT_FOUND"),
  internal: (msg = "Internal server error") => err(msg, 500, "INTERNAL_ERROR"),
};
