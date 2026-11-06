import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { STUDENT_STATUSES, parseStudentInput } from "@/lib/students";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireApiPermission("STUDENT_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID học viên không hợp lệ." },
        { status: 400 },
      );
    }

    const studentId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const body = (await request.json()) as Record<string, unknown>;

    const status = typeof body.status === "string" ? body.status : "";

    if (!(STUDENT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: "Trạng thái học viên không hợp lệ." },
        { status: 400 },
      );
    }

    const parsed = parseStudentInput(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }

    const input = parsed.data;

    const students = await prisma.$queryRaw<Array<{ branch_id: bigint }>>`
      SELECT s.branch_id
      FROM students s
      WHERE s.id = ${studentId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = s.branch_id
        )
      LIMIT 1
    `;

    if (students.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy học viên hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const branchId = students[0].branch_id;

    // Chặn trùng với học viên khác cùng chi nhánh.
    if (input.phone || input.email) {
      const duplicates = await prisma.$queryRaw<
        Array<{ student_code: string; full_name: string }>
      >`
        SELECT student_code, full_name
        FROM students
        WHERE branch_id = ${branchId}
          AND id <> ${studentId}
          AND (
            (${input.phone ?? ""} <> '' AND phone = ${input.phone ?? ""})
            OR (${input.email ?? ""} <> '' AND email = ${input.email ?? ""})
          )
        LIMIT 1
      `;

      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            error: `Trùng với học viên ${duplicates[0].full_name} (${duplicates[0].student_code}).`,
          },
          { status: 409 },
        );
      }
    }

    await prisma.$executeRaw`
      UPDATE students
      SET
        full_name = ${input.fullName},
        phone = ${input.phone},
        email = ${input.email},
        gender = ${input.gender},
        dob = ${input.dob},
        address = ${input.address},
        status = ${status}
      WHERE id = ${studentId}
        AND branch_id = ${branchId}
    `;

    return NextResponse.json({
      success: true,
      message: "Cập nhật học viên thành công.",
    });
  } catch (error) {
    console.error("UPDATE STUDENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật học viên." },
      { status: 500 },
    );
  }
}
/**
 * GET /api/students/{id}
 * Hồ sơ học viên: thông tin cá nhân, phụ huynh, các lần ghi danh.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("STUDENT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID học viên không hợp lệ." },
        { status: 400 },
      );
    }

    const studentId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const students = await prisma.$queryRaw<
      Array<{
        id: bigint;
        student_code: string;
        full_name: string;
        phone: string | null;
        email: string | null;
        gender: string | null;
        dob: string | null;
        address: string | null;
        status: string;
        created_at: string;
        branch_name: string;
      }>
    >`
      SELECT
        s.id,
        s.student_code,
        s.full_name,
        s.phone,
        s.email,
        s.gender,
        DATE_FORMAT(s.dob, '%Y-%m-%d') AS dob,
        s.address,
        s.status,
        DATE_FORMAT(s.created_at, '%Y-%m-%d') AS created_at,
        b.name AS branch_name
      FROM students s
      INNER JOIN branches b ON b.id = s.branch_id
      WHERE s.id = ${studentId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = s.branch_id
        )
      LIMIT 1
    `;

    if (students.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy học viên." },
        { status: 404 },
      );
    }

    const guardians = await prisma.$queryRaw<
      Array<{
        link_id: bigint;
        full_name: string;
        phone: string | null;
        email: string | null;
        address: string | null;
        relationship: string | null;
        is_primary: number | bigint | null;
      }>
    >`
      SELECT
        sg.id AS link_id,
        g.full_name,
        g.phone,
        g.email,
        g.address,
        sg.relationship,
        sg.is_primary
      FROM student_guardians sg
      INNER JOIN guardians g ON g.id = sg.guardian_id
      WHERE sg.student_id = ${studentId}
      ORDER BY sg.is_primary DESC, g.full_name
    `;

    const enrollments = await prisma.$queryRaw<
      Array<{
        id: bigint;
        status: string;
        price: string;
        created_at: string;
        course_name: string;
        version_no: string;
        offering_code: string;
        class_code: string | null;
        class_name: string | null;
      }>
    >`
      SELECT
        e.id,
        e.status,
        CAST(e.price_snapshot AS CHAR) AS price,
        DATE_FORMAT(e.created_at, '%Y-%m-%d') AS created_at,
        c.name AS course_name,
        cv.version_no,
        o.code AS offering_code,
        cl.code AS class_code,
        cl.name AS class_name
      FROM enrollments e
      INNER JOIN course_versions cv ON cv.id = e.course_version_id
      INNER JOIN courses c ON c.id = cv.course_id
      INNER JOIN course_offerings o ON o.id = e.course_offering_id
      LEFT JOIN classes cl ON cl.id = e.class_id
      WHERE e.student_id = ${studentId}
      ORDER BY e.id DESC
    `;

    const s = students[0];

    return NextResponse.json({
      student: {
        id: s.id.toString(),
        studentCode: s.student_code,
        fullName: s.full_name,
        phone: s.phone,
        email: s.email,
        gender: s.gender,
        dob: s.dob,
        address: s.address,
        status: s.status,
        createdAt: s.created_at,
        branchName: s.branch_name,
      },
      guardians: guardians.map((g) => ({
        linkId: g.link_id.toString(),
        fullName: g.full_name,
        phone: g.phone,
        email: g.email,
        address: g.address,
        relationship: g.relationship,
        isPrimary: Number(g.is_primary) === 1,
      })),
      enrollments: enrollments.map((e) => ({
        id: e.id.toString(),
        status: e.status,
        price: e.price,
        createdAt: e.created_at,
        courseName: e.course_name,
        versionNo: e.version_no,
        offeringCode: e.offering_code,
        classCode: e.class_code,
        className: e.class_name,
      })),
    });
  } catch (error) {
    console.error("GET STUDENT PROFILE ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải hồ sơ học viên." },
      { status: 500 },
    );
  }
}