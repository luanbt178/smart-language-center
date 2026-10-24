import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

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