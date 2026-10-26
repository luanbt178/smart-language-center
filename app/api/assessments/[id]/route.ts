import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";
import { parseScores } from "@/lib/assessments";
import { fromCents, toCents } from "@/lib/money";

type Params = { params: Promise<{ id: string }> };

type AssessmentInfo = {
  id: bigint;
  class_id: bigint;
  name: string;
  type: string | null;
  max_score: string;
  scheduled_date: string;
  status: string;
  class_code: string;
  class_name: string;
};

async function loadAssessment(id: bigint): Promise<AssessmentInfo | null> {
  const rows = await prisma.$queryRaw<AssessmentInfo[]>`
    SELECT
      a.id,
      a.class_id,
      a.name,
      a.type,
      CAST(a.max_score AS CHAR) AS max_score,
      DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') AS scheduled_date,
      a.status,
      c.code AS class_code,
      c.name AS class_name
    FROM assessments a
    INNER JOIN classes c ON c.id = a.class_id
    WHERE a.id = ${id}
    LIMIT 1
  `;

  return rows.length > 0 ? rows[0] : null;
}

// Bảng điểm: học viên đang học trong lớp + điểm đã nhập.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission("ASSESSMENT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.session.role === "STUDENT" || auth.session.role === "PARENT") {
    return NextResponse.json(
      { error: "Vui lòng xem kết quả trong Cổng thông tin." },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Bài đánh giá không hợp lệ." },
        { status: 400 },
      );
    }

    const assessment = await loadAssessment(BigInt(id));

    if (
      !assessment ||
      !(await findAccessibleClass(auth.session, assessment.class_id))
    ) {
      return NextResponse.json(
        { error: "Không tìm thấy bài đánh giá hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const students = await prisma.$queryRaw<
      Array<{
        student_id: bigint;
        student_code: string;
        full_name: string;
        score: string | null;
        feedback: string | null;
      }>
    >`
      SELECT
        s.id AS student_id,
        s.student_code,
        s.full_name,
        CAST(r.score AS CHAR) AS score,
        r.feedback
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      LEFT JOIN assessment_attempts t
        ON t.assessment_id = ${assessment.id}
        AND t.student_id = s.id
        AND t.attempt_no = 1
      LEFT JOIN assessment_results r ON r.attempt_id = t.id
      WHERE e.class_id = ${assessment.class_id} AND e.status = 'ACTIVE'
      ORDER BY s.full_name
    `;

    return NextResponse.json({
      assessment: {
        id: assessment.id.toString(),
        name: assessment.name,
        type: assessment.type,
        maxScore: assessment.max_score,
        scheduledDate: assessment.scheduled_date,
        status: assessment.status,
        classCode: assessment.class_code,
        className: assessment.class_name,
      },
      students: students.map((row) => ({
        studentId: row.student_id.toString(),
        studentCode: row.student_code,
        fullName: row.full_name,
        score: row.score,
        feedback: row.feedback,
      })),
    });
  } catch (error) {
    console.error("GET ASSESSMENT SHEET ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải bảng điểm." },
      { status: 500 },
    );
  }
}

