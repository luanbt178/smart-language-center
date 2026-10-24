import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

const allowedStatuses = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
] as const;

type LeadAccessRow = {
  branch_id: bigint;
};

function optionalText(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  if (result.length > maxLength) {
    return null;
  }

  return result;
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireApiPermission("LEAD_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID Lead không hợp lệ." },
        { status: 400 },
      );
    }

    const leadId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const body = (await request.json()) as Record<string, unknown>;

    const fullName = optionalText(body.fullName, 150);
    const phone = optionalText(body.phone, 30);
    const email = optionalText(body.email, 150);
    const source = optionalText(body.source, 50);
    const status =
      typeof body.status === "string"
        ? body.status
        : "";

    if (!fullName) {
      return NextResponse.json(
        { error: "Họ tên khách hàng là bắt buộc." },
        { status: 400 },
      );
    }

    if (
      !allowedStatuses.includes(
        status as (typeof allowedStatuses)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Trạng thái Lead không hợp lệ." },
        { status: 400 },
      );
    }

    if (
      body.phone !== undefined &&
      body.phone !== null &&
      typeof body.phone !== "string"
    ) {
      return NextResponse.json(
        { error: "Số điện thoại không hợp lệ." },
        { status: 400 },
      );
    }

    if (
      body.email !== undefined &&
      body.email !== null &&
      typeof body.email !== "string"
    ) {
      return NextResponse.json(
        { error: "Email không hợp lệ." },
        { status: 400 },
      );
    }

    if (
      body.source !== undefined &&
      body.source !== null &&
      typeof body.source !== "string"
    ) {
      return NextResponse.json(
        { error: "Nguồn khách hàng không hợp lệ." },
        { status: 400 },
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email không đúng định dạng." },
        { status: 400 },
      );
    }

    const accessibleLeads = await prisma.$queryRaw<
      LeadAccessRow[]
    >`
      SELECT l.branch_id
      FROM leads l
      WHERE l.id = ${leadId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = l.branch_id
        )
      LIMIT 1
    `;

    if (accessibleLeads.length === 0) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy Lead hoặc bạn không có quyền truy cập.",
        },
        { status: 404 },
      );
    }

    const branchId = accessibleLeads[0].branch_id;

    const assignedIdText = String(
      body.assignedUserId ?? "",
    ).trim();

    if (assignedIdText && !/^\d+$/.test(assignedIdText)) {
      return NextResponse.json(
        { error: "Nhân viên được phân công không hợp lệ." },
        { status: 400 },
      );
    }

    let assignedUserId: bigint | null = null;

    if (assignedIdText) {
      assignedUserId = BigInt(assignedIdText);

      const validAssignee = await prisma.$queryRaw<
        Array<{ id: bigint }>
      >`
        SELECT u.id
        FROM users u
        INNER JOIN user_roles ur
          ON ur.user_id = u.id
        INNER JOIN roles r
          ON r.id = ur.role_id
        WHERE u.id = ${assignedUserId}
          AND u.status = 'ACTIVE'
          AND r.code = 'SALES'
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes scope
            WHERE scope.user_id = u.id
              AND scope.branch_id = ${branchId}
          )
        LIMIT 1
      `;

      if (validAssignee.length === 0) {
        return NextResponse.json(
          {
            error:
              "Nhân viên được chọn không thuộc Sales hoặc không có phạm vi chi nhánh phù hợp.",
          },
          { status: 400 },
        );
      }
    }

    const affected = await prisma.$executeRaw`
      UPDATE leads
      SET
        full_name = ${fullName},
        phone = ${phone || null},
        email = ${email || null},
        source = ${source || null},
        status = ${status},
        assigned_user_id = ${assignedUserId}
      WHERE id = ${leadId}
        AND branch_id = ${branchId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = leads.branch_id
        )
    `;

    return NextResponse.json({
      success: true,
      message: "Cập nhật Lead thành công.",
    });
  } catch (error) {
    console.error("UPDATE LEAD ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật Lead." },
      { status: 500 },
    );
  }
}