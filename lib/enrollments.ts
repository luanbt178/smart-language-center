import { validDateOnly } from "@/lib/students";

export const ENROLLMENT_STATUSES = ["ACTIVE", "CANCELLED"] as const;

export function makeInvoiceNo(id: bigint): string {
  return `HD${id.toString().padStart(6, "0")}`;
}

export type EnrollmentInput = {
  studentId: bigint;
  offeringId: bigint;
  dueDate: string | null;
};

export function parseEnrollmentInput(
  body: Record<string, unknown>,
):
  | { ok: true; data: EnrollmentInput }
  | { ok: false; error: string } {
  const studentText = String(body.studentId ?? "").trim();
  const offeringText = String(body.offeringId ?? "").trim();

  if (!/^\d+$/.test(studentText)) {
    return { ok: false, error: "Vui lòng chọn học viên." };
  }

  if (!/^\d+$/.test(offeringText)) {
    return { ok: false, error: "Vui lòng chọn khóa học đang mở." };
  }

  let dueDate: string | null = null;

  if (body.dueDate !== undefined && body.dueDate !== null) {
    if (typeof body.dueDate !== "string") {
      return { ok: false, error: "Hạn thanh toán không hợp lệ." };
    }

    const text = body.dueDate.trim();

    if (text !== "") {
      if (!validDateOnly(text)) {
        return {
          ok: false,
          error: "Hạn thanh toán phải có dạng năm-tháng-ngày.",
        };
      }

      dueDate = text;
    }
  }

  return {
    ok: true,
    data: {
      studentId: BigInt(studentText),
      offeringId: BigInt(offeringText),
      dueDate,
    },
  };
}
