import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// Lịch sử giao dịch của 1 hóa đơn.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission("INVOICE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Hóa đơn không hợp lệ." },
        { status: 400 },
      );
    }

    const invoiceId = BigInt(id);
    const userId = BigInt(auth.session.userId);
    const parentOnly = auth.session.role === "PARENT" ? 1 : 0;

    const allowed = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT i.id
      FROM invoices i
      INNER JOIN enrollments e ON e.id = i.enrollment_id
      WHERE i.id = ${invoiceId}
        AND (
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
      LIMIT 1
    `;

    if (allowed.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy hóa đơn hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const payments = await prisma.$queryRaw<
      Array<{
        id: bigint;
        amount: string;
        payment_method: string | null;
        transaction_code: string | null;
        paid_at: string;
        status: string;
        recorded_by_name: string;
      }>
    >`
      SELECT
        p.id,
        CAST(p.amount AS CHAR) AS amount,
        p.payment_method,
        p.transaction_code,
        DATE_FORMAT(p.paid_at, '%Y-%m-%d %H:%i') AS paid_at,
        p.status,
        u.full_name AS recorded_by_name
      FROM payments p
      INNER JOIN users u ON u.id = p.recorded_by
      WHERE p.invoice_id = ${invoiceId}
      ORDER BY p.id DESC
    `;

    return NextResponse.json({
      payments: payments.map((row) => ({
        id: row.id.toString(),
        amount: row.amount,
        method: row.payment_method,
        transactionCode: row.transaction_code,
        paidAt: row.paid_at,
        status: row.status,
        recordedBy: row.recorded_by_name,
      })),
    });
  } catch (error) {
    console.error("GET INVOICE PAYMENTS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải lịch sử thanh toán." },
      { status: 500 },
    );
  }
}
