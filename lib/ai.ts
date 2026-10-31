import "server-only";

import { ApiError } from "@/lib/api-error";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 25_000;

// Giới hạn đơn giản trong bộ nhớ: mỗi người dùng tối đa 20 yêu cầu / 10 phút.
// (Khởi động lại máy chủ sẽ xóa bộ đếm; đủ dùng cho thực tập.)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const hits = new Map<string, number[]>();

export function checkAiRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    throw new ApiError(
      "Bạn đã dùng AI quá nhiều lần, vui lòng thử lại sau vài phút.",
      429,
    );
  }

  recent.push(now);
  hits.set(userId, recent);
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

class RetryableAiError extends ApiError {}

const BUSY_MESSAGE = "AI đang quá tải, vui lòng thử lại sau ít phút.";

async function callOnce(
  model: string,
  apiKey: string,
  input: { system: string; prompt: string; maxOutputTokens?: number },
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: input.maxOutputTokens ?? 1024,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.error("GEMINI ERROR:", model, response.status, await response.text());

      if ([429, 500, 502, 503, 504].includes(response.status)) {
        throw new RetryableAiError(BUSY_MESSAGE, 503);
      }

      if ([400, 403, 404].includes(response.status)) {
        throw new ApiError(
          "Cấu hình AI chưa đúng (khóa API hoặc tên mô hình). Hãy kiểm tra .env.",
          503,
        );
      }

      throw new ApiError("Dịch vụ AI đang lỗi, vui lòng thử lại.", 502);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new RetryableAiError("AI không trả về nội dung, hãy thử lại.", 502);
    }

    return text;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new RetryableAiError("AI phản hồi quá lâu, vui lòng thử lại.", 504);
    }

    console.error("GEMINI REQUEST ERROR:", error);
    throw new RetryableAiError("Không kết nối được dịch vụ AI.", 502);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Thử tối đa 2 lần mỗi mô hình khi Google quá tải hoặc chậm.
 * GEMINI_FALLBACK_MODEL (không bắt buộc) là mô hình dự phòng.
 */
export async function generateText(input: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const primary = process.env.GEMINI_MODEL;

  if (!apiKey || !primary) {
    throw new ApiError(
      "Chưa cấu hình AI: thiếu GEMINI_API_KEY hoặc GEMINI_MODEL trong .env.",
      503,
    );
  }

  const models = [primary, process.env.GEMINI_FALLBACK_MODEL].filter(
    (name): name is string => Boolean(name),
  );

  let lastError: ApiError = new ApiError(BUSY_MESSAGE, 503);

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callOnce(model, apiKey, input);
      } catch (error) {
        if (!(error instanceof RetryableAiError)) throw error;

        lastError = error;

        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
  }

  throw lastError;
}