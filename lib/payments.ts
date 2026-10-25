import { toCents } from "@/lib/money";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
};

export type PaymentInput = {
  invoiceId: bigint;
  amountCents: bigint;
  method: string;
  transactionCode: string | null;
};

export function parsePaymentInput(
  body: Record<string, unknown>,
):
  | { ok: true; data: PaymentInput }
  | { ok: false; error: string } {
  const invoiceText = String(body.invoiceId ?? "");

  if (!/^\d+$/.test(invoiceText)) {
    return { ok: false, error: "Vui lòng chọn hóa đơn." };
  }

  const amountCents = toCents(String(body.amount ?? ""));

  if (amountCents === null || amountCents <= BigInt(0)) {
    return {
      ok: false,
      error: "Số tiền phải lớn hơn 0 (tối đa 2 chữ số thập phân).",
    };
  }

  const method = typeof body.method === "string" ? body.method : "";

  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) {
    return { ok: false, error: "Hình thức thanh toán không hợp lệ." };
  }

  let transactionCode: string | null = null;

  if (body.transactionCode !== undefined && body.transactionCode !== null) {
    if (
      typeof body.transactionCode !== "string" ||
      body.transactionCode.trim().length > 100
    ) {
      return { ok: false, error: "Mã giao dịch tối đa 100 ký tự." };
    }

    transactionCode =
      body.transactionCode.trim() === "" ? null : body.transactionCode.trim();
  }

  return {
    ok: true,
    data: {
      invoiceId: BigInt(invoiceText),
      amountCents,
      method,
      transactionCode,
    },
  };
}
