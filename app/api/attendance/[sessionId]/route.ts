import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";
import { parseAttendanceRecords } from "@/lib/attendance";
import { todayVN } from "@/lib/dates";

type Params = { params: Promise<{ sessionId: string }> };

type SessionInfo = {
  id: bigint;
  class_id: bigint;
  status: string;
  session_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  class_code: string;
};

async function loadSession(sessionId: bigint): Promise<SessionInfo | null> {
  const rows = await prisma.$queryRaw<SessionInfo[]>`
    SELECT
      cs.id,
      cs.class_id,
      cs.status,
      DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS session_date,
      DATE_FORMAT(cs.start_at, '%H:%i') AS start_time,
      DATE_FORMAT(cs.end_at, '%H:%i') AS end_time,
      c.name AS class_name,
      c.code AS class_code
    FROM class_sessions cs
    INNER JOIN classes c ON c.id = cs.class_id
    WHERE cs.id = ${sessionId}
    LIMIT 1
  `;

  return rows.length > 0 ? rows[0] : null;
}

// Bảng điểm danh của 1 buổi: học viên đang học trong lớp + trạng thái đã lưu.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission("ATTENDANCE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { sessionId } = await params;

    if (!/^\d+$/.test(sessionId)) {
      return NextResponse.json(
        { error: "Buổi học không hợp lệ." },
        { status: 400 },
      );
    }

    const session = await loadSession(BigInt(sessionId));

    if (
      !session ||
      !(await findAccessibleClass(auth.session, session.class_id))
    ) {
      return NextResponse.json(
        { error: "Không tìm thấy buổi học hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const students = await prisma.$queryRaw<
      Array<{
        student_id: bigint;
        student_code: string;
        full_name: string;
        status: string | null;
        note: string | null;
      }>
    >`
      SELECT
        s.id AS student_id,
        s.student_code,
        s.full_name,
        ar.status,
        ar.note
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      LEFT JOIN attendance_records ar
        ON ar.session_id = ${session.id} AND ar.student_id = s.id
      WHERE e.class_id = ${session.class_id} AND e.status = 'ACTIVE'
      ORDER BY s.full_name
    `;

    return NextResponse.json({
      session: {
        id: session.id.toString(),
        classCode: session.class_code,
        className: session.class_name,
        date: session.session_date,
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status,
        isFuture: session.session_date > todayVN(),
      },
      students: students.map((row) => ({
        studentId: row.student_id.toString(),
        studentCode: row.student_code,
        fullName: row.full_name,
        status: row.status,
        note: row.note,
      })),
    });
  } catch (error) {
    console.error("GET ATTENDANCE SHEET ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải bảng điểm danh." },
      { status: 500 },
    );
  }
}

// Lưu điểm danh (ghi mới hoặc cập nhật).
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireApiPermission("ATTENDANCE_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { sessionId } = await params;

    if (!/^\d+$/.test(sessionId)) {
      return NextResponse.json(
        { error: "Buổi học không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseAttendanceRecords(body.records);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const session = await loadSession(BigInt(sessionId));

    if (
      !session ||
      !(await findAccessibleClass(auth.session, session.class_id))
    ) {
      return NextResponse.json(
        { error: "Không tìm thấy buổi học hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    if (session.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Buổi học đã hủy, không thể điểm danh." },
        { status: 400 },
      );
    }

    if (session.session_date > todayVN()) {
      return NextResponse.json(
        { error: "Chưa đến ngày học, không thể điểm danh trước." },
        { status: 400 },
      );
    }

    const userId = BigInt(auth.session.userId);
    const records = parsed.data;

    await prisma.$transaction(
      async (tx) => {
        // Khóa buổi học để 2 lần lưu cùng lúc không tạo bản ghi trùng.
        await tx.$queryRaw`
          SELECT id FROM class_sessions WHERE id = ${session.id} FOR UPDATE
        `;

        const roster = await tx.$queryRaw<Array<{ student_id: bigint }>>`
          SELECT student_id
          FROM enrollments
          WHERE class_id = ${session.class_id} AND status = 'ACTIVE'
        `;

        const allowed = new Set(roster.map((r) => r.student_id.toString()));

        for (const record of records) {
          if (!allowed.has(record.studentId.toString())) {
            throw new ApiError(
              "Có học viên không thuộc lớp này hoặc đã nghỉ học.",
            );
          }
        }

        for (const record of records) {
          const existing = await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id FROM attendance_records
            WHERE session_id = ${session.id} AND student_id = ${record.studentId}
            LIMIT 1
          `;

          if (existing.length > 0) {
            await tx.$executeRaw`
              UPDATE attendance_records
              SET status = ${record.status}, note = ${record.note}, recorded_by = ${userId}
              WHERE id = ${existing[0].id}
            `;
          } else {
            await tx.$executeRaw`
              INSERT INTO attendance_records (session_id, student_id, status, note, recorded_by, created_at)
              VALUES (${session.id}, ${record.studentId}, ${record.status}, ${record.note}, ${userId}, NOW())
            `;
          }
        }

        await tx.$executeRaw`
          UPDATE class_sessions SET status = 'DONE' WHERE id = ${session.id}
        `;
      },
      { timeout: 30000, maxWait: 10000 },
    );

    return NextResponse.json({
      success: true,
      message: `Đã lưu điểm danh cho ${records.length} học viên.`,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("SAVE ATTENDANCE ERROR:", error);

    return NextResponse.json(
      { error: "Không thể lưu điểm danh." },
      { status: 500 },
    );
  }
}
