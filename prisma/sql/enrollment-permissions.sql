-- Thêm quyền ENROLLMENT_* và gán cho role. Chạy nhiều lần vẫn an toàn.
-- Sau khi chạy: đăng xuất rồi đăng nhập lại để quyền có hiệu lực.

INSERT INTO permissions (code, name, module, action, description)
SELECT v.code, v.name, 'ENROLLMENT', v.action, v.name
FROM (
  SELECT 'ENROLLMENT_VIEW'   AS code, 'Xem ghi danh'   AS name, 'VIEW'   AS action
  UNION ALL SELECT 'ENROLLMENT_CREATE', 'Ghi danh học viên', 'CREATE'
  UNION ALL SELECT 'ENROLLMENT_UPDATE', 'Hủy ghi danh',      'UPDATE'
) v
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (
  SELECT 'ADMIN' AS role_code, 'ENROLLMENT_VIEW' AS perm_code
  UNION ALL SELECT 'ADMIN',      'ENROLLMENT_CREATE'
  UNION ALL SELECT 'ADMIN',      'ENROLLMENT_UPDATE'
  UNION ALL SELECT 'SALES',      'ENROLLMENT_VIEW'
  UNION ALL SELECT 'SALES',      'ENROLLMENT_CREATE'
  UNION ALL SELECT 'ACADEMIC',   'ENROLLMENT_VIEW'
  UNION ALL SELECT 'ACADEMIC',   'ENROLLMENT_CREATE'
  UNION ALL SELECT 'ACADEMIC',   'ENROLLMENT_UPDATE'
  UNION ALL SELECT 'MANAGER',    'ENROLLMENT_VIEW'
  UNION ALL SELECT 'ACCOUNTANT', 'ENROLLMENT_VIEW'
) m
INNER JOIN roles r ON r.code = m.role_code
INNER JOIN permissions p ON p.code = m.perm_code
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Kiểm tra kết quả
SELECT r.code AS role_code, p.code AS permission_code
FROM role_permissions rp
INNER JOIN roles r ON r.id = rp.role_id
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE p.code LIKE 'ENROLLMENT\_%'
ORDER BY r.code, p.code;
