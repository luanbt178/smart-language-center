import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const roles = [
  {
    code: "ADMIN",
    name: "Quản trị viên hệ thống",
    description: "Quản trị tài khoản, phân quyền, chi nhánh và vận hành hệ thống",
  },
  {
    code: "MANAGER",
    name: "Ban giám đốc / Quản lý trung tâm",
    description: "Theo dõi KPI, vận hành và báo cáo",
  },
  {
    code: "SALES",
    name: "Tư vấn tuyển sinh",
    description: "Quản lý lead, placement và tuyển sinh",
  },
  {
    code: "ACADEMIC",
    name: "Giáo vụ",
    description: "Quản lý khóa học, lớp học, lịch học và đánh giá",
  },
  {
    code: "TEACHER",
    name: "Giáo viên",
    description: "Giảng dạy, điểm danh và đánh giá học viên",
  },
  {
    code: "ACCOUNTANT",
    name: "Kế toán / Thu ngân",
    description: "Quản lý hóa đơn, thanh toán và công nợ",
  },
  {
    code: "STUDENT",
    name: "Học viên",
    description: "Theo dõi lịch học, chuyên cần, kết quả và tiến độ",
  },
  {
    code: "PARENT",
    name: "Phụ huynh",
    description: "Theo dõi thông tin học viên được liên kết",
  },
];

const permissions = [
  {
    code: "USER_VIEW",
    name: "Xem tài khoản",
    module: "USER",
    action: "VIEW",
    description: "Xem danh sách tài khoản",
  },
  {
    code: "USER_CREATE",
    name: "Tạo tài khoản",
    module: "USER",
    action: "CREATE",
    description: "Tạo tài khoản",
  },
  {
    code: "USER_UPDATE",
    name: "Sửa tài khoản",
    module: "USER",
    action: "UPDATE",
    description: "Sửa tài khoản",
  },
  {
    code: "USER_DELETE",
    name: "Xóa tài khoản",
    module: "USER",
    action: "DELETE",
    description: "Xóa tài khoản",
  },

  {
    code: "ROLE_VIEW",
    name: "Xem role",
    module: "ROLE",
    action: "VIEW",
    description: "Xem role",
  },
  {
    code: "ROLE_CREATE",
    name: "Tạo role",
    module: "ROLE",
    action: "CREATE",
    description: "Tạo role",
  },
  {
    code: "ROLE_UPDATE",
    name: "Sửa role",
    module: "ROLE",
    action: "UPDATE",
    description: "Sửa role",
  },

  {
    code: "LEAD_VIEW",
    name: "Xem lead",
    module: "LEAD",
    action: "VIEW",
    description: "Xem khách hàng tiềm năng",
  },
  {
    code: "LEAD_CREATE",
    name: "Tạo lead",
    module: "LEAD",
    action: "CREATE",
    description: "Tạo lead",
  },
  {
    code: "LEAD_UPDATE",
    name: "Sửa lead",
    module: "LEAD",
    action: "UPDATE",
    description: "Sửa lead",
  },

  {
    code: "PLACEMENT_VIEW",
    name: "Xem placement test",
    module: "PLACEMENT",
    action: "VIEW",
    description: "Xem bài kiểm tra đầu vào",
  },
  {
    code: "PLACEMENT_CREATE",
    name: "Tạo placement test",
    module: "PLACEMENT",
    action: "CREATE",
    description: "Tạo bài kiểm tra đầu vào",
  },

  {
    code: "COURSE_VIEW",
    name: "Xem khóa học",
    module: "COURSE",
    action: "VIEW",
    description: "Xem khóa học",
  },
  {
    code: "COURSE_CREATE",
    name: "Tạo khóa học",
    module: "COURSE",
    action: "CREATE",
    description: "Tạo khóa học",
  },

  {
    code: "CLASS_VIEW",
    name: "Xem lớp học",
    module: "CLASS",
    action: "VIEW",
    description: "Xem lớp học",
  },
  {
    code: "CLASS_CREATE",
    name: "Tạo lớp học",
    module: "CLASS",
    action: "CREATE",
    description: "Tạo lớp học",
  },
  {
    code: "CLASS_UPDATE",
    name: "Sửa lớp học",
    module: "CLASS",
    action: "UPDATE",
    description: "Sửa lớp học",
  },

  {
    code: "SCHEDULE_VIEW",
    name: "Xem lịch học",
    module: "SCHEDULE",
    action: "VIEW",
    description: "Xem lịch học",
  },
  {
    code: "SCHEDULE_CREATE",
    name: "Tạo lịch học",
    module: "SCHEDULE",
    action: "CREATE",
    description: "Tạo lịch học",
  },

  {
    code: "ATTENDANCE_VIEW",
    name: "Xem điểm danh",
    module: "ATTENDANCE",
    action: "VIEW",
    description: "Xem chuyên cần",
  },
  {
    code: "ATTENDANCE_CREATE",
    name: "Điểm danh",
    module: "ATTENDANCE",
    action: "CREATE",
    description: "Ghi nhận điểm danh",
  },

  {
    code: "ASSESSMENT_VIEW",
    name: "Xem đánh giá",
    module: "ASSESSMENT",
    action: "VIEW",
    description: "Xem bài kiểm tra và kết quả",
  },
  {
    code: "ASSESSMENT_CREATE",
    name: "Tạo đánh giá",
    module: "ASSESSMENT",
    action: "CREATE",
    description: "Tạo bài đánh giá",
  },
  {
    code: "ASSESSMENT_UPDATE",
    name: "Nhập kết quả",
    module: "ASSESSMENT",
    action: "UPDATE",
    description: "Cập nhật kết quả",
  },

  {
    code: "INVOICE_VIEW",
    name: "Xem hóa đơn",
    module: "FINANCE",
    action: "VIEW",
    description: "Xem hóa đơn",
  },
  {
    code: "PAYMENT_CREATE",
    name: "Ghi nhận thanh toán",
    module: "FINANCE",
    action: "CREATE",
    description: "Ghi nhận thanh toán",
  },
  {
    code: "RECEIVABLE_VIEW",
    name: "Xem công nợ",
    module: "FINANCE",
    action: "VIEW",
    description: "Xem công nợ",
  },

  {
    code: "REPORT_VIEW",
    name: "Xem báo cáo",
    module: "REPORT",
    action: "VIEW",
    description: "Xem báo cáo",
  },

  {
    code: "AUDIT_VIEW",
    name: "Xem nhật ký",
    module: "AUDIT",
    action: "VIEW",
    description: "Xem audit log",
  },

  {
    code: "PORTAL_VIEW",
    name: "Truy cập portal",
    module: "PORTAL",
    action: "VIEW",
    description: "Truy cập portal cá nhân",
  },

  {
    code: "AI_USE",
    name: "Sử dụng AI",
    module: "AI",
    action: "USE",
    description: "Sử dụng tính năng AI",
  },
];

const rolePermissionMap: Record<string, string[]> = {
  ADMIN: permissions.map((p) => p.code),

  MANAGER: [
    "REPORT_VIEW",
    "LEAD_VIEW",
    "COURSE_VIEW",
    "CLASS_VIEW",
    "SCHEDULE_VIEW",
    "ATTENDANCE_VIEW",
    "ASSESSMENT_VIEW",
    "INVOICE_VIEW",
    "RECEIVABLE_VIEW",
  ],

  SALES: [
    "LEAD_VIEW",
    "LEAD_CREATE",
    "LEAD_UPDATE",
    "PLACEMENT_VIEW",
    "PLACEMENT_CREATE",
    "COURSE_VIEW",
  ],

  ACADEMIC: [
    "COURSE_VIEW",
    "COURSE_CREATE",
    "CLASS_VIEW",
    "CLASS_CREATE",
    "CLASS_UPDATE",
    "SCHEDULE_VIEW",
    "SCHEDULE_CREATE",
    "ATTENDANCE_VIEW",
    "ASSESSMENT_VIEW",
    "ASSESSMENT_CREATE",
    "ASSESSMENT_UPDATE",
  ],

  TEACHER: [
    "CLASS_VIEW",
    "SCHEDULE_VIEW",
    "ATTENDANCE_VIEW",
    "ATTENDANCE_CREATE",
    "ASSESSMENT_VIEW",
    "ASSESSMENT_UPDATE",
    "AI_USE",
  ],

  ACCOUNTANT: [
    "INVOICE_VIEW",
    "PAYMENT_CREATE",
    "RECEIVABLE_VIEW",
  ],

  STUDENT: [
    "PORTAL_VIEW",
    "SCHEDULE_VIEW",
    "ATTENDANCE_VIEW",
    "ASSESSMENT_VIEW",
  ],

  PARENT: [
    "PORTAL_VIEW",
    "SCHEDULE_VIEW",
    "ATTENDANCE_VIEW",
    "ASSESSMENT_VIEW",
    "INVOICE_VIEW",
  ],
};

const demoUsers = [
  {
    username: "admin",
    fullName: "Nguyễn Quản Trị",
    email: "admin@smartlanguage.local",
    role: "ADMIN",
  },
  {
    username: "manager",
    fullName: "Nguyễn Giám Đốc",
    email: "manager@smartlanguage.local",
    role: "MANAGER",
  },
  {
    username: "sales",
    fullName: "Nguyễn Tư Vấn",
    email: "sales@smartlanguage.local",
    role: "SALES",
  },
  {
    username: "academic",
    fullName: "Nguyễn Giáo Vụ",
    email: "academic@smartlanguage.local",
    role: "ACADEMIC",
  },
  {
    username: "teacher",
    fullName: "Nguyễn Giáo Viên",
    email: "teacher@smartlanguage.local",
    role: "TEACHER",
  },
  {
    username: "accountant",
    fullName: "Nguyễn Kế Toán",
    email: "accountant@smartlanguage.local",
    role: "ACCOUNTANT",
  },
  {
    username: "student",
    fullName: "Nguyễn Học Viên",
    email: "student@smartlanguage.local",
    role: "STUDENT",
  },
  {
    username: "parent",
    fullName: "Nguyễn Phụ Huynh",
    email: "parent@smartlanguage.local",
    role: "PARENT",
  },
];

async function ensureOrganization() {
  const existing = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM organizations
    WHERE code = ${"ORG001"}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0].id;
  }

  await prisma.$executeRaw`
    INSERT INTO organizations (
      code,
      name,
      description,
      created_at
    )
    VALUES (
      ${"ORG001"},
      ${"Smart Language Center"},
      ${"Tổ chức mẫu phục vụ phát triển hệ thống"},
      NOW()
    )
  `;

  const created = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM organizations
    WHERE code = ${"ORG001"}
    LIMIT 1
  `;

  return created[0].id;
}

async function ensureBranch(organizationId: bigint) {
  const existing = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM branches
    WHERE code = ${"HN01"}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0].id;
  }

  await prisma.$executeRaw`
    INSERT INTO branches (
      organization_id,
      code,
      name,
      address,
      phone,
      status,
      created_at
    )
    VALUES (
      ${organizationId},
      ${"HN01"},
      ${"Chi nhánh Hà Nội"},
      ${"Hà Nội"},
      ${"02400000000"},
      ${"ACTIVE"},
      NOW()
    )
  `;

  const created = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM branches
    WHERE code = ${"HN01"}
    LIMIT 1
  `;

  return created[0].id;
}

async function seedRoles() {
  for (const role of roles) {
    await prisma.$executeRaw`
      INSERT INTO roles (
        code,
        name,
        description
      )
      VALUES (
        ${role.code},
        ${role.name},
        ${role.description}
      )
      ON DUPLICATE KEY UPDATE
        name = ${role.name},
        description = ${role.description}
    `;
  }
}

async function seedPermissions() {
  for (const permission of permissions) {
    await prisma.$executeRaw`
      INSERT INTO permissions (
        code,
        name,
        module,
        action,
        description
      )
      VALUES (
        ${permission.code},
        ${permission.name},
        ${permission.module},
        ${permission.action},
        ${permission.description}
      )
      ON DUPLICATE KEY UPDATE
        name = ${permission.name},
        module = ${permission.module},
        action = ${permission.action},
        description = ${permission.description}
    `;
  }
}

async function seedRolePermissions() {
  const roleCodes = Object.keys(rolePermissionMap);

  await prisma.$executeRawUnsafe(
    `
      DELETE rp
      FROM role_permissions rp
      INNER JOIN roles r
        ON r.id = rp.role_id
      WHERE r.code IN (${roleCodes.map(() => "?").join(",")})
    `,
    ...roleCodes,
  );

  for (const [roleCode, permissionCodes] of Object.entries(
    rolePermissionMap,
  )) {
    for (const permissionCode of permissionCodes) {
      await prisma.$executeRaw`
        INSERT INTO role_permissions (
          role_id,
          permission_id
        )
        SELECT
          r.id,
          p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = ${roleCode}
          AND p.code = ${permissionCode}
      `;
    }
  }
}

async function seedUsers(branchId: bigint) {
  const passwordHash = await bcrypt.hash("123456", 10);

  const usernames = demoUsers.map((u) => u.username);

  await prisma.$executeRawUnsafe(
    `
      DELETE ur
      FROM user_roles ur
      INNER JOIN users u
        ON u.id = ur.user_id
      WHERE u.username IN (${usernames.map(() => "?").join(",")})
    `,
    ...usernames,
  );

  await prisma.$executeRawUnsafe(
    `
      DELETE ubs
      FROM user_branch_scopes ubs
      INNER JOIN users u
        ON u.id = ubs.user_id
      WHERE u.username IN (${usernames.map(() => "?").join(",")})
    `,
    ...usernames,
  );

  for (const user of demoUsers) {
    await prisma.$executeRaw`
      INSERT INTO users (
        username,
        password_hash,
        full_name,
        email,
        phone,
        status,
        created_at
      )
      VALUES (
        ${user.username},
        ${passwordHash},
        ${user.fullName},
        ${user.email},
        ${"0900000000"},
        ${"ACTIVE"},
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        password_hash = ${passwordHash},
        full_name = ${user.fullName},
        email = ${user.email},
        status = ${"ACTIVE"}
    `;
  }

  for (const user of demoUsers) {
    await prisma.$executeRaw`
      INSERT INTO user_roles (
        user_id,
        role_id,
        created_at
      )
      SELECT
        u.id,
        r.id,
        NOW()
      FROM users u
      CROSS JOIN roles r
      WHERE u.username = ${user.username}
        AND r.code = ${user.role}
    `;

    await prisma.$executeRaw`
      INSERT INTO user_branch_scopes (
        user_id,
        branch_id,
        created_at
      )
      SELECT
        u.id,
        ${branchId},
        NOW()
      FROM users u
      WHERE u.username = ${user.username}
    `;
  }
}

async function main() {
  console.log("=== Seed demo bắt đầu ===");

  const organizationId = await ensureOrganization();
  console.log("Organization:", organizationId.toString());

  const branchId = await ensureBranch(organizationId);
  console.log("Branch:", branchId.toString());

  await seedRoles();
  console.log("✓ Roles");

  await seedPermissions();
  console.log("✓ Permissions");

  await seedRolePermissions();
  console.log("✓ Role permissions");

  await seedUsers(branchId);
  console.log("✓ Demo users");

  console.log("");
  console.log("=== HOÀN TẤT ===");
  console.log("Tài khoản:");
  console.log("admin      / 123456");
  console.log("manager    / 123456");
  console.log("sales      / 123456");
  console.log("academic   / 123456");
  console.log("teacher    / 123456");
  console.log("accountant / 123456");
  console.log("student    / 123456");
  console.log("parent     / 123456");
}

main()
  .catch((error) => {
    console.error("Seed thất bại:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });