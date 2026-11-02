import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createFailureLimiter } from "@/lib/rate-limit";

// Khóa tạm khi đăng nhập sai nhiều lần (15 phút).
const WINDOW_MS = 15 * 60 * 1000;
const ipLimiter = createFailureLimiter(5, WINDOW_MS); // theo máy + tên đăng nhập
const userLimiter = createFailureLimiter(10, WINDOW_MS); // theo tên đăng nhập

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || "unknown";
}

type UserRow = {
  id: bigint;
  username: string;
  full_name: string;
  password_hash: string;
  role_code: string;
  role_name: string;
};

type PermissionRow = {
  code: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        {
          error:
            "Vui lòng nhập tên đăng nhập và mật khẩu",
        },
        {
          status: 400,
        },
      );
    }

    const ip = clientIp(request);
    const ipKey = `${ip}|${username.toLowerCase()}`;
    const userKey = username.toLowerCase();
    const wait = Math.max(
      ipLimiter.retryAfter(ipKey),
      userLimiter.retryAfter(userKey),
    );

    if (wait > 0) {
      await writeAudit({
        action: "LOGIN_LOCKED",
        entityType: "user",
        newData: { username: username.slice(0, 100), ip },
      });

      return NextResponse.json(
        {
          error: `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(wait / 60)} phút.`,
        },
        { status: 429 },
      );
    }

    const users =
      await prisma.$queryRaw<UserRow[]>`
        SELECT
          u.id,
          u.username,
          u.full_name,
          u.password_hash,
          r.code AS role_code,
          r.name AS role_name
        FROM users u
        INNER JOIN user_roles ur
          ON ur.user_id = u.id
        INNER JOIN roles r
          ON r.id = ur.role_id
        WHERE u.username = ${username}
          AND u.status = 'ACTIVE'
        LIMIT 1
      `;

    if (users.length === 0) {
      ipLimiter.fail(ipKey);
      userLimiter.fail(userKey);

      await writeAudit({
        action: "LOGIN_FAILED",
        entityType: "user",
        newData: { username: username.slice(0, 100), ip, reason: "unknown_user" },
      });

      return NextResponse.json(
        {
          error:
            "Tài khoản hoặc mật khẩu không đúng",
        },
        {
          status: 401,
        },
      );
    }

    const user = users[0];

    const passwordValid =
      await bcrypt.compare(
        password,
        user.password_hash,
      );

    if (!passwordValid) {
      ipLimiter.fail(ipKey);
      userLimiter.fail(userKey);

      await writeAudit({
        userId: user.id,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user.id,
        newData: { ip, reason: "wrong_password" },
      });

      return NextResponse.json(
        {
          error:
            "Tài khoản hoặc mật khẩu không đúng",
        },
        {
          status: 401,
        },
      );
    }

    ipLimiter.reset(ipKey);
    userLimiter.reset(userKey);

    const permissionRows =
      await prisma.$queryRaw<PermissionRow[]>`
        SELECT
          p.code
        FROM permissions p
        INNER JOIN role_permissions rp
          ON rp.permission_id = p.id
        INNER JOIN roles r
          ON r.id = rp.role_id
        WHERE r.code = ${user.role_code}
        ORDER BY p.code
      `;

    const permissions =
      permissionRows.map(
        (permission) => permission.code,
      );

    await createSession({
      userId: user.id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      roleName: user.role_name,
      permissions,
    });

    await writeAudit({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "user",
      entityId: user.id,
      newData: { ip },
    });

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        fullName: user.full_name,
        role: user.role_code,
        roleName: user.role_name,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        error: "Lỗi máy chủ",
      },
      {
        status: 500,
      },
    );
  }
}