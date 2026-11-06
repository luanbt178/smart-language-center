import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { isTeacherOnly } from "@/lib/class-access";

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * GET /api/schedule?from=YYYY-MM-DD
 * Các buổi học trong 7 ngày [from, from + 7).
 */
export async function GET(request: Request) {
  const auth = await requireApiPermission("SCHEDULE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const from = new URL(request.url).searchParams.get("from") ?? "";

    if (!isDate(from)) {
      return NextResponse.json(
        { error: "Ngày bắt đầu tuần không hợp lệ (YYYY-MM-DD)." },
        { status: 400 },
      );
    }

    const to = addDays(from, 7);
    const userId = BigInt(auth.session.userId);
    const teacherOnly = isTeacherOnly(auth.session) ? 1 : 0;

    const rows = await prisma.$queryRaw<
      Array<{
        id: bigint;
        class_id: bigint;
        class_code: string;
        class_name: string;
        session_date: string;
        start_time: string;
        end_time: string;
        status: string;
        room_code: string;
        room_name: string | null;
        teacher_name: string;
        branch_name: string;
      }>
    >`
      SELECT
        cs.id,
        cs.class_id,
        cl.code AS class_code,
        cl.name AS class_name,
        DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS session_date,
        DATE_FORMAT(cs.start_at, '%H:%i') AS start_time,
        DATE_FORMAT(cs.end_at, '%H:%i') AS end_time,
        cs.status,
        r.code AS room_code,
        r.name AS room_name,
        t.full_name AS teacher_name,
        b.name AS branch_name
      FROM class_sessions cs
      INNER JOIN classes cl ON cl.id = cs.class_id
      INNER JOIN rooms r ON r.id = cs.room_id
      INNER JOIN teachers t ON t.id = cs.teacher_id
      INNER JOIN branches b ON b.id = cl.branch_id
      WHERE cs.session_date >= ${from}
        AND cs.session_date < ${to}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = cl.branch_id
        )
        AND (${teacherOnly} = 0 OR t.user_id = ${userId})
      ORDER BY cs.session_date, cs.start_at, cl.code
      LIMIT 1000
    `;

    return NextResponse.json({
      from,
      to,
      sessions: rows.map((row) => ({
        id: row.id.toString(),
        classId: row.class_id.toString(),
        classCode: row.class_code,
        className: row.class_name,
        date: row.session_date,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        roomCode: row.room_code,
        roomName: row.room_name,
        teacherName: row.teacher_name,
        branchName: row.branch_name,
      })),
    });
  } catch (error) {
    console.error("GET SCHEDULE ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải lịch học." },
      { status: 500 },
    );
  }
}