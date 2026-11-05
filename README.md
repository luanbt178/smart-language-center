
# Smart Language Center

Hệ thống quản lý trung tâm ngoại ngữ: tuyển sinh, học viên, ghi danh, lớp học và lịch học, điểm danh, đánh giá, học phí và công nợ, báo cáo, cổng học viên/phụ huynh, trợ lý giảng dạy AI.

## Công nghệ

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- Prisma 7 với MySQL/MariaDB
- Xác thực JWT (jose) lưu trong cookie httpOnly, mã hóa mật khẩu bằng bcryptjs
- Phân quyền theo vai trò (RBAC) có giới hạn theo chi nhánh và lớp
- Google Gemini cho các gợi ý AI

## Chạy thử trên máy

1. Cài Node.js 20 trở lên và MySQL/MariaDB.
2. Tạo cơ sở dữ liệu và nạp cấu trúc bảng (thư mục `prisma/sql`).
3. Tạo file `.env` (xem `.env.example`):

   - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`: kết nối MySQL/MariaDB
   - `DATABASE_URL`: chuỗi kết nối dạng `mysql://user:pass@host:3306/ten_db` (chỉ dùng cho lệnh Prisma)
   - `AUTH_SECRET`: khóa ký JWT (chuỗi dài, ngẫu nhiên)
   - `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`: cấu hình AI (tùy chọn)
   - `NEXT_PUBLIC_APP_URL`: địa chỉ của ứng dụng
4. Cài và chạy:

   ```bash
   npm install
   npx prisma generate
   npm run dev
   ```
5. Nạp dữ liệu mẫu:

   ```bash
   npx tsx scripts/seed-demo.ts
   npx tsx scripts/seed-bulk.ts small   # small | medium | large, thêm "reset" để xóa dữ liệu demo
   ```
6. Tạo file `.env` (xem `.env.example`):

   - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`: kết nối MySQL/MariaDB
   - `DATABASE_URL`: chuỗi kết nối dạng `mysql://user:pass@host:3306/ten_db` (chỉ dùng cho lệnh Prisma)
   - `AUTH_SECRET`: khóa ký JWT (chuỗi dài, ngẫu nhiên)
   - `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`: cấu hình AI (tùy chọn)
   - `NEXT_PUBLIC_APP_URL`: địa chỉ của ứng dụ

## Cấu trúc thư mục

- `app/` trang giao diện và API (`app/api/...`)
- `components/` thành phần giao diện dùng chung
- `lib/` xử lý nghiệp vụ, phân quyền, nhật ký hệ thống
- `prisma/` lược đồ cơ sở dữ liệu
- `scripts/` script nạp dữ liệu mẫu

## Quy ước

- Mọi API đều kiểm tra quyền bằng `requireApiPermission` và giới hạn theo chi nhánh.
- Thao tác quan trọng được ghi vào nhật ký hệ thống (`audit_logs`).