// Lưu điểm (chỉ khi bài chưa công bố).
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireApiPermission("ASSESSMENT_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Bài đánh giá không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const assessment = await loadAssessment(BigInt(id));

    if (
      !assessment ||
      !(await findAccessibleClass(auth.session, assessment.class_id))
    ) {
      return NextResponse.json(
        { error: "Không tìm thấy bài đánh giá hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const maxCents = toCents(assessment.max_score) ?? BigInt(0);
    const parsed = parseScores(body.scores, maxCents);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const userId = BigInt(auth.session.userId);
    const scores = parsed.data;

    await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM assessments WHERE id = ${assessment.id} FOR UPDATE
        `;

        if (locked[0].status !== "OPEN") {
          throw new ApiError(
            "Bài đã công bố kết quả, không thể sửa điểm.",
            409,
          );
        }

        const roster = await tx.$queryRaw<Array<{ student_id: bigint }>>`
          SELECT student_id
          FROM enrollments
          WHERE class_id = ${assessment.class_id} AND status = 'ACTIVE'
        `;

        const allowed = new Set(roster.map((r) => r.student_id.toString()));

        for (const item of scores) {
          if (!allowed.has(item.studentId.toString())) {
            throw new ApiError(
              "Có học viên không thuộc lớp này hoặc đã nghỉ học.",
            );
          }
        }

        for (const item of scores) {
          const scoreText = fromCents(item.scoreCents);

          let attempts = await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id FROM assessment_attempts
            WHERE assessment_id = ${assessment.id}
              AND student_id = ${item.studentId}
              AND attempt_no = 1
            LIMIT 1
          `;

          if (attempts.length === 0) {
            await tx.$executeRaw`
              INSERT INTO assessment_attempts (assessment_id, student_id, attempt_no, started_at, submitted_at, status)
              VALUES (${assessment.id}, ${item.studentId}, 1, NULL, NULL, ${"GRADED"})
            `;

            attempts = await tx.$queryRaw<Array<{ id: bigint }>>`
              SELECT LAST_INSERT_ID() AS id
            `;
          }

          const attemptId = attempts[0].id;

          const results = await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id FROM assessment_results WHERE attempt_id = ${attemptId} LIMIT 1
          `;

          if (results.length > 0) {
            await tx.$executeRaw`
              UPDATE assessment_results
              SET score = ${scoreText}, feedback = ${item.feedback},
                  graded_by = ${userId}, graded_at = NOW(), status = ${"GRADED"}
              WHERE id = ${results[0].id}
            `;
          } else {
            await tx.$executeRaw`
              INSERT INTO assessment_results (attempt_id, score, feedback, graded_by, graded_at, published_at, status)
              VALUES (${attemptId}, ${scoreText}, ${item.feedback}, ${userId}, NOW(), NULL, ${"GRADED"})
            `;
          }
        }
      },
      { timeout: 30000, maxWait: 10000 },
    );

    return NextResponse.json({
      success: true,
      message: `Đã lưu điểm cho ${scores.length} học viên.`,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("SAVE SCORES ERROR:", error);

    return NextResponse.json(
      { error: "Không thể lưu điểm." },
      { status: 500 },
    );
  }
}

// Công bố kết quả cho học viên và phụ huynh (không hoàn tác được).
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission("ASSESSMENT_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Bài đánh giá không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    if (body.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Hiện chỉ hỗ trợ công bố kết quả." },
        { status: 400 },
      );
    }

    const assessment = await loadAssessment(BigInt(id));

    if (
      !assessment ||
      !(await findAccessibleClass(auth.session, assessment.class_id))
    ) {
      return NextResponse.json(
        { error: "Không tìm thấy bài đánh giá hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM assessments WHERE id = ${assessment.id} FOR UPDATE
      `;

      if (locked[0].status !== "OPEN") {
        throw new ApiError("Bài này đã được công bố.", 409);
      }

      const graded = await tx.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total
        FROM assessment_results r
        INNER JOIN assessment_attempts t ON t.id = r.attempt_id
        WHERE t.assessment_id = ${assessment.id}
      `;

      if (Number(graded[0].total) === 0) {
        throw new ApiError("Chưa có điểm nào, không thể công bố.");
      }

      await tx.$executeRaw`
        UPDATE assessment_results r
        INNER JOIN assessment_attempts t ON t.id = r.attempt_id
        SET r.published_at = NOW(), r.status = 'PUBLISHED'
        WHERE t.assessment_id = ${assessment.id}
      `;

      await tx.$executeRaw`
        UPDATE assessments SET status = 'PUBLISHED' WHERE id = ${assessment.id}
      `;
    });

    return NextResponse.json({
      success: true,
      message: "Đã công bố kết quả cho học viên và phụ huynh.",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("PUBLISH ASSESSMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể công bố kết quả." },
      { status: 500 },
    );
  }
}