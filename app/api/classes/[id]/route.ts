import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { CLASS_STATUSES } from "@/lib/classes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission("CLASS_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID lớp không hợp lệ." },
        { status: 400 },
      );
    }

    const classId = BigInt(id);
    const found = await findAccessibleClass(auth.session, classId);

    if (!found) {
      return NextResponse.json(
        { error: "Không tìm thấy lớp hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const students = await prisma.$queryRaw<
      Array<{
        enrollment_id: bigint;
        student_code: string;
        full_name: string;
        phone: string | null;
      }>
    >`
      SELECT e.id AS enrollment_id, s.student_code, s.full_name, s.phone
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      WHERE e.class_id = ${classId} AND e.status = 'ACTIVE'
      ORDER BY s.full_name
    `;

    let candidates: Array<{
      enrollment_id: bigint;
      student_code: string;
      full_name: string;
    }> = [];

    if (auth.session.permissions.includes("CLASS_UPDATE")) {
      candidates = await prisma.$queryRaw<
        Array<{
          enrollment_id: bigint;
          student_code: string;
          full_name: string;
        }>
      >`
        SELECT e.id AS enrollment_id, s.student_code, s.full_name
        FROM enrollments e
        INNER JOIN students s ON s.id = e.student_id
        WHERE e.course_offering_id = ${found.course_offering_id}
          AND e.status = 'ACTIVE'
          AND e.class_id IS NULL
        ORDER BY s.full_name
      `;
    }

    const schedules = await prisma.$queryRaw<
      Array<{ day_of_week: number; start_time: string; end_time: string }>
    >`
      SELECT
        day_of_week,
        TIME_FORMAT(start_time, '%H:%i') AS start_time,
        TIME_FORMAT(end_time, '%H:%i') AS end_time
      FROM class_schedules
      WHERE class_id = ${classId}
      ORDER BY day_of_week, start_time
    `;

    const sessions = await prisma.$queryRaw<
      Array<{
        id: bigint;
        session_date: string;
        start_time: string;
        end_time: string;
        status: string;
        room_code: string;
        teacher_name: string;
      }>
    >`
      SELECT
        cs.id,
        DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS session_date,
        DATE_FORMAT(cs.start_at, '%H:%i') AS start_time,
        DATE_FORMAT(cs.end_at, '%H:%i') AS end_time,
        cs.status,
        r.code AS room_code,
        t.full_name AS teacher_name
      FROM class_sessions cs
      INNER JOIN rooms r ON r.id = cs.room_id
      INNER JOIN teachers t ON t.id = cs.teacher_id
      WHERE cs.class_id = ${classId}
      ORDER BY cs.start_at
    `;

    return NextResponse.json({
      students: students.map((row) => ({
        enrollmentId: row.enrollment_id.toString(),
        studentCode: row.student_code,
        fullName: row.full_name,
        phone: row.phone,
      })),
      candidates: candidates.map((row) => ({
        enrollmentId: row.enrollment_id.toString(),
        label: `${row.student_code} - ${row.full_name}`,
      })),
      schedules: schedules.map((row) => ({
        dayOfWeek: Number(row.day_of_week),
        startTime: row.start_time,
        endTime: row.end_time,
      })),
      sessions: sessions.map((row) => ({
        id: row.id.toString(),
        date: row.session_date,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        roomCode: row.room_code,
        teacherName: row.teacher_name,
      })),
    });
  } catch (error) {
    console.error("GET CLASS DETAIL ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải chi tiết lớp." },
      { status: 500 },
    );
  }
}

// Mở / đóng lớp.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission("CLASS_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID lớp không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const status = typeof body.status === "string" ? body.status : "";

    if (!(CLASS_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: "Trạng thái lớp không hợp lệ." },
        { status: 400 },
      );
    }

    const classId = BigInt(id);
    const found = await findAccessibleClass(auth.session, classId);

    if (!found) {
      return NextResponse.json(
        { error: "Không tìm thấy lớp hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    await prisma.$executeRaw`
      UPDATE classes SET status = ${status} WHERE id = ${classId}
    `;

    return NextResponse.json({
      success: true,
      message: status === "CLOSED" ? "Đã đóng lớp." : "Đã mở lại lớp.",
    });
  } catch (error) {
    console.error("UPDATE CLASS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật lớp." },
      { status: 500 },
    );
  }
}
