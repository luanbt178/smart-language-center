import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

// Danh sách vai trò, quyền của từng vai trò và toàn bộ quyền trong hệ thống.
export async function GET() {
  const auth = await requireApiPermission("ROLE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [roles, links, permissions] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: bigint;
          code: string;
          name: string;
          description: string | null;
          user_count: bigint | number;
        }>
      >`
        SELECT
          r.id, r.code, r.name, r.description,
          (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
        FROM roles r
        ORDER BY r.id
      `,
      prisma.$queryRaw<Array<{ role_id: bigint; code: string }>>`
        SELECT rp.role_id, p.code
        FROM role_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
      `,
      prisma.$queryRaw<
        Array<{
          code: string;
          name: string;
          module: string | null;
          description: string | null;
        }>
      >`
        SELECT code, name, module, description
        FROM permissions
        ORDER BY module, code
      `,
    ]);

    return NextResponse.json({
      roles: roles.map((role) => ({
        id: role.id.toString(),
        code: role.code,
        name: role.name,
        description: role.description,
        userCount: Number(role.user_count),
        permissions: Array.from(
          new Set(
            links
              .filter((link) => link.role_id === role.id)
              .map((link) => link.code),
          ),
        ),
      })),
      permissions,
    });
  } catch (error) {
    console.error("GET ROLES ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách vai trò." },
      { status: 500 },
    );
  }
}