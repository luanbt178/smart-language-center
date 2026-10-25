import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { todayVN } from "@/lib/dates";

/**
 * GET /api/portal
 * Cổng chỉ xem cho học viên và phụ huynh.
 *  - Học viên: hồ sơ học viên có email trùng email tài khoản.
 *  - Phụ huynh: các học viên liên kết qua bảng guardians.
 */
export async function GET() {
  const auth = await requireApiPermission("PORTAL_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);
    const isStudent = auth.session.role === "STUDENT" ? 1 : 0;
    const isParent = auth.session.role === "PARENT" ? 1 : 0;
    const today = todayVN();

    const students = await prisma.$queryRaw<
      Array<{
        id: bigint;
        student_code: string;
        full_name: string;
        status: string;
        branch_name: string;
      }>
    >`
      SELECT s.id, s.student_code, s.full_name, s.status, b.name AS branch_name
      FROM students s
      INNER JOIN branches b ON b.id = s.branch_id
      WHERE (
        ${isStudent} = 1
        AND LOWER(s.email) = LOWER((SELECT u.email FROM users u WHERE u.id = ${userId}))
      )
      OR (
        ${isParent} = 1
        AND EXISTS (
          SELECT 1
          FROM student_guardians sg
          INNER JOIN guardians g ON g.id = sg.guardian_id
          WHERE sg.student_id = s.id AND g.user_id = ${userId}
        )
      )
      ORDER BY s.full_name
      LIMIT 10
    `;

    const result = [];

    for (const student of students) {
      const classes = await prisma.$queryRaw<
        Array<{
          class_code: string;
          class_name: string;
          course_name: string;
          room_code: string | null;
          teacher_name: string | null;
        }>
      >`
        SELECT
          c.code AS class_code,
          c.name AS class_name,
          co.name AS course_name,
          r.code AS room_code,
          (
            SELECT t.full_name
            FROM teacher_assignments ta
            INNER JOIN teachers t ON t.id = ta.teacher_id
            WHERE ta.class_id = c.id AND ta.role = 'MAIN'
            ORDER BY ta.id DESC
            LIMIT 1
          ) AS teacher_name
        FROM enrollments e
        INNER JOIN classes c ON c.id = e.class_id
        INNER JOIN course_versions cv ON cv.id = e.course_version_id
        INNER JOIN courses co ON co.id = cv.course_id
        LEFT JOIN rooms r ON r.id = c.room_id
        WHERE e.student_id = ${student.id} AND e.status = 'ACTIVE'
        ORDER BY c.id DESC
      `;

      const upcoming = await prisma.$queryRaw<
        Array<{
          session_date: string;
          start_time: string;
          end_time: string;
          class_name: string;
          room_code: string;
        }>
      >`
        SELECT
          DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS session_date,
          DATE_FORMAT(cs.start_at, '%H:%i') AS start_time,
          DATE_FORMAT(cs.end_at, '%H:%i') AS end_time,
          c.name AS class_name,
          r.code AS room_code
        FROM enrollments e
        INNER JOIN class_sessions cs ON cs.class_id = e.class_id
        INNER JOIN classes c ON c.id = cs.class_id
        INNER JOIN rooms r ON r.id = cs.room_id
        WHERE e.student_id = ${student.id}
          AND e.status = 'ACTIVE'
          AND cs.status <> 'CANCELLED'
          AND cs.session_date >= ${today}
        ORDER BY cs.start_at
        LIMIT 15
      `;

      const summary = await prisma.$queryRaw<
        Array<{ status: string; total: bigint | number }>
      >`
        SELECT status, COUNT(*) AS total
        FROM attendance_records
        WHERE student_id = ${student.id}
        GROUP BY status
      `;

      const recent = await prisma.$queryRaw<
        Array<{
          session_date: string;
          class_name: string;
          status: string;
          note: string | null;
        }>
      >`
        SELECT
          DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS session_date,
          c.name AS class_name,
          ar.status,
          ar.note
        FROM attendance_records ar
        INNER JOIN class_sessions cs ON cs.id = ar.session_id
        INNER JOIN classes c ON c.id = cs.class_id
        WHERE ar.student_id = ${student.id}
        ORDER BY cs.start_at DESC
        LIMIT 10
      `;

      const invoices = await prisma.$queryRaw<
        Array<{
          invoice_no: string;
          status: string;
          amount: string;
          paid_amount: string | null;
          remaining_amount: string | null;
          due_date: string | null;
          course_name: string;
        }>
      >`
        SELECT
          i.invoice_no,
          i.status,
          CAST(i.amount AS CHAR) AS amount,
          CAST(r.paid_amount AS CHAR) AS paid_amount,
          CAST(r.remaining_amount AS CHAR) AS remaining_amount,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') AS due_date,
          co.name AS course_name
        FROM enrollments e
        INNER JOIN invoices i ON i.enrollment_id = e.id
        INNER JOIN course_versions cv ON cv.id = e.course_version_id
        INNER JOIN courses co ON co.id = cv.course_id
        LEFT JOIN receivables r ON r.invoice_id = i.id
        WHERE e.student_id = ${student.id} AND i.status <> 'CANCELLED'
        ORDER BY i.id DESC
      `;

      const counts: Record<string, number> = {};

      for (const row of summary) {
        counts[row.status] = Number(row.total);
      }

      result.push({
        id: student.id.toString(),
        studentCode: student.student_code,
        fullName: student.full_name,
        status: student.status,
        branchName: student.branch_name,
        classes: classes.map((row) => ({
          classCode: row.class_code,
          className: row.class_name,
          courseName: row.course_name,
          roomCode: row.room_code,
          teacherName: row.teacher_name,
        })),
        upcoming: upcoming.map((row) => ({
          date: row.session_date,
          startTime: row.start_time,
          endTime: row.end_time,
          className: row.class_name,
          roomCode: row.room_code,
        })),
        attendanceCounts: counts,
        recentAttendance: recent.map((row) => ({
          date: row.session_date,
          className: row.class_name,
          status: row.status,
          note: row.note,
        })),
        invoices: invoices.map((row) => ({
          invoiceNo: row.invoice_no,
          status: row.status,
          amount: row.amount,
          paidAmount: row.paid_amount ?? "0",
          remainingAmount: row.remaining_amount ?? row.amount,
          dueDate: row.due_date,
          courseName: row.course_name,
        })),
      });
    }

    return NextResponse.json({ students: result });
  } catch (error) {
    console.error("GET PORTAL ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải dữ liệu cổng thông tin." },
      { status: 500 },
    );
  }
}
