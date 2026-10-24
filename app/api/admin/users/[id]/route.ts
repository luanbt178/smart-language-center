import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireApiPermission("USER_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID tài khoản không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<
      string,
      unknown
    >;

    const status =
      typeof body.status === "string"
        ? body.status
        : "";

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return NextResponse.json(
        { error: "Trạng thái không hợp lệ." },
        { status: 400 },
      );
    }

    const userId = BigInt(id);

    // Không cho tài khoản tự khóa chính mình.
    if (
      status === "INACTIVE" &&
      auth.session.userId === id
    ) {
      return NextResponse.json(
        {
          error:
            "Bạn không thể khóa tài khoản đang đăng nhập.",
        },
        { status: 400 },
      );
    }

    const targets =
      await prisma.$queryRaw<
        Array<{
          id: bigint;
          username: string;
          status: string;
        }>
      >`
        SELECT id, username, status
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản." },
        { status: 404 },
      );
    }

    const target = targets[0];

    if (
      target.status === "ACTIVE" &&
      status === "INACTIVE"
    ) {
      const targetRoles =
        await prisma.$queryRaw<
          Array<{ code: string }>
        >`
          SELECT r.code
          FROM user_roles ur
          INNER JOIN roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = ${userId}
        `;

      const isAdmin = targetRoles.some(
        (role) => role.code === "ADMIN",
      );

      if (isAdmin) {
        const counts =
          await prisma.$queryRaw<
            Array<{ total: bigint | number }>
          >`
            SELECT COUNT(DISTINCT u.id) AS total
            FROM users u
            INNER JOIN user_roles ur
              ON ur.user_id = u.id
            INNER JOIN roles r
              ON r.id = ur.role_id
            WHERE r.code = 'ADMIN'
              AND u.status = 'ACTIVE'
          `;

        if (Number(counts[0].total) <= 1) {
          return NextResponse.json(
            {
              error:
                "Không thể khóa tài khoản ADMIN đang hoạt động cuối cùng.",
            },
            { status: 409 },
          );
        }
      }
    }

    await prisma.$executeRaw`
      UPDATE users
      SET status = ${status}
      WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message:
        status === "ACTIVE"
          ? "Đã kích hoạt tài khoản."
          : "Đã khóa tài khoản.",
    });
  } catch (error) {
    console.error("UPDATE USER STATUS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật tài khoản." },
      { status: 500 },
    );
  }
}