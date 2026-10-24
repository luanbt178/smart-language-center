import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET!,
);

export type SessionPayload = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  roleName: string;
  permissions: string[];
};

export async function createSession(
  payload: SessionPayload,
) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);

  const cookieStore = await cookies();

  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function getCurrentSession(): Promise<
  SessionPayload | null
> {
  const cookieStore = await cookies();

  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      secret,
      {
        algorithms: ["HS256"],
      },
    );

    return {
      userId: String(payload.userId),
      username: String(payload.username),
      fullName: String(payload.fullName),
      role: String(payload.role),
      roleName: String(payload.roleName),
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map(String)
        : [],
    };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}