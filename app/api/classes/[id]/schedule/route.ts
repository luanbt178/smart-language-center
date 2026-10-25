import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";
import { MAX_SESSIONS, buildSessions, parseSlots } from "@/lib/classes";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/classes/:id/schedule
 * Body: { slots: [{ dayOfWeek, startTime, endTime }] }
 * Tạo lịch tuần và sinh toàn bộ buổi học từ ngày bắt đầu đến ngày kết thúc của khóa.
 * Từ chối cả lô nếu trùng phòng hoặc trùng giáo viên.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission("SCHEDULE_CREATE");

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
    const parsed = parseSlots(body.slots);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const slots = parsed.data;
    const classId = BigInt(id);

    const found = await findAccessibleClass(auth.session, classId);

    if (!found) {
      return NextResponse.json(
        { error: "Không tìm thấy lớp hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const count = await prisma.$transaction(
      async (tx) => {
        const classes = await tx.$queryRaw<
          Array<{
            status: string;
            room_id: bigint | null;
            start_date: string;
            end_date: string;
          }>
        >`
          SELECT
            c.status,
            c.room_id,
            DATE_FORMAT(o.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(o.end_date, '%Y-%m-%d') AS end_date
          FROM classes c
          INNER JOIN course_offerings o ON o.id = c.course_offering_id
          WHERE c.id = ${classId}
          LIMIT 1
          FOR UPDATE
        `;

        const klass = classes[0];

        if (klass.status !== "ACTIVE") {
          throw new ApiError("Lớp đã đóng, không thể lập lịch.");
        }

        if (klass.room_id === null) {
          throw new ApiError("Lớp chưa có phòng học.");
        }

        const teachers = await tx.$queryRaw<Array<{ teacher_id: bigint }>>`
          SELECT teacher_id
          FROM teacher_assignments
          WHERE class_id = ${classId} AND role = 'MAIN'
          ORDER BY id DESC
          LIMIT 1
        `;

        if (teachers.length === 0) {
          throw new ApiError("Lớp chưa có giáo viên chính.");
        }

        const roomId = klass.room_id;
        const teacherId = teachers[0].teacher_id;

        const existing = await tx.$queryRaw<Array<{ total: bigint | number }>>`
          SELECT COUNT(*) AS total
          FROM class_sessions
          WHERE class_id = ${classId}
        `;

        if (Number(existing[0].total) > 0) {
          throw new ApiError(
            "Lớp đã có lịch. Hãy xóa lịch cũ trước khi lập lại.",
            409,
          );
        }

        const sessions = buildSessions(klass.start_date, klass.end_date, slots);

        if (sessions.length === 0) {
          throw new ApiError(
            "Không có buổi học nào nằm trong thời gian của khóa. Kiểm tra lại thứ trong tuần.",
          );
        }

        if (sessions.length > MAX_SESSIONS) {
          throw new ApiError(
            `Lịch tạo ra hơn ${MAX_SESSIONS} buổi, vui lòng giảm số buổi mỗi tuần.`,
          );
        }

        // Khóa phòng và giáo viên để 2 lớp lập lịch cùng lúc không trùng nhau.
        await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM teachers WHERE id = ${teacherId} FOR UPDATE`;

        const rangeStart = `${sessions[0].date} 00:00:00`;
        const rangeEnd = `${sessions[sessions.length - 1].date} 23:59:59`;

        const busy = await tx.$queryRaw<
          Array<{
            room_id: bigint;
            teacher_id: bigint;
            start_at: string;
            end_at: string;
            class_code: string;
          }>
        >`
          SELECT
            cs.room_id,
            cs.teacher_id,
            DATE_FORMAT(cs.start_at, '%Y-%m-%d %H:%i:%s') AS start_at,
            DATE_FORMAT(cs.end_at, '%Y-%m-%d %H:%i:%s') AS end_at,
            c.code AS class_code
          FROM class_sessions cs
          INNER JOIN classes c ON c.id = cs.class_id
          WHERE cs.status <> 'CANCELLED'
            AND (cs.room_id = ${roomId} OR cs.teacher_id = ${teacherId})
            AND cs.start_at <= ${rangeEnd}
            AND cs.end_at >= ${rangeStart}
        `;

        for (const session of sessions) {
          for (const other of busy) {
            const overlap =
              other.start_at < session.endAt && session.startAt < other.end_at;

            if (!overlap) continue;

            const what =
              other.room_id === roomId ? "phòng học" : "giáo viên";

            throw new ApiError(
              `Trùng ${what} vào ${session.startAt.slice(0, 16)} (đã có lịch của lớp ${other.class_code}). Không tạo lịch nào.`,
              409,
            );
          }
        }

        for (const slot of slots) {
          await tx.$executeRaw`
            INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time)
            VALUES (${classId}, ${slot.dayOfWeek}, ${`${slot.startTime}:00`}, ${`${slot.endTime}:00`})
          `;
        }

        for (const session of sessions) {
          await tx.$executeRaw`
            INSERT INTO class_sessions (class_id, teacher_id, room_id, session_date, start_at, end_at, status)
            VALUES (${classId}, ${teacherId}, ${roomId}, ${session.date}, ${session.startAt}, ${session.endAt}, ${"SCHEDULED"})
          `;
        }

        return sessions.length;
      },
      { timeout: 30000, maxWait: 10000 },
    );

    return NextResponse.json(
      { success: true, message: `Đã tạo lịch với ${count} buổi học.` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CREATE SCHEDULE ERROR:", error);

    return NextResponse.json(
      { error: "Không thể lập lịch." },
      { status: 500 },
    );
  }
}

// Xóa toàn bộ lịch của lớp (chỉ khi chưa có điểm danh).
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiPermission("SCHEDULE_CREATE");

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

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM classes WHERE id = ${classId} FOR UPDATE
      `;

      const records = await tx.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total
        FROM attendance_records ar
        INNER JOIN class_sessions cs ON cs.id = ar.session_id
        WHERE cs.class_id = ${classId}
      `;

      if (Number(records[0].total) > 0) {
        throw new ApiError(
          "Lớp đã có điểm danh, không thể xóa lịch.",
          409,
        );
      }

      await tx.$executeRaw`DELETE FROM class_sessions WHERE class_id = ${classId}`;
      await tx.$executeRaw`DELETE FROM class_schedules WHERE class_id = ${classId}`;
    });

    return NextResponse.json({ success: true, message: "Đã xóa lịch của lớp." });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("DELETE SCHEDULE ERROR:", error);

    return NextResponse.json(
      { error: "Không thể xóa lịch." },
      { status: 500 },
    );
  }
}
