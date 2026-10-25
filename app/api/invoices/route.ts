import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

type InvoiceRow = {
  id: bigint;
  invoice_no: string;
  status: string;
  amount: string;
  due_date: string | null;
  issued_at: string;
  student_code: string;
  student_name: string;
  course_name: string;
  offering_code: string;
  branch_name: string;
  paid_amount: string | null;
  remaining_amount: string | null;
};

export async function GET() {
  const auth = await requireApiPermission("INVOICE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);
    // Phụ huynh chỉ thấy hóa đơn của con mình (qua bảng guardians).
    const parentOnly = auth.session.role === "PARENT" ? 1 : 0;

    const invoices = await prisma.$queryRaw<InvoiceRow[]>`
      SELECT
        i.id,
        i.invoice_no,
        i.status,
        CAST(i.amount AS CHAR) AS amount,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS due_date,
        DATE_FORMAT(i.issued_at, '%Y-%m-%d %H:%i') AS issued_at,
        s.student_code,
        s.full_name AS student_name,
        c.name AS course_name,
        o.code AS offering_code,
        b.name AS branch_name,
        CAST(r.paid_amount AS CHAR) AS paid_amount,
        CAST(r.remaining_amount AS CHAR) AS remaining_amount
      FROM invoices i
      INNER JOIN enrollments e ON e.id = i.enrollment_id
      INNER JOIN students s ON s.id = e.student_id
      INNER JOIN course_offerings o ON o.id = e.course_offering_id
      INNER JOIN course_versions cv ON cv.id = e.course_version_id
      INNER JOIN courses c ON c.id = cv.course_id
      INNER JOIN branches b ON b.id = i.branch_id
      LEFT JOIN receivables r ON r.invoice_id = i.id
      WHERE (
        (
          ${parentOnly} = 0
          AND EXISTS (
            SELECT 1 FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId} AND scope.branch_id = i.branch_id
          )
        )
        OR (
          ${parentOnly} = 1
          AND EXISTS (
            SELECT 1
            FROM student_guardians sg
            INNER JOIN guardians g ON g.id = sg.guardian_id
            WHERE sg.student_id = e.student_id AND g.user_id = ${userId}
          )
        )
      )
      ORDER BY i.id DESC
    `;

    return NextResponse.json({
      invoices: invoices.map((row) => ({
        id: row.id.toString(),
        invoiceNo: row.invoice_no,
        status: row.status,
        amount: row.amount,
        dueDate: row.due_date,
        issuedAt: row.issued_at,
        studentCode: row.student_code,
        studentName: row.student_name,
        courseName: row.course_name,
        offeringCode: row.offering_code,
        branchName: row.branch_name,
        paidAmount: row.paid_amount ?? "0",
        remainingAmount: row.remaining_amount ?? row.amount,
      })),
    });
  } catch (error) {
    console.error("GET INVOICES ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách hóa đơn." },
      { status: 500 },
    );
  }
}
