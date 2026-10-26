import { toCents } from "@/lib/money";
import { readText, validDateOnly } from "@/lib/students";

export const ASSESSMENT_TYPES = [
  "QUIZ",
  "MIDTERM",
  "FINAL",
  "SPEAKING",
  "OTHER",
] as const;

export const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  QUIZ: "Kiểm tra nhanh",
  MIDTERM: "Giữa kỳ",
  FINAL: "Cuối kỳ",
  SPEAKING: "Nói",
  OTHER: "Khác",
};

// Cột max_score là DECIMAL(5,2) nên tối đa 999.99
const MAX_SCORE_CENTS = BigInt(99999);

export type AssessmentInput = {
  classId: bigint;
  name: string;
  type: string;
  maxScoreCents: bigint;
  scheduledDate: string;
};

export function parseAssessmentInput(
  body: Record<string, unknown>,
):
  | { ok: true; data: AssessmentInput }
  | { ok: false; error: string } {
  const classText = String(body.classId ?? "").trim();

  if (!/^\d+$/.test(classText)) {
    return { ok: false, error: "Vui lòng chọn lớp." };
  }

  const name = readText(body.name, 150);

  if (!name) {
    return { ok: false, error: "Vui lòng nhập tên bài đánh giá (tối đa 150 ký tự)." };
  }

  const type = typeof body.type === "string" ? body.type : "";

  if (!(ASSESSMENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Loại bài đánh giá không hợp lệ." };
  }

  const maxScoreCents = toCents(String(body.maxScore ?? "").replace(",", "."));

  if (
    maxScoreCents === null ||
    maxScoreCents <= BigInt(0) ||
    maxScoreCents > MAX_SCORE_CENTS
  ) {
    return { ok: false, error: "Điểm tối đa phải lớn hơn 0 và không quá 999.99." };
  }

  const scheduledDate =
    typeof body.scheduledDate === "string" ? body.scheduledDate.trim() : "";

  if (!validDateOnly(scheduledDate)) {
    return { ok: false, error: "Vui lòng chọn ngày kiểm tra hợp lệ." };
  }

  return {
    ok: true,
    data: {
      classId: BigInt(classText),
      name,
      type,
      maxScoreCents,
      scheduledDate,
    },
  };
}

export type ScoreInput = {
  studentId: bigint;
  scoreCents: bigint;
  feedback: string | null;
};

// Chỉ nhận các dòng đã nhập điểm; điểm phải nằm trong [0, điểm tối đa].
export function parseScores(
  value: unknown,
  maxScoreCents: bigint,
):
  | { ok: true; data: ScoreInput[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Chưa có điểm nào để lưu." };
  }

  if (value.length > 500) {
    return { ok: false, error: "Quá nhiều học viên trong một lần lưu." };
  }

  const seen = new Set<string>();
  const result: ScoreInput[] = [];

  for (const item of value) {
    const raw = item as Record<string, unknown>;
    const studentText = String(raw.studentId ?? "");

    if (!/^\d+$/.test(studentText) || seen.has(studentText)) {
      return { ok: false, error: "Danh sách học viên không hợp lệ." };
    }

    seen.add(studentText);

    const scoreCents = toCents(String(raw.score ?? "").replace(",", "."));

    if (scoreCents === null) {
      return {
        ok: false,
        error: "Điểm phải là số, tối đa 2 chữ số thập phân (ví dụ 8.5).",
      };
    }

    if (scoreCents > maxScoreCents) {
      return { ok: false, error: "Có điểm lớn hơn điểm tối đa của bài." };
    }

    let feedback: string | null = null;

    if (raw.feedback !== undefined && raw.feedback !== null) {
      if (typeof raw.feedback !== "string" || raw.feedback.trim().length > 1000) {
        return { ok: false, error: "Nhận xét tối đa 1000 ký tự." };
      }

      feedback = raw.feedback.trim() === "" ? null : raw.feedback.trim();
    }

    result.push({ studentId: BigInt(studentText), scoreCents, feedback });
  }

  return { ok: true, data: result };
}