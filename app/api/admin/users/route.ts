import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import bcrypt from "bcryptjs";

type UserRow = {
  id: bigint;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: Date | string;
  role_codes: string | null;
  branch_codes: string | null;
};

type RoleRow = {
  code: string;
  name: string;
};

type BranchRow = {
  id: bigint;
  code: string;
  name: string;
  status: string;
};

export async function GET() {
  const auth = await requireApiPermission("USER_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const users = await prisma.$queryRaw<UserRow[]>`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.phone,
        u.status,
        u.created_at,

        GROUP_CONCAT(
          DISTINCT r.code
          ORDER BY r.code
          SEPARATOR ','
        ) AS role_codes,

        GROUP_CONCAT(
          DISTINCT b.code
          ORDER BY b.code
          SEPARATOR ','
        ) AS branch_codes

      FROM users u

      LEFT JOIN user_roles ur
        ON ur.user_id = u.id

      LEFT JOIN roles r
        ON r.id = ur.role_id

      LEFT JOIN user_branch_scopes ubs
        ON ubs.user_id = u.id

      LEFT JOIN branches b
        ON b.id = ubs.branch_id

      GROUP BY
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.phone,
        u.status,
        u.created_at

      ORDER BY u.id DESC
    `;

    const roles = await prisma.$queryRaw<RoleRow[]>`
      SELECT code, name
      FROM roles
      ORDER BY name
    `;

    const branches = await prisma.$queryRaw<BranchRow[]>`
      SELECT id, code, name, status
      FROM branches
      WHERE status = 'ACTIVE'
      ORDER BY name
    `;

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id.toString(),
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        status: user.status,

        roles: (user.role_codes ?? "")
          .split(",")
          .filter(Boolean),

        branches: (user.branch_codes ?? "")
          .split(",")
          .filter(Boolean),

        createdAt: new Date(
          user.created_at,
        ).toISOString(),
      })),

      roles,

      branches: branches.map((branch) => ({
        id: branch.id.toString(),
        code: branch.code,
        name: branch.name,
        status: branch.status,
      })),
    });
  } catch (error) {
    console.error("GET ADMIN USERS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách tài khoản." },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireApiPermission("USER_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<
      string,
      unknown
    >;

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const roleCode =
      typeof body.roleCode === "string"
        ? body.roleCode.trim().toUpperCase()
        : "";

    const branchIdText = String(
      body.branchId ?? "",
    );

    if (
      username.length < 3 ||
      username.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Username phải có từ 3 đến 100 ký tự.",
        },
        { status: 400 },
      );
    }

    if (
      fullName.length < 1 ||
      fullName.length > 150
    ) {
      return NextResponse.json(
        { error: "Họ tên không hợp lệ." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Mật khẩu mới phải có ít nhất 8 ký tự.",
        },
        { status: 400 },
      );
    }

    if (
      email &&
      (
        email.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
    ) {
      return NextResponse.json(
        { error: "Email không hợp lệ." },
        { status: 400 },
      );
    }

    if (phone.length > 30) {
      return NextResponse.json(
        { error: "Số điện thoại quá dài." },
        { status: 400 },
      );
    }

    if (!roleCode) {
      return NextResponse.json(
        { error: "Bạn phải chọn role." },
        { status: 400 },
      );
    }

    if (!/^\d+$/.test(branchIdText)) {
      return NextResponse.json(
        { error: "Bạn phải chọn chi nhánh hợp lệ." },
        { status: 400 },
      );
    }

    const branchId = BigInt(branchIdText);
    const passwordHash = await bcrypt.hash(
      password,
      10,
    );

    const newUserId = await prisma.$transaction(
      async (tx) => {
        const existingUser =
          await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id
            FROM users
            WHERE username = ${username}
            LIMIT 1
          `;

        if (existingUser.length > 0) {
          throw new Error("USERNAME_EXISTS");
        }

        const roleRows =
          await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id
            FROM roles
            WHERE code = ${roleCode}
            LIMIT 1
          `;

        if (roleRows.length === 0) {
          throw new Error("ROLE_NOT_FOUND");
        }

        const branchRows =
          await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id
            FROM branches
            WHERE id = ${branchId}
              AND status = 'ACTIVE'
            LIMIT 1
          `;

        if (branchRows.length === 0) {
          throw new Error("BRANCH_NOT_FOUND");
        }

        await tx.$executeRaw`
          INSERT INTO users (
            username,
            password_hash,
            full_name,
            email,
            phone,
            status,
            created_at
          )
          VALUES (
            ${username},
            ${passwordHash},
            ${fullName},
            ${email || null},
            ${phone || null},
            ${"ACTIVE"},
            NOW()
          )
        `;

        const createdRows =
          await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id
            FROM users
            WHERE username = ${username}
            LIMIT 1
          `;

        const userId = createdRows[0].id;
        const roleId = roleRows[0].id;

        await tx.$executeRaw`
          INSERT INTO user_roles (
            user_id,
            role_id,
            created_at
          )
          VALUES (
            ${userId},
            ${roleId},
            NOW()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO user_branch_scopes (
            user_id,
            branch_id,
            created_at
          )
          VALUES (
            ${userId},
            ${branchId},
            NOW()
          )
        `;

        return userId;
      },
    );

    return NextResponse.json(
      {
        success: true,
        message: "Tạo tài khoản thành công.",
        userId: newUserId.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "USERNAME_EXISTS") {
      return NextResponse.json(
        { error: "Username đã tồn tại." },
        { status: 409 },
      );
    }

    if (message === "ROLE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Role không tồn tại." },
        { status: 400 },
      );
    }

    if (message === "BRANCH_NOT_FOUND") {
      return NextResponse.json(
        {
          error:
            "Chi nhánh không tồn tại hoặc không hoạt động.",
        },
        { status: 400 },
      );
    }

    console.error("CREATE USER ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tạo tài khoản." },
      { status: 500 },
    );
  }
}