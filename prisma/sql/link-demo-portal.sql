-- Liên kết tài khoản demo `student` và `parent` với 1 học viên để thử Cổng thông tin.
-- Bước 1: đổi mã học viên bên dưới cho đúng (xem ở trang Học viên). Chạy lại nhiều lần vẫn an toàn.
SET @student_code = 'HV000001';

-- Học viên đăng nhập được nối với hồ sơ học viên bằng EMAIL TRÙNG NHAU.
UPDATE students
SET email = 'student@smartlanguage.local'
WHERE student_code = @student_code;

-- Tạo hồ sơ phụ huynh cho tài khoản `parent` (nếu chưa có).
INSERT INTO guardians (full_name, email, phone, created_at, address, user_id)
SELECT u.full_name, u.email, u.phone, NOW(), NULL, u.id
FROM users u
WHERE u.username = 'parent'
  AND NOT EXISTS (SELECT 1 FROM guardians g WHERE g.user_id = u.id);

-- Gắn phụ huynh với học viên (nếu chưa gắn).
INSERT INTO student_guardians (guardian_id, relationship, is_primary, student_id)
SELECT g.id, 'PARENT', 1, s.id
FROM guardians g
INNER JOIN users u ON u.id = g.user_id
INNER JOIN students s ON s.student_code = @student_code
WHERE u.username = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM student_guardians sg
    WHERE sg.guardian_id = g.id AND sg.student_id = s.id
  );

-- Kiểm tra kết quả: phải có 1 dòng ở mỗi bảng.
SELECT student_code, full_name, email FROM students WHERE student_code = @student_code;

SELECT s.student_code, g.full_name AS phu_huynh, u.username
FROM student_guardians sg
INNER JOIN guardians g ON g.id = sg.guardian_id
INNER JOIN users u ON u.id = g.user_id
INNER JOIN students s ON s.id = sg.student_id
WHERE s.student_code = @student_code;
