import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { ApiError } from "@/lib/api-error";

type Params = { params: Promise<{ id: string }> };

// Quyền tối thiểu của ADMIN: bỏ đi sẽ tự khóa mình khỏi trang quản trị.
const ADMIN_REQUIRED = [
  "ROLE_VIEW",
  "ROLE_UPDATE",
  "USER_VIEW",
  "USER_UPDATE",
  "AUDIT_VIEW",
];

/**
 * PUT /api/roles/:id
 * Body: { permissions: string[] }  (danh sách mã quyền mới của vai trò)
 * Quyền thay đổi có hiệu lực khi người dùng đăng nhập lại.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireApiPermission("ROLE_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Vai trò không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    if (
      !Array.isArray(body.permissions) ||
      body.permissions.length > 500 ||
      body.permissions.some((item) => typeof item !== "string")
    ) {
      return NextResponse.json(
        { error: "Danh sách quyền không hợp lệ." },
        { status: 400 },
      );
    }

    const wanted = new Set<string>(body.permissions as string[]);
    const roleId = BigInt(id);

    const diff = await prisma.$transaction(
      async (tx) => {
        const roles = await tx.$queryRaw<Array<{ id: bigint; code: string }>>`
          SELECT id, code FROM roles WHERE id = ${roleId} LIMIT 1 FOR UPDATE
        `;

        if (roles.length === 0) {
          throw new ApiError("Không tìm thấy vai trò.", 404);
        }

        const all = await tx.$queryRaw<Array<{ id: bigint; code: string }>>`
          SELECT id, code FROM permissions
        `;
        const idByCode = new Map(all.map((p) => [p.code, p.id]));

        for (const code of wanted) {
          if (!idByCode.has(code)) {
            throw new ApiError(`Quyền không tồn tại: ${code}`);
          }
        }

        if (roles[0].code === "ADMIN") {
          const missing = ADMIN_REQUIRED.filter(
            (code) => idByCode.has(code) && !wanted.has(code),
          );

          if (missing.length > 0) {
            throw new ApiError(
              `Không thể bỏ quyền cốt lõi của ADMIN: ${missing.join(", ")}.`,
              409,
            );
          }
        }

        const currentRows = await tx.$queryRaw<Array<{ code: string }>>`
          SELECT p.code
          FROM role_permissions rp
          INNER JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = ${roleId}
        `;
        const current = new Set<string>(currentRows.map((row) => row.code));

        const added = [...wanted].filter((code) => !current.has(code));
        const removed = [...current].filter((code) => !wanted.has(code));

        for (const code of removed) {
          await tx.$executeRaw`
            DELETE FROM role_permissions
            WHERE role_id = ${roleId} AND permission_id = ${idByCode.get(code)!}
          `;
        }

        for (const code of added) {
          await tx.$executeRaw`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (${roleId}, ${idByCode.get(code)!})
          `;
        }

        return { roleCode: roles[0].code, added, removed };
      },
      { timeout: 20000, maxWait: 10000 },
    );

    if (diff.added.length > 0 || diff.removed.length > 0) {
      await writeAudit({
        userId: auth.session.userId,
        action: "ROLE_PERMISSIONS_UPDATE",
        entityType: "role",
        entityId: roleId,
        newData: {
          role: diff.roleCode,
          added: diff.added.join(" "),
          removed: diff.removed.join(" "),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message:
        diff.added.length + diff.removed.length === 0
          ? "Không có thay đổi nào."
          : `Đã cập nhật quyền (+${diff.added.length}, -${diff.removed.length}). Người dùng cần đăng nhập lại để áp dụng.`,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("UPDATE ROLE PERMISSIONS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật quyền của vai trò." },
      { status: 500 },
    );
  }
}