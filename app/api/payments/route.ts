import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { ApiError } from "@/lib/api-error";
import { fromCents, toCents } from "@/lib/money";
import { parsePaymentInput } from "@/lib/payments";
import { recomputeInvoice } from "@/lib/receivables";

/**
 * POST /api/payments
 * Ghi nhận một khoản thu cho hóa đơn (có thể thu một phần). Không cho thu vượt số còn nợ.
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission("PAYMENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parsePaymentInput(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { invoiceId, amountCents, method, transactionCode } = parsed.data;
    const userId = BigInt(auth.session.userId);

    const result = await prisma.$transaction(
      async (tx) => {
        const invoices = await tx.$queryRaw<
          Array<{ id: bigint; branch_id: bigint; status: string; amount: string }>
        >`
          SELECT i.id, i.branch_id, i.status, CAST(i.amount AS CHAR) AS amount
          FROM invoices i
          WHERE i.id = ${invoiceId}
            AND EXISTS (
              SELECT 1 FROM user_branch_scopes scope
              WHERE scope.user_id = ${userId} AND scope.branch_id = i.branch_id
            )
          LIMIT 1
          FOR UPDATE
        `;

        if (invoices.length === 0) {
          throw new ApiError(
            "Không tìm thấy hóa đơn hoặc bạn không có quyền.",
            404,
          );
        }

        const invoice = invoices[0];

        if (invoice.status === "CANCELLED") {
          throw new ApiError("Hóa đơn đã hủy, không thể thu tiền.");
        }

        if (invoice.status === "PAID") {
          throw new ApiError("Hóa đơn đã thanh toán đủ.");
        }

        const paidRows = await tx.$queryRaw<Array<{ paid: string }>>`
          SELECT CAST(COALESCE(SUM(amount), 0) AS CHAR) AS paid
          FROM payments
          WHERE invoice_id = ${invoiceId} AND status = 'COMPLETED'
        `;

        const total = toCents(invoice.amount) ?? BigInt(0);
        const paid = toCents(paidRows[0].paid) ?? BigInt(0);
        const remaining = total - paid;

        if (amountCents > remaining) {
          throw new ApiError(
            `Số tiền vượt quá số còn nợ (${fromCents(remaining)}).`,
          );
        }

        await tx.$executeRaw`
          INSERT INTO payments (
            branch_id, invoice_id, amount, payment_method,
            transaction_code, paid_at, recorded_by, status
          )
          VALUES (
            ${invoice.branch_id}, ${invoiceId}, ${fromCents(amountCents)}, ${method},
            ${transactionCode}, NOW(), ${userId}, ${"COMPLETED"}
          )
        `;

        await recomputeInvoice(tx, invoiceId);

        return fromCents(remaining - amountCents);
      },
      { timeout: 20000, maxWait: 10000 },
    );

    return NextResponse.json(
      {
        success: true,
        message:
          result === "0.00"
            ? "Đã thu tiền. Hóa đơn đã thanh toán đủ."
            : `Đã thu tiền. Còn nợ ${result}.`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CREATE PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể ghi nhận thanh toán." },
      { status: 500 },
    );
  }
}
