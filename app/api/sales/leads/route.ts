import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

type LeadRow = {
  id: bigint;
  branch_id: bigint;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  assigned_user_id: bigint | null;
  assigned_username: string | null;
  assigned_full_name: string | null;
  branch_code: string;
  branch_name: string;
  created_at: Date | string;
};

type BranchRow = {
  id: bigint;
  code: string;
  name: string;
};

type SalesUserRow = {
  id: bigint;
  username: string;
  full_name: string;
  branch_ids: string | null;
};

function textField(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) {
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

export async function GET() {
  const auth = await requireApiPermission("LEAD_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const leads = await prisma.$queryRaw<LeadRow[]>`
      SELECT
        l.id,
        l.branch_id,
        l.full_name,
        l.phone,
        l.email,
        l.source,
        l.status,
        l.assigned_user_id,
        l.created_at,

        b.code AS branch_code,
        b.name AS branch_name,

        u.username AS assigned_username,
        u.full_name AS assigned_full_name

      FROM leads l

      INNER JOIN branches b
        ON b.id = l.branch_id

      LEFT JOIN users u
        ON u.id = l.assigned_user_id

      WHERE EXISTS (
        SELECT 1
        FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId}
          AND scope.branch_id = l.branch_id
      )

      ORDER BY l.created_at DESC, l.id DESC
    `;

    const branches = await prisma.$queryRaw<BranchRow[]>`
      SELECT DISTINCT
        b.id,
        b.code,
        b.name
      FROM branches b
      INNER JOIN user_branch_scopes scope
        ON scope.branch_id = b.id
      WHERE scope.user_id = ${userId}
        AND b.status = 'ACTIVE'
      ORDER BY b.name
    `;

    const salesUsers = await prisma.$queryRaw<SalesUserRow[]>`
      SELECT
        u.id,
        u.username,
        u.full_name,

        GROUP_CONCAT(
          DISTINCT staff_scope.branch_id
          ORDER BY staff_scope.branch_id
          SEPARATOR ','
        ) AS branch_ids

      FROM users u

      INNER JOIN user_roles ur
        ON ur.user_id = u.id

      INNER JOIN roles r
        ON r.id = ur.role_id

      INNER JOIN user_branch_scopes staff_scope
        ON staff_scope.user_id = u.id

      INNER JOIN user_branch_scopes current_scope
        ON current_scope.branch_id = staff_scope.branch_id
        AND current_scope.user_id = ${userId}

      WHERE r.code = 'SALES'
        AND u.status = 'ACTIVE'

      GROUP BY
        u.id,
        u.username,
        u.full_name

      ORDER BY u.full_name
    `;

    return NextResponse.json({
      leads: leads.map((lead) => ({
        id: lead.id.toString(),
        branchId: lead.branch_id.toString(),
        branchCode: lead.branch_code,
        branchName: lead.branch_name,
        fullName: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        status: lead.status,

        assignedUserId:
          lead.assigned_user_id?.toString() ?? null,

        assignedUsername: lead.assigned_username,
        assignedFullName: lead.assigned_full_name,

        createdAt: new Date(lead.created_at).toISOString(),
      })),

      branches: branches.map((branch) => ({
        id: branch.id.toString(),
        code: branch.code,
        name: branch.name,
      })),

      salesUsers: salesUsers.map((user) => ({
        id: user.id.toString(),
        username: user.username,
        fullName: user.full_name,
        branchIds: (user.branch_ids ?? "").split(",").filter(Boolean),
      })),
    });
  } catch (error) {
    console.error("GET LEADS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách khách hàng tiềm năng." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("LEAD_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const fullName = textField(body.fullName, 150);
    const phone = textField(body.phone, 30);
    const email = textField(body.email, 150);
    const source = textField(body.source, 50);

    const branchIdText = String(body.branchId ?? "");
    const assignedIdText = String(body.assignedUserId ?? "").trim();

    if (!fullName || fullName.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng nhập họ tên khách hàng." },
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

    if (
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      return NextResponse.json(
        { error: "Email không đúng định dạng." },
        { status: 400 },
      );
    }

    if (!/^\d+$/.test(branchIdText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn chi nhánh hợp lệ." },
        { status: 400 },
      );
    }

    if (assignedIdText && !/^\d+$/.test(assignedIdText)) {
      return NextResponse.json(
        { error: "Nhân viên được phân công không hợp lệ." },
        { status: 400 },
      );
    }

    const branchId = BigInt(branchIdText);
    const userId = BigInt(auth.session.userId);

    // Chi nhánh phải thuộc phạm vi của người tạo Lead.
    const allowedBranches = await prisma.$queryRaw<
      Array<{ id: bigint }>
    >`
      SELECT b.id
      FROM branches b
      INNER JOIN user_branch_scopes scope
        ON scope.branch_id = b.id
      WHERE b.id = ${branchId}
        AND b.status = 'ACTIVE'
        AND scope.user_id = ${userId}
      LIMIT 1
    `;

    if (allowedBranches.length === 0) {
      return NextResponse.json(
        {
          error:
            "Bạn không có quyền tạo Lead tại chi nhánh này.",
        },
        { status: 403 },
      );
    }

        // Chặn trùng khách hàng cùng chi nhánh (theo SĐT hoặc email).
    if (phone || email) {
      const duplicates = await prisma.$queryRaw<
        Array<{ id: bigint; full_name: string }>
      >`
        SELECT id, full_name
        FROM leads
        WHERE branch_id = ${branchId}
          AND (
            (${phone || ""} <> '' AND phone = ${phone || ""})
            OR (${email || ""} <> '' AND email = ${email || ""})
          )
        LIMIT 1
      `;

      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            error: `Khách hàng đã tồn tại: ${duplicates[0].full_name} (trùng số điện thoại hoặc email).`,
          },
          { status: 409 },
        );
      }
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
              "Nhân viên được chọn không có quyền Sales tại chi nhánh này.",
          },
          { status: 400 },
        );
      }
    }

    const createdId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO leads (
          branch_id,
          full_name,
          phone,
          email,
          source,
          status,
          assigned_user_id,
          created_at
        )
        VALUES (
          ${branchId},
          ${fullName},
          ${phone || null},
          ${email || null},
          ${source || null},
          ${"NEW"},
          ${assignedUserId},
          NOW()
        )
      `;

      const ids = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      return ids[0].id;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Tạo khách hàng tiềm năng thành công.",
        id: createdId.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE LEAD ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tạo khách hàng tiềm năng." },
      { status: 500 },
    );
  }
}