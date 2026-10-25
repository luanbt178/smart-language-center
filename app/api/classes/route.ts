import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { isTeacherOnly } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";
import { makeClassCode } from "@/lib/classes";
import { readText } from "@/lib/students";

type ClassRow = {
  id: bigint;
  code: string;
  name: string;
  status: string;
  offering_code: string;
  course_name: string;
  branch_name: string;
  start_date: string;
  end_date: string;
  room_code: string | null;
  room_capacity: number | null;
  teacher_name: string | null;
  student_count: bigint | number;
  session_count: bigint | number;
};

export async function GET() {
  const auth = await requireApiPermission("CLASS_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);
    const teacherOnly = isTeacherOnly(auth.session) ? 1 : 0;

    const classes = await prisma.$queryRaw<ClassRow[]>`
      SELECT
        c.id,
        c.code,
        c.name,
        c.status,
        o.code AS offering_code,
        co.name AS course_name,
        b.name AS branch_name,
        DATE_FORMAT(o.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(o.end_date, '%Y-%m-%d') AS end_date,
        r.code AS room_code,
        r.capacity AS room_capacity,
        (
          SELECT t.full_name
          FROM teacher_assignments ta
          INNER JOIN teachers t ON t.id = ta.teacher_id
          WHERE ta.class_id = c.id AND ta.role = 'MAIN'
          ORDER BY ta.id DESC
          LIMIT 1
        ) AS teacher_name,
        (
          SELECT COUNT(*) FROM enrollments e
          WHERE e.class_id = c.id AND e.status = 'ACTIVE'
        ) AS student_count,
        (
          SELECT COUNT(*) FROM class_sessions cs
          WHERE cs.class_id = c.id AND cs.status <> 'CANCELLED'
        ) AS session_count
      FROM classes c
      INNER JOIN course_offerings o ON o.id = c.course_offering_id
      INNER JOIN course_versions cv ON cv.id = o.course_version_id
      INNER JOIN courses co ON co.id = cv.course_id
      INNER JOIN branches b ON b.id = c.branch_id
      LEFT JOIN rooms r ON r.id = c.room_id
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
      ORDER BY c.id DESC
    `;

    type OfferingOption = {
      id: bigint;
      code: string;
      course_name: string;
      branch_name: string;
    };
    type RoomOption = {
      id: bigint;
      code: string;
      capacity: number;
      branch_id: bigint;
      branch_name: string;
    };
    type TeacherOption = {
      id: bigint;
      teacher_code: string;
      full_name: string;
    };

    let offerings: OfferingOption[] = [];
    let rooms: RoomOption[] = [];
    let teachers: TeacherOption[] = [];

    if (auth.session.permissions.includes("CLASS_CREATE")) {
      offerings = await prisma.$queryRaw<OfferingOption[]>`
        SELECT o.id, o.code, co.name AS course_name, b.name AS branch_name
        FROM course_offerings o
        INNER JOIN course_versions cv ON cv.id = o.course_version_id
        INNER JOIN courses co ON co.id = cv.course_id
        INNER JOIN branches b ON b.id = o.branch_id
        WHERE o.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId} AND scope.branch_id = o.branch_id
          )
        ORDER BY o.start_date DESC, o.id DESC
      `;

      rooms = await prisma.$queryRaw<RoomOption[]>`
        SELECT r.id, r.code, r.capacity, r.branch_id, b.name AS branch_name
        FROM rooms r
        INNER JOIN branches b ON b.id = r.branch_id
        WHERE r.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId} AND scope.branch_id = r.branch_id
          )
        ORDER BY b.name, r.code
      `;

      teachers = await prisma.$queryRaw<TeacherOption[]>`
        SELECT t.id, t.teacher_code, t.full_name
        FROM teachers t
        WHERE t.employment_status = 'ACTIVE'
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes mine
            INNER JOIN user_branch_scopes theirs ON theirs.branch_id = mine.branch_id
            WHERE mine.user_id = ${userId} AND theirs.user_id = t.user_id
          )
        ORDER BY t.full_name
      `;
    }

    return NextResponse.json({
      classes: classes.map((row) => ({
        id: row.id.toString(),
        code: row.code,
        name: row.name,
        status: row.status,
        offeringCode: row.offering_code,
        courseName: row.course_name,
        branchName: row.branch_name,
        startDate: row.start_date,
        endDate: row.end_date,
        roomCode: row.room_code,
        roomCapacity: row.room_capacity,
        teacherName: row.teacher_name,
        studentCount: Number(row.student_count),
        sessionCount: Number(row.session_count),
      })),
      offerings: offerings.map((row) => ({
        id: row.id.toString(),
        label: `${row.code} - ${row.course_name} (${row.branch_name})`,
      })),
      rooms: rooms.map((row) => ({
        id: row.id.toString(),
        branchId: row.branch_id.toString(),
        label: `${row.code} - ${row.branch_name} (${row.capacity} chỗ)`,
      })),
      teachers: teachers.map((row) => ({
        id: row.id.toString(),
        label: `${row.teacher_code} - ${row.full_name}`,
      })),
    });
  } catch (error) {
    console.error("GET CLASSES ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách lớp học." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/classes
 * Tạo lớp từ 1 khóa học đang mở, chọn phòng và giáo viên chính.
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission("CLASS_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = BigInt(auth.session.userId);

    const offeringText = String(body.offeringId ?? "");
    const roomText = String(body.roomId ?? "");
    const teacherText = String(body.teacherId ?? "");
    const name = readText(body.name, 100);

    if (!/^\d+$/.test(offeringText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn khóa học đang mở." },
        { status: 400 },
      );
    }

    if (!/^\d+$/.test(roomText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn phòng học." },
        { status: 400 },
      );
    }

    if (!/^\d+$/.test(teacherText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn giáo viên chính." },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên lớp (tối đa 100 ký tự)." },
        { status: 400 },
      );
    }

    const offeringId = BigInt(offeringText);
    const roomId = BigInt(roomText);
    const teacherId = BigInt(teacherText);

    const result = await prisma.$transaction(async (tx) => {
      const offerings = await tx.$queryRaw<
        Array<{
          id: bigint;
          branch_id: bigint;
          start_date: string;
          end_date: string;
        }>
      >`
        SELECT
          o.id,
          o.branch_id,
          DATE_FORMAT(o.start_date, '%Y-%m-%d') AS start_date,
          DATE_FORMAT(o.end_date, '%Y-%m-%d') AS end_date
        FROM course_offerings o
        WHERE o.id = ${offeringId}
          AND o.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId} AND scope.branch_id = o.branch_id
          )
        LIMIT 1
      `;

      if (offerings.length === 0) {
        throw new ApiError(
          "Không tìm thấy khóa học đang mở hoặc bạn không có quyền.",
          404,
        );
      }

      const offering = offerings[0];

      const rooms = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM rooms
        WHERE id = ${roomId} AND branch_id = ${offering.branch_id} AND status = 'ACTIVE'
        LIMIT 1
      `;

      if (rooms.length === 0) {
        throw new ApiError("Phòng học phải đang hoạt động và cùng chi nhánh với khóa học.");
      }

      const teachers = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT t.id
        FROM teachers t
        WHERE t.id = ${teacherId}
          AND t.employment_status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM user_branch_scopes s
            WHERE s.user_id = t.user_id AND s.branch_id = ${offering.branch_id}
          )
        LIMIT 1
      `;

      if (teachers.length === 0) {
        throw new ApiError("Giáo viên phải đang làm việc và thuộc chi nhánh của khóa học.");
      }

      const tempCode = `TMP-${randomUUID()}`;

      await tx.$executeRaw`
        INSERT INTO classes (branch_id, code, name, status, course_offering_id, created_at, room_id)
        VALUES (${offering.branch_id}, ${tempCode}, ${name}, ${"ACTIVE"}, ${offeringId}, NOW(), ${roomId})
      `;

      const ids = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      const classId = ids[0].id;
      const classCode = makeClassCode(classId);

      await tx.$executeRaw`
        UPDATE classes SET code = ${classCode} WHERE id = ${classId}
      `;

      await tx.$executeRaw`
        INSERT INTO teacher_assignments (class_id, teacher_id, role, start_date, end_date)
        VALUES (${classId}, ${teacherId}, ${"MAIN"}, ${offering.start_date}, ${offering.end_date})
      `;

      return classCode;
    });

    return NextResponse.json(
      { success: true, message: `Đã tạo lớp ${result}.` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CREATE CLASS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tạo lớp học." },
      { status: 500 },
    );
  }
}
