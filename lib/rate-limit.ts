// Đếm số lần thất bại theo khóa (ví dụ "ip|tên đăng nhập") trong một khoảng thời gian.
// Lưu trong bộ nhớ máy chủ: khởi động lại sẽ xóa bộ đếm (đủ dùng cho thực tập).

type Limiter = {
  /** Số giây còn bị khóa; 0 nếu chưa bị khóa. */
  retryAfter: (key: string) => number;
  /** Ghi nhận một lần thất bại. */
  fail: (key: string) => void;
  /** Xóa bộ đếm (khi thành công). */
  reset: (key: string) => void;
};

export function createFailureLimiter(max: number, windowMs: number): Limiter {
  const failures = new Map<string, number[]>();

  function recent(key: string): number[] {
    const now = Date.now();
    const list = (failures.get(key) ?? []).filter((t) => now - t < windowMs);

    if (list.length === 0) {
      failures.delete(key);
    } else {
      failures.set(key, list);
    }

    return list;
  }

  return {
    retryAfter(key) {
      const list = recent(key);

      if (list.length < max) return 0;

      // Khóa đến khi lần thất bại cũ nhất trong nhóm "max" hết hạn.
      const unlockAt = list[list.length - max] + windowMs;

      return Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
    },
    fail(key) {
      const list = recent(key);

      list.push(Date.now());
      failures.set(key, list);
    },
    reset(key) {
      failures.delete(key);
    },
  };
}