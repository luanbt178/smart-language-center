import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { isTeacherOnly } from "@/lib/class-access";
import { addDaysVN, todayVN } from "@/lib/dates";
import { validDateOnly } from "@/lib/students";

type SessionRow = {
  id: bigint;
  class_id: bigint;
  class_code: string;
  class_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  room_code: string;
  student_count: bigint | number;
  recorded_count: bigint | number;
};

/**
 * GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&classId=
 * Danh sách buổi học (mặc định 30 ngày gần nhất đến hết hôm nay).
 */
export async function GET(request: Request) {
  const auth = await requireApiPermission("ATTENDANCE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || addDaysVN(-30);
    const to = url.searchParams.get("to") || todayVN();
    const classText = url.searchParams.get("classId") || "";

    if (!validDateOnly(from) || !validDateOnly(to) || from > to) {
      return NextResponse.json(
        { error: "Khoảng ngày không hợp lệ." },
        { status: 400 },
      );
    }

    if (classText !== "" && !/^\d+$/.test(classText)) {
      return NextResponse.json(
        { error: "Lớp không hợp lệ." },
        { status: 400 },
      );
    }

    const classId = classText === "" ? BigInt(0) : BigInt(classText);
    const userId = BigInt(auth.session.userId);
    const teacherOnly = isTeacherOnly(auth.session) ? 1 : 0;

    const sessions = await prisma.$queryRaw<SessionRow[]>`
      SELECT
        cs.id,
        c.id AS class_id,
        c.code AS class_code,
        c.name AS class_name,
        DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS session_date,
        DATE_FORMAT(cs.start_at, '%H:%i') AS start_time,
        DATE_FORMAT(cs.end_at, '%H:%i') AS end_time,
        cs.status,
        r.code AS room_code,
        (
          SELECT COUNT(*) FROM enrollments e
          WHERE e.class_id = c.id AND e.status = 'ACTIVE'
        ) AS student_count,
        (
          SELECT COUNT(*) FROM attendance_records ar
          WHERE ar.session_id = cs.id
        ) AS recorded_count
      FROM class_sessions cs
      INNER JOIN classes c ON c.id = cs.class_id
      INNER JOIN rooms r ON r.id = cs.room_id
      WHERE cs.status <> 'CANCELLED'
        AND cs.session_date >= ${from}
        AND cs.session_date <= ${to}
        AND (${classId} = 0 OR c.id = ${classId})
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
      ORDER BY cs.start_at DESC
      LIMIT 300
    `;

    return NextResponse.json({
      from,
      to,
      sessions: sessions.map((row) => ({
        id: row.id.toString(),
        classId: row.class_id.toString(),
        classCode: row.class_code,
        className: row.class_name,
        date: row.session_date,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        roomCode: row.room_code,
        studentCount: Number(row.student_count),
        recordedCount: Number(row.recorded_count),
      })),
    });
  } catch (error) {
    console.error("GET ATTENDANCE SESSIONS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách buổi học." },
      { status: 500 },
    );
  }
}
