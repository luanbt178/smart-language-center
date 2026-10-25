// Lỗi nghiệp vụ: trả về cho người dùng kèm mã HTTP tương ứng.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
