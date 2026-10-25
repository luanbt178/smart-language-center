import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import {
  makeInvoiceNo,
  parseEnrollmentInput,
} from "@/lib/enrollments";

type EnrollmentRow = {
  id: bigint;
  status: string;
  price: string;
  created_at: string;
  student_id: bigint;
  student_code: string;
  student_name: string;
  offering_id: bigint;
  offering_code: string;
  course_name: string;
  branch_name: string;
  invoice_no: string | null;
  invoice_status: string | null;
  due_date: string | null;
  paid_amount: string | null;
  remaining_amount: string | null;
};

type StudentOptionRow = {
  id: bigint;
  student_code: string;
  full_name: string;
  branch_id: bigint;
  branch_name: string;
};

type OfferingOptionRow = {
  id: bigint;
  code: string;
  branch_id: bigint;
  branch_name: string;
  course_name: string;
  tuition_fee: string | null;
  max_students: number | null;
  enrolled: bigint | number;
};

// Lỗi nghiệp vụ: trả về cho người dùng với mã HTTP tương ứng.
class EnrollmentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function GET() {
  const auth = await requireApiPermission("ENROLLMENT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const enrollments = await prisma.$queryRaw<EnrollmentRow[]>`
      SELECT
        e.id,
        e.status,
        CAST(e.price_snapshot AS CHAR) AS price,
        DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i') AS created_at,
        s.id AS student_id,
        s.student_code,
        s.full_name AS student_name,
        o.id AS offering_id,
        o.code AS offering_code,
        c.name AS course_name,
        b.name AS branch_name,
        i.invoice_no,
        i.status AS invoice_status,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS due_date,
        CAST(r.paid_amount AS CHAR) AS paid_amount,
        CAST(r.remaining_amount AS CHAR) AS remaining_amount
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id
      INNER JOIN course_offerings o ON o.id = e.course_offering_id
      INNER JOIN course_versions cv ON cv.id = e.course_version_id
      INNER JOIN courses c ON c.id = cv.course_id
      INNER JOIN branches b ON b.id = o.branch_id
      LEFT JOIN invoices i ON i.enrollment_id = e.id
      LEFT JOIN receivables r ON r.invoice_id = i.id
      WHERE EXISTS (
        SELECT 1
        FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId}
          AND scope.branch_id = o.branch_id
      )
      ORDER BY e.id DESC
    `;

    let students: StudentOptionRow[] = [];
    let offerings: OfferingOptionRow[] = [];

    if (auth.session.permissions.includes("ENROLLMENT_CREATE")) {
      students = await prisma.$queryRaw<StudentOptionRow[]>`
        SELECT s.id, s.student_code, s.full_name, s.branch_id, b.name AS branch_name
        FROM students s
        INNER JOIN branches b ON b.id = s.branch_id
        WHERE s.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId}
              AND scope.branch_id = s.branch_id
          )
        ORDER BY s.full_name
      `;

      offerings = await prisma.$queryRaw<OfferingOptionRow[]>`
        SELECT
          o.id,
          o.code,
          o.branch_id,
          b.name AS branch_name,
          c.name AS course_name,
          CAST(cv.tuition_fee AS CHAR) AS tuition_fee,
          o.max_students,
          (
            SELECT COUNT(*)
            FROM enrollments e
            WHERE e.course_offering_id = o.id
              AND e.status = 'ACTIVE'
          ) AS enrolled
        FROM course_offerings o
        INNER JOIN branches b ON b.id = o.branch_id
        INNER JOIN course_versions cv ON cv.id = o.course_version_id
        INNER JOIN courses c ON c.id = cv.course_id
        WHERE o.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId}
              AND scope.branch_id = o.branch_id
          )
        ORDER BY o.start_date DESC, o.id DESC
      `;
    }

    return NextResponse.json({
      enrollments: enrollments.map((row) => ({
        id: row.id.toString(),
        status: row.status,
        price: row.price,
        createdAt: row.created_at,
        studentId: row.student_id.toString(),
        studentCode: row.student_code,
        studentName: row.student_name,
        offeringId: row.offering_id.toString(),
        offeringCode: row.offering_code,
        courseName: row.course_name,
        branchName: row.branch_name,
        invoiceNo: row.invoice_no,
        invoiceStatus: row.invoice_status,
        dueDate: row.due_date,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
      })),

      students: students.map((row) => ({
        id: row.id.toString(),
        studentCode: row.student_code,
        fullName: row.full_name,
        branchId: row.branch_id.toString(),
        branchName: row.branch_name,
      })),

      offerings: offerings.map((row) => ({
        id: row.id.toString(),
        code: row.code,
        branchId: row.branch_id.toString(),
        branchName: row.branch_name,
        courseName: row.course_name,
        tuitionFee: row.tuition_fee,
        maxStudents: row.max_students,
        enrolled: Number(row.enrolled),
      })),
    });
  } catch (error) {
    console.error("GET ENROLLMENTS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách ghi danh." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/enrollments
 * Ghi danh học viên vào khóa học và tạo luôn 1 hóa đơn (học phí thu 1 lần)
 * cùng 1 dòng công nợ. Tất cả nằm trong 1 transaction: lỗi thì không lưu gì.
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission("ENROLLMENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseEnrollmentInput(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { studentId, offeringId, dueDate } = parsed.data;
    const userId = BigInt(auth.session.userId);

    const result = await prisma.$transaction(async (tx) => {
      // Khóa dòng khóa học để 2 người ghi danh cùng lúc không vượt sĩ số.
      const offerings = await tx.$queryRaw<
        Array<{
          id: bigint;
          branch_id: bigint;
          status: string;
          max_students: number | null;
          course_version_id: bigint;
          tuition_fee: string | null;
        }>
      >`
        SELECT
          o.id,
          o.branch_id,
          o.status,
          o.max_students,
          o.course_version_id,
          CAST(cv.tuition_fee AS CHAR) AS tuition_fee
        FROM course_offerings o
        INNER JOIN course_versions cv ON cv.id = o.course_version_id
        WHERE o.id = ${offeringId}
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId}
              AND scope.branch_id = o.branch_id
          )
        LIMIT 1
        FOR UPDATE
      `;

      if (offerings.length === 0) {
        throw new EnrollmentError(
          "Không tìm thấy khóa học hoặc bạn không có quyền ở chi nhánh này.",
          404,
        );
      }

      const offering = offerings[0];

      if (offering.status !== "ACTIVE") {
        throw new EnrollmentError("Khóa học này chưa mở hoặc đã đóng.");
      }

      const students = await tx.$queryRaw<
        Array<{ id: bigint; branch_id: bigint; status: string }>
      >`
        SELECT s.id, s.branch_id, s.status
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
        throw new EnrollmentError(
          "Không tìm thấy học viên hoặc bạn không có quyền.",
          404,
        );
      }

      const student = students[0];

      if (student.status !== "ACTIVE") {
        throw new EnrollmentError(
          "Học viên đang ngừng học, không thể ghi danh.",
        );
      }

      if (student.branch_id !== offering.branch_id) {
        throw new EnrollmentError(
          "Học viên và khóa học phải cùng chi nhánh.",
        );
      }

      const duplicates = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM enrollments
        WHERE student_id = ${studentId}
          AND course_offering_id = ${offeringId}
          AND status = 'ACTIVE'
        LIMIT 1
      `;

      if (duplicates.length > 0) {
        throw new EnrollmentError(
          "Học viên đã được ghi danh vào khóa học này.",
          409,
        );
      }

      if (offering.max_students !== null) {
        const counts = await tx.$queryRaw<Array<{ total: bigint | number }>>`
          SELECT COUNT(*) AS total
          FROM enrollments
          WHERE course_offering_id = ${offeringId}
            AND status = 'ACTIVE'
        `;

        if (Number(counts[0].total) >= offering.max_students) {
          throw new EnrollmentError(
            `Khóa học đã đủ sĩ số (${offering.max_students} học viên).`,
            409,
          );
        }
      }

      const fee = Number(offering.tuition_fee);

      if (
        offering.tuition_fee === null ||
        !Number.isFinite(fee) ||
        fee <= 0
      ) {
        throw new EnrollmentError(
          "Khóa học chưa có học phí. Vui lòng cập nhật học phí ở mục Khóa học.",
        );
      }

      const price = offering.tuition_fee;

      await tx.$executeRaw`
        INSERT INTO enrollments (
          student_id,
          course_offering_id,
          class_id,
          course_version_id,
          price_snapshot,
          created_at,
          updated_at,
          status
        )
        VALUES (
          ${studentId},
          ${offeringId},
          NULL,
          ${offering.course_version_id},
          ${price},
          NOW(),
          NULL,
          ${"ACTIVE"}
        )
      `;

      const enrollmentIds = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      const enrollmentId = enrollmentIds[0].id;

      await tx.$executeRaw`
        INSERT INTO enrollment_status_history (
          enrollment_id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          reason
        )
        VALUES (
          ${enrollmentId},
          NULL,
          ${"ACTIVE"},
          ${userId},
          NOW(),
          ${"Ghi danh mới"}
        )
      `;

      // Mã hóa đơn tạm (duy nhất), ngay sau đó đổi thành mã thật từ id.
      const tempNo = `TMP-${randomUUID()}`;

      await tx.$executeRaw`
        INSERT INTO invoices (
          branch_id,
          enrollment_id,
          invoice_no,
          amount,
          due_date,
          status,
          issued_at
        )
        VALUES (
          ${offering.branch_id},
          ${enrollmentId},
          ${tempNo},
          ${price},
          ${dueDate},
          ${"ISSUED"},
          NOW()
        )
      `;

      const invoiceIds = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      const invoiceId = invoiceIds[0].id;
      const invoiceNo = makeInvoiceNo(invoiceId);

      await tx.$executeRaw`
        UPDATE invoices
        SET invoice_no = ${invoiceNo}
        WHERE id = ${invoiceId}
      `;

      await tx.$executeRaw`
        INSERT INTO receivables (
          invoice_id,
          total_amount,
          paid_amount,
          remaining_amount,
          status,
          updated_at
        )
        VALUES (
          ${invoiceId},
          ${price},
          0,
          ${price},
          ${"OPEN"},
          NOW()
        )
      `;

      return { enrollmentId, invoiceNo };
    });

    return NextResponse.json(
      {
        success: true,
        message: `Đã ghi danh và tạo hóa đơn ${result.invoiceNo}.`,
        id: result.enrollmentId.toString(),
        invoiceNo: result.invoiceNo,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof EnrollmentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CREATE ENROLLMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể ghi danh." },
      { status: 500 },
    );
  }
}
