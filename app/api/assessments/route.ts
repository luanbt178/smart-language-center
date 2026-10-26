import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass, isTeacherOnly } from "@/lib/class-access";
import { parseAssessmentInput } from "@/lib/assessments";
import { fromCents } from "@/lib/money";

type AssessmentRow = {
  id: bigint;
  name: string;
  type: string | null;
  max_score: string;
  scheduled_date: string;
  status: string;
  class_code: string;
  class_name: string;
  student_count: bigint | number;
  graded_count: bigint | number;
};

// Học viên và phụ huynh xem điểm ở Cổng thông tin, không dùng API này.
function isPortalRole(role: string): boolean {
  return role === "STUDENT" || role === "PARENT";
}

export async function GET() {
  const auth = await requireApiPermission("ASSESSMENT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  if (isPortalRole(auth.session.role)) {
    return NextResponse.json(
      { error: "Vui lòng xem kết quả trong Cổng thông tin." },
      { status: 403 },
    );
  }

  try {
    const userId = BigInt(auth.session.userId);
    const teacherOnly = isTeacherOnly(auth.session) ? 1 : 0;

    const assessments = await prisma.$queryRaw<AssessmentRow[]>`
      SELECT
        a.id,
        a.name,
        a.type,
        CAST(a.max_score AS CHAR) AS max_score,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') AS scheduled_date,
        a.status,
        c.code AS class_code,
        c.name AS class_name,
        (
          SELECT COUNT(*) FROM enrollments e
          WHERE e.class_id = c.id AND e.status = 'ACTIVE'
        ) AS student_count,
        (
          SELECT COUNT(*)
          FROM assessment_attempts t
          INNER JOIN assessment_results r ON r.attempt_id = t.id
          WHERE t.assessment_id = a.id
        ) AS graded_count
      FROM assessments a
      INNER JOIN classes c ON c.id = a.class_id
      WHERE EXISTS (
        SELECT 1 FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId} AND scope.branch_id = c.branch_id
      )
      AND (
        ${teacherOnly} = 0
        OR EXISTS (
          SELECT 1
          FROM teacher_assignments ta
          INNER JOIN teachers t ON t.id = ta.teacher_id
          WHERE ta.class_id = c.id AND t.user_id = ${userId}
        )
      )
      ORDER BY a.id DESC
    `;

    let classes: Array<{ id: bigint; code: string; name: string }> = [];

    if (auth.session.permissions.includes("ASSESSMENT_CREATE")) {
      classes = await prisma.$queryRaw<
        Array<{ id: bigint; code: string; name: string }>
      >`
        SELECT c.id, c.code, c.name
        FROM classes c
        WHERE c.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId} AND scope.branch_id = c.branch_id
          )
          AND (
            ${teacherOnly} = 0
            OR EXISTS (
              SELECT 1
              FROM teacher_assignments ta
              INNER JOIN teachers t ON t.id = ta.teacher_id
              WHERE ta.class_id = c.id AND t.user_id = ${userId}
            )
          )
        ORDER BY c.id DESC
      `;
    }

    return NextResponse.json({
      assessments: assessments.map((row) => ({
        id: row.id.toString(),
        name: row.name,
        type: row.type,
        maxScore: row.max_score,
        scheduledDate: row.scheduled_date,
        status: row.status,
        classCode: row.class_code,
        className: row.class_name,
        studentCount: Number(row.student_count),
        gradedCount: Number(row.graded_count),
      })),
      classes: classes.map((row) => ({
        id: row.id.toString(),
        label: `${row.code} - ${row.name}`,
      })),
    });
  } catch (error) {
    console.error("GET ASSESSMENTS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách bài đánh giá." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("ASSESSMENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseAssessmentInput(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.data;
    const found = await findAccessibleClass(auth.session, input.classId);

    if (!found) {
      return NextResponse.json(
        { error: "Không tìm thấy lớp hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    if (found.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Lớp đã đóng, không thể tạo bài đánh giá." },
        { status: 400 },
      );
    }

    const userId = BigInt(auth.session.userId);

    await prisma.$executeRaw`
      INSERT INTO assessments (class_id, name, type, max_score, scheduled_at, status, created_by)
      VALUES (
        ${input.classId},
        ${input.name},
        ${input.type},
        ${fromCents(input.maxScoreCents)},
        ${`${input.scheduledDate} 00:00:00`},
        ${"OPEN"},
        ${userId}
      )
    `;

    return NextResponse.json(
      { success: true, message: `Đã tạo bài đánh giá "${input.name}".` },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE ASSESSMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tạo bài đánh giá." },
      { status: 500 },
    );
  }
}