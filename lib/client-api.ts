// Hàm gọi API dùng chung cho các trang (chạy ở trình duyệt).
export type ApiResult = { ok: boolean; message: string };

export async function callApi(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, message: data.error ?? "Thao tác thất bại." };
    }

    return { ok: true, message: data.message ?? "Thành công." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Đã xảy ra lỗi.",
    };
  }
}
