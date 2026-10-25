import { fromCents, toCents } from "@/lib/money";

// Chỉ cần 2 hàm raw của transaction client của Prisma.
type Tx = {
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<number>;
};

// Tính lại số đã thu / còn nợ từ các giao dịch COMPLETED và cập nhật hóa đơn + công nợ.
export async function recomputeInvoice(tx: Tx, invoiceId: bigint) {
  const sums = await tx.$queryRaw<Array<{ paid: string }>>`
    SELECT CAST(COALESCE(SUM(amount), 0) AS CHAR) AS paid
    FROM payments
    WHERE invoice_id = ${invoiceId} AND status = 'COMPLETED'
  `;

  const invoices = await tx.$queryRaw<Array<{ amount: string }>>`
    SELECT CAST(amount AS CHAR) AS amount FROM invoices WHERE id = ${invoiceId}
  `;

  const total = toCents(invoices[0].amount) ?? BigInt(0);
  const paid = toCents(sums[0].paid) ?? BigInt(0);
  const remaining = total - paid;

  const status =
    remaining <= BigInt(0) ? "PAID" : paid > BigInt(0) ? "PARTIAL" : "OPEN";
  const invoiceStatus =
    status === "PAID" ? "PAID" : status === "PARTIAL" ? "PARTIAL" : "ISSUED";

  const paidText = fromCents(paid);
  const remainingText = fromCents(remaining < BigInt(0) ? BigInt(0) : remaining);

  await tx.$executeRaw`
    UPDATE receivables
    SET paid_amount = ${paidText},
        remaining_amount = ${remainingText},
        status = ${status},
        updated_at = NOW()
    WHERE invoice_id = ${invoiceId}
  `;

  await tx.$executeRaw`
    UPDATE invoices SET status = ${invoiceStatus} WHERE id = ${invoiceId}
  `;
}
