import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { ApiError } from "@/lib/api-error";
import { recomputeInvoice } from "@/lib/receivables";

type Params = { params: Promise<{ id: string }> };

// Hủy (void) một giao dịch nhập nhầm; hóa đơn và công nợ được tính lại.
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiPermission("PAYMENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Giao dịch không hợp lệ." },
        { status: 400 },
      );
    }

    const paymentId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: bigint; invoice_id: bigint; status: string }>
        >`
          SELECT p.id, p.invoice_id, p.status
          FROM payments p
          INNER JOIN invoices i ON i.id = p.invoice_id
          WHERE p.id = ${paymentId}
            AND EXISTS (
              SELECT 1 FROM user_branch_scopes scope
              WHERE scope.user_id = ${userId} AND scope.branch_id = i.branch_id
            )
          LIMIT 1
        `;

        if (rows.length === 0) {
          throw new ApiError(
            "Không tìm thấy giao dịch hoặc bạn không có quyền.",
            404,
          );
        }

        const payment = rows[0];

        // Khóa hóa đơn trước khi sửa để tránh thu/hủy đồng thời.
        const invoices = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM invoices WHERE id = ${payment.invoice_id} FOR UPDATE
        `;

        if (invoices[0].status === "CANCELLED") {
          throw new ApiError("Hóa đơn đã hủy.");
        }

        const current = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM payments WHERE id = ${paymentId}
        `;

        if (current[0].status !== "COMPLETED") {
          throw new ApiError("Giao dịch này đã được hủy trước đó.", 409);
        }

        await tx.$executeRaw`
          UPDATE payments SET status = 'VOID' WHERE id = ${paymentId}
        `;

        await recomputeInvoice(tx, payment.invoice_id);
      },
      { timeout: 20000, maxWait: 10000 },
    );

    return NextResponse.json({
      success: true,
      message: "Đã hủy giao dịch, công nợ đã được tính lại.",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("VOID PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể hủy giao dịch." },
      { status: 500 },
    );
  }
}
