import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";
import { checkAiRateLimit, generateText } from "@/lib/ai";
import { readText } from "@/lib/students";

const FOCUS: Record<string, string> = {
  GENERAL: "tổng hợp các kỹ năng",
  LISTENING: "kỹ năng Nghe",
  SPEAKING: "kỹ năng Nói",
  READING: "kỹ năng Đọc",
  WRITING: "kỹ năng Viết",
  VOCABULARY: "từ vựng",
  GRAMMAR: "ngữ pháp",
};

const MINUTES = [30, 45, 60, 90, 120];

const SYSTEM = `Bạn là trợ lý giúp giáo viên trung tâm ngoại ngữ soạn giáo án cho một buổi học.
Quy tắc:
- Viết tiếng Việt, văn bản thuần (không dùng ký hiệu markdown như #, *, **). Nội dung ví dụ và bài tập viết bằng ngôn ngữ đang được dạy.
- Dùng đúng các mục sau, mỗi tiêu đề viết HOA trên một dòng riêng:
MỤC TIÊU
KHỞI ĐỘNG
HOẠT ĐỘNG CHÍNH
BÀI TẬP LUYỆN TẬP (5 câu mẫu kèm đáp án)
BÀI TẬP VỀ NHÀ
GHI CHÚ CHO GIÁO VIÊN
- Mỗi hoạt động ghi rõ số phút, tổng thời lượng khớp với thời lượng buổi học.
- Ngắn gọn, thực tế, tối đa khoảng 400 từ. Không bịa số liệu về học viên.`;

// Gợi ý giáo án (không lưu). Giáo viên đọc và tự chỉnh trước khi dùng.
export async function POST(request: Request) {
  const auth = await requireApiPermission("AI_USE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const classText = String(body.classId ?? "");

    if (!/^\d+$/.test(classText)) {
      throw new ApiError("Vui lòng chọn lớp.");
    }

    const topic = readText(body.topic, 200);

    if (!topic) {
      throw new ApiError("Vui lòng nhập chủ đề buổi học (tối đa 200 ký tự).");
    }

    const notes = readText(body.notes, 500);

    if (notes === undefined) {
      throw new ApiError("Ghi chú tối đa 500 ký tự.");
    }

    const focusKey = String(body.focus ?? "GENERAL");
    const minutes = Number(body.minutes);

    if (!(focusKey in FOCUS) || !MINUTES.includes(minutes)) {
      throw new ApiError("Kỹ năng hoặc thời lượng không hợp lệ.");
    }

    const classId = BigInt(classText);
    const found = await findAccessibleClass(auth.session, classId);

    if (!found) {
      throw new ApiError("Không tìm thấy lớp hoặc bạn không có quyền.", 404);
    }

    const info = await prisma.$queryRaw<
      Array<{ course_name: string; student_count: bigint | number }>
    >`
      SELECT
        co.name AS course_name,
        (
          SELECT COUNT(*) FROM enrollments e
          WHERE e.class_id = c.id AND e.status = 'ACTIVE'
        ) AS student_count
      FROM classes c
      INNER JOIN course_offerings o ON o.id = c.course_offering_id
      INNER JOIN course_versions cv ON cv.id = o.course_version_id
      INNER JOIN courses co ON co.id = cv.course_id
      WHERE c.id = ${classId}
      LIMIT 1
    `;

    checkAiRateLimit(auth.session.userId.toString());

    const lines = [
      `Khóa học: ${info[0]?.course_name ?? found.name}.`,
      `Lớp: ${found.name}, khoảng ${Number(info[0]?.student_count ?? 0)} học viên.`,
      `Chủ đề buổi học: ${topic}.`,
      `Trọng tâm: ${FOCUS[focusKey]}.`,
      `Thời lượng: ${minutes} phút.`,
    ];

    if (notes) {
      lines.push(`Ghi chú của giáo viên: ${notes}.`);
    }

    const text = await generateText({
      system: SYSTEM,
      prompt: `Thông tin buổi học:\n${lines.join("\n")}\n\nHãy soạn giáo án.`,
      maxOutputTokens: 2048,
    });

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("AI LESSON PLAN ERROR:", error);

    return NextResponse.json(
      { error: "Không thể soạn giáo án bằng AI." },
      { status: 500 },
    );
  }
}