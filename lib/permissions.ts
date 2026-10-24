import "server-only";

import { NextResponse } from "next/server";
import {
  getCurrentSession,
  type SessionPayload,
} from "@/lib/auth";

type PermissionResult =
  | {
      ok: true;
      session: SessionPayload;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireApiPermission(
  permission: string,
): Promise<PermissionResult> {
  const session = await getCurrentSession();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bạn cần đăng nhập." },
        { status: 401 },
      ),
    };
  }

  if (!session.permissions.includes(permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    session,
  };
}