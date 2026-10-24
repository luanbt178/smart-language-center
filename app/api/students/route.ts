import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import {
  makeStudentCode,
  parseStudentInput,
} from "@/lib/students";

type StudentRow = {
  id: bigint;
  branch_id: bigint;
  student_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  status: string;
  branch_code: string;
  branch_name: string;
  enrollment_count: bigint | number;
};

type BranchRow = {
  id: bigint;
  code: string;
  name: string;
};

type LeadOptionRow = {
  id: bigint;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  branch_code: string;
};

export async function GET() {
  const auth = await requireApiPermission("STUDENT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const students = await prisma.$queryRaw<StudentRow[]>`
      SELECT
        s.id,
        s.branch_id,
        s.student_code,
        s.full_name,
        s.phone,
        s.email,
        s.gender,
        DATE_FORMAT(s.dob, '%Y-%m-%d') AS dob,
        s.address,
        s.status,
        b.code AS branch_code,
        b.name AS branch_name,
        (
          SELECT COUNT(*)
          FROM enrollments e
          WHERE e.student_id = s.id
        ) AS enrollment_count
      FROM students s
      INNER JOIN branches b ON b.id = s.branch_id
      WHERE EXISTS (
        SELECT 1
        FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId}
          AND scope.branch_id = s.branch_id
      )
      ORDER BY s.id DESC
    `;

    const branches = await prisma.$queryRaw<BranchRow[]>`
      SELECT DISTINCT b.id, b.code, b.name
      FROM branches b
      INNER JOIN user_branch_scopes scope ON scope.branch_id = b.id
      WHERE scope.user_id = ${userId}
        AND b.status = 'ACTIVE'
      ORDER BY b.name
    `;

    // Chỉ người có quyền sửa Lead mới thấy danh sách khách hàng để chuyển đổi.
    let leads: LeadOptionRow[] = [];

    if (auth.session.permissions.includes("LEAD_UPDATE")) {
      leads = await prisma.$queryRaw<LeadOptionRow[]>`
        SELECT
          l.id,
          l.full_name,
          l.phone,
          l.email,
          l.status,
          b.code AS branch_code
        FROM leads l
        INNER JOIN branches b ON b.id = l.branch_id
        WHERE l.status IN ('NEW', 'CONTACTED', 'QUALIFIED')
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId}
              AND scope.branch_id = l.branch_id
          )
        ORDER BY l.full_name
      `;
    }

    return NextResponse.json({
      students: students.map((row) => ({
        id: row.id.toString(),
        branchId: row.branch_id.toString(),
        branchCode: row.branch_code,
        branchName: row.branch_name,
        studentCode: row.student_code,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        gender: row.gender,
        dob: row.dob,
        address: row.address,
        status: row.status,
        enrollmentCount: Number(row.enrollment_count),
      })),

      branches: branches.map((row) => ({
        id: row.id.toString(),
        code: row.code,
        name: row.name,
      })),

      leads: leads.map((row) => ({
        id: row.id.toString(),
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        status: row.status,
        branchCode: row.branch_code,
      })),
    });
  } catch (error) {
    console.error("GET STUDENTS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách học viên." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/students
 *  - Có "leadId"  : chuyển khách hàng thành học viên.
 *  - Không có     : thêm học viên trực tiếp (cần "branchId").
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission("STUDENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = BigInt(auth.session.userId);

    const leadIdText = String(body.leadId ?? "").trim();

    let leadId: bigint | null = null;
    let branchId: bigint;
    let source: Record<string, unknown> = body;

    if (leadIdText !== "") {
      // ---------- Chuyển từ khách hàng ----------
      const leadAuth = await requireApiPermission("LEAD_UPDATE");

      if (!leadAuth.ok) {
        return leadAuth.response;
      }

      if (!/^\d+$/.test(leadIdText)) {
        return NextResponse.json(
          { error: "Khách hàng không hợp lệ." },
          { status: 400 },
        );
      }

      leadId = BigInt(leadIdText);

      const leads = await prisma.$queryRaw<
        Array<{
          id: bigint;
          branch_id: bigint;
          full_name: string;
          phone: string | null;
          email: string | null;
          status: string;
        }>
      >`
        SELECT l.id, l.branch_id, l.full_name, l.phone, l.email, l.status
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

      if (leads.length === 0) {
        return NextResponse.json(
          { error: "Không tìm thấy khách hàng hoặc bạn không có quyền." },
          { status: 404 },
        );
      }

      const lead = leads[0];

      if (lead.status === "CONVERTED" || lead.status === "LOST") {
        return NextResponse.json(
          {
            error:
              "Khách hàng đã chuyển đổi hoặc đã dừng, không thể chuyển thành học viên.",
          },
          { status: 400 },
        );
      }

      branchId = lead.branch_id;

      source = {
        ...body,
        fullName: lead.full_name,
        phone: lead.phone,
        email: lead.email,
      };
    } else {
      // ---------- Thêm trực tiếp ----------
      const branchIdText = String(body.branchId ?? "");

      if (!/^\d+$/.test(branchIdText)) {
        return NextResponse.json(
          { error: "Vui lòng chọn chi nhánh." },
          { status: 400 },
        );
      }

      branchId = BigInt(branchIdText);

      const allowed = await prisma.$queryRaw<Array<{ id: bigint }>>`
        SELECT b.id
        FROM branches b
        INNER JOIN user_branch_scopes scope ON scope.branch_id = b.id
        WHERE b.id = ${branchId}
          AND b.status = 'ACTIVE'
          AND scope.user_id = ${userId}
        LIMIT 1
      `;

      if (allowed.length === 0) {
        return NextResponse.json(
          { error: "Bạn không có quyền thêm học viên ở chi nhánh này." },
          { status: 403 },
        );
      }
    }

    const parsed = parseStudentInput(source);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // Chặn trùng học viên cùng chi nhánh (theo SĐT hoặc email).
    if (input.phone || input.email) {
      const duplicates = await prisma.$queryRaw<
        Array<{ student_code: string; full_name: string }>
      >`
        SELECT student_code, full_name
        FROM students
        WHERE branch_id = ${branchId}
          AND (
            (${input.phone ?? ""} <> '' AND phone = ${input.phone ?? ""})
            OR (${input.email ?? ""} <> '' AND email = ${input.email ?? ""})
          )
        LIMIT 1
      `;

      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            error: `Học viên đã tồn tại: ${duplicates[0].full_name} (${duplicates[0].student_code}) - trùng số điện thoại hoặc email.`,
          },
          { status: 409 },
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      // Mã tạm (duy nhất), ngay sau đó đổi thành mã thật từ id.
      const tempCode = `TMP-${randomUUID()}`;

      await tx.$executeRaw`
        INSERT INTO students (
          branch_id,
          full_name,
          email,
          phone,
          gender,
          created_at,
          status,
          student_code,
          dob,
          address
        )
        VALUES (
          ${branchId},
          ${input.fullName},
          ${input.email},
          ${input.phone},
          ${input.gender},
          NOW(),
          ${"ACTIVE"},
          ${tempCode},
          ${input.dob},
          ${input.address}
        )
      `;

      const ids = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      const studentId = ids[0].id;
      const studentCode = makeStudentCode(studentId);

      await tx.$executeRaw`
        UPDATE students
        SET student_code = ${studentCode}
        WHERE id = ${studentId}
      `;

      if (leadId !== null) {
        await tx.$executeRaw`
          UPDATE leads
          SET status = 'CONVERTED'
          WHERE id = ${leadId}
        `;

        // Gắn các bài kiểm tra đầu vào của khách hàng vào học viên.
        await tx.$executeRaw`
          UPDATE placement_tests
          SET student_id = ${studentId}
          WHERE lead_id = ${leadId}
            AND student_id IS NULL
        `;
      }

      return { studentId, studentCode };
    });

    return NextResponse.json(
      {
        success: true,
        message:
          leadId !== null
            ? `Đã chuyển thành học viên. Mã: ${created.studentCode}.`
            : `Đã thêm học viên. Mã: ${created.studentCode}.`,
        id: created.studentId.toString(),
        studentCode: created.studentCode,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE STUDENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tạo học viên." },
      { status: 500 },
    );
  }
}