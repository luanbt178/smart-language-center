/**
 * Tạo dữ liệu mẫu hàng loạt cho Smart Language Center.
 *
 * Chạy:   npx tsx scripts/seed-bulk.ts small|medium|large
 * Xóa:    npx tsx scripts/seed-bulk.ts reset
 *
 * Dữ liệu do script tạo đều có dấu hiệu nhận biết (email @demo.local,
 * mã danh mục bắt đầu bằng DM-) nên "reset" chỉ xóa đúng phần này.
 * Cần chạy `scripts/seed-demo.ts` trước (để có chi nhánh HN01 và các vai trò).
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

type Profile = {
  teachers: number;
  rooms: number;
  students: number;
  leads: number;
  classesPerOffering: number;
};

const PROFILES: Record<string, Profile> = {
  small: { teachers: 8, rooms: 6, students: 60, leads: 40, classesPerOffering: 1 },
  medium: { teachers: 20, rooms: 12, students: 220, leads: 120, classesPerOffering: 2 },
  large: { teachers: 40, rooms: 20, students: 600, leads: 300, classesPerOffering: 3 },
};

const DOMAIN = "@demo.local";
const WEEKS_BEFORE = 14; // khóa cũ nhất bắt đầu cách hôm nay 14 tuần
const PASSWORD = "123456";

// ---------- Bộ sinh số ngẫu nhiên có hạt giống (chạy lại ra cùng kết quả) ----------
let seed = 20260601;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function int(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
function pick<T>(list: readonly T[]): T {
  return list[int(0, list.length - 1)];
}
function chance(p: number): boolean {
  return rnd() < p;
}

// ---------- Dữ liệu tiếng Việt ----------
const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const DEM_NAM = ["Văn", "Minh", "Quốc", "Đức", "Anh", "Hữu", "Gia", "Thành", "Tuấn"];
const DEM_NU = ["Thị", "Ngọc", "Thu", "Khánh", "Phương", "Bảo", "Mai", "Hồng", "Thùy"];
const TEN_NAM = ["Hùng", "Dũng", "Nam", "Khoa", "Long", "Phong", "Quân", "Sơn", "Tùng", "Hiếu", "Đạt", "Huy", "Bình", "Kiên", "Trung", "Việt", "Khải", "Lâm", "Nghĩa", "Thắng"];
const TEN_NU = ["Lan", "Hoa", "Linh", "Trang", "Hương", "Ngân", "Thảo", "Vy", "Yến", "Chi", "Hà", "Mai", "Nhung", "Oanh", "Quỳnh", "Thủy", "Uyên", "Xuân", "Phương", "Giang"];
const DUONG = ["Nguyễn Trãi", "Láng Hạ", "Cầu Giấy", "Xuân Thủy", "Trần Duy Hưng", "Giải Phóng", "Kim Mã", "Lê Văn Lương", "Nguyễn Chí Thanh", "Tây Sơn", "Hoàng Quốc Việt", "Phạm Văn Đồng"];
const QUAN = ["Cầu Giấy", "Đống Đa", "Thanh Xuân", "Ba Đình", "Hai Bà Trưng", "Nam Từ Liêm", "Bắc Từ Liêm", "Hà Đông", "Long Biên", "Tây Hồ"];
const SOURCES = ["Facebook", "Zalo", "Website", "Giới thiệu", "Trực tiếp", "Google"];

function unaccent(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function makePerson(gender: "MALE" | "FEMALE") {
  const ho = pick(HO);
  const dem = gender === "MALE" ? pick(DEM_NAM) : pick(DEM_NU);
  const ten = gender === "MALE" ? pick(TEN_NAM) : pick(TEN_NU);
  return { fullName: `${ho} ${dem} ${ten}`, ten, ho };
}

let phoneCounter = 0;
function makePhone(): string {
  phoneCounter += 1;
  const head = pick(["090", "091", "093", "097", "098", "035", "036", "070", "081", "085"]);
  return `${head}${String(1000000 + phoneCounter * 7919 + int(0, 99)).slice(-7)}`;
}

function makeAddress(): string {
  return `Số ${int(1, 250)} đường ${pick(DUONG)}, quận ${pick(QUAN)}, Hà Nội`;
}

// ---------- Ngày giờ ----------
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}
const NOW = new Date();
const NOW_TEXT = fmtDateTime(NOW);

// ---------- Truy vấn ----------
type Row = Record<string, unknown>;

async function q<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
  return (await prisma.$queryRawUnsafe(sql, ...params)) as T[];
}

async function run(sql: string, ...params: unknown[]): Promise<void> {
  await prisma.$executeRawUnsafe(sql, ...params);
}

// Chèn nhiều dòng một lần (mỗi lô 200 dòng) cho nhanh.
async function insertMany(
  table: string,
  columns: string[],
  rows: unknown[][],
): Promise<void> {
  const CHUNK = 200;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const one = `(${columns.map(() => "?").join(",")})`;
    const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${part.map(() => one).join(",")}`;

    await run(sql, ...part.flat());
  }
}

function money(n: number): string {
  return `${Math.round(n)}.00`;
}

function idOf(row: Row, key = "id"): bigint {
  return BigInt(String(row[key]));
}

// ---------- Xóa dữ liệu mẫu ----------
async function reset() {
  const steps: Array<[string, string]> = [
    ["assessment_results", `DELETE r FROM assessment_results r JOIN assessment_attempts t ON t.id=r.attempt_id JOIN assessments a ON a.id=t.assessment_id JOIN classes c ON c.id=a.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["assessment_attempts", `DELETE t FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id JOIN classes c ON c.id=a.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["assessments", `DELETE a FROM assessments a JOIN classes c ON c.id=a.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["attendance_records", `DELETE ar FROM attendance_records ar JOIN class_sessions s ON s.id=ar.session_id JOIN classes c ON c.id=s.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["class_sessions", `DELETE s FROM class_sessions s JOIN classes c ON c.id=s.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["class_schedules", `DELETE s FROM class_schedules s JOIN classes c ON c.id=s.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["teacher_assignments", `DELETE t FROM teacher_assignments t JOIN classes c ON c.id=t.class_id JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["payments", `DELETE p FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN enrollments e ON e.id=i.enrollment_id JOIN students s ON s.id=e.student_id WHERE s.email LIKE '%${DOMAIN}'`],
    ["receivables", `DELETE r FROM receivables r JOIN invoices i ON i.id=r.invoice_id JOIN enrollments e ON e.id=i.enrollment_id JOIN students s ON s.id=e.student_id WHERE s.email LIKE '%${DOMAIN}'`],
    ["invoices", `DELETE i FROM invoices i JOIN enrollments e ON e.id=i.enrollment_id JOIN students s ON s.id=e.student_id WHERE s.email LIKE '%${DOMAIN}'`],
    ["enrollment_status_history", `DELETE h FROM enrollment_status_history h JOIN enrollments e ON e.id=h.enrollment_id JOIN students s ON s.id=e.student_id WHERE s.email LIKE '%${DOMAIN}'`],
    ["enrollments", `DELETE e FROM enrollments e JOIN students s ON s.id=e.student_id WHERE s.email LIKE '%${DOMAIN}'`],
    ["classes", `DELETE c FROM classes c JOIN course_offerings o ON o.id=c.course_offering_id WHERE o.code LIKE 'DM-%'`],
    ["course_offerings", `DELETE FROM course_offerings WHERE code LIKE 'DM-%'`],
    ["course_versions", `DELETE v FROM course_versions v JOIN courses c ON c.id=v.course_id WHERE c.code LIKE 'DM-%'`],
    ["courses", `DELETE FROM courses WHERE code LIKE 'DM-%'`],
    ["program_versions", `DELETE v FROM program_versions v JOIN programs p ON p.id=v.program_id WHERE p.code LIKE 'DM-%'`],
    ["programs", `DELETE FROM programs WHERE code LIKE 'DM-%'`],
    ["student_guardians", `DELETE sg FROM student_guardians sg JOIN students s ON s.id=sg.student_id WHERE s.email LIKE '%${DOMAIN}'`],
    ["guardians", `DELETE FROM guardians WHERE email LIKE '%${DOMAIN}'`],
    ["students", `DELETE FROM students WHERE email LIKE '%${DOMAIN}'`],
    ["placement_results", `DELETE r FROM placement_results r JOIN placement_tests t ON t.id=r.placement_test_id JOIN leads l ON l.id=t.lead_id WHERE l.email LIKE '%${DOMAIN}'`],
    ["placement_tests", `DELETE t FROM placement_tests t JOIN leads l ON l.id=t.lead_id WHERE l.email LIKE '%${DOMAIN}'`],
    ["leads", `DELETE FROM leads WHERE email LIKE '%${DOMAIN}'`],
    ["rooms", `DELETE FROM rooms WHERE code LIKE 'DM-%'`],
    ["teachers", `DELETE FROM teachers WHERE email LIKE '%${DOMAIN}'`],
    ["user_roles", `DELETE ur FROM user_roles ur JOIN users u ON u.id=ur.user_id WHERE u.email LIKE '%${DOMAIN}'`],
    ["user_branch_scopes", `DELETE s FROM user_branch_scopes s JOIN users u ON u.id=s.user_id WHERE u.email LIKE '%${DOMAIN}'`],
    ["users", `DELETE FROM users WHERE email LIKE '%${DOMAIN}'`],
  ];

  for (const [name, sql] of steps) {
    try {
      await run(sql);
      console.log(`  đã xóa ${name}`);
    } catch (error) {
      console.log(`  BỎ QUA ${name}: ${(error as Error).message.slice(0, 120)}`);
    }
  }
}

// ---------- Danh mục khóa học ----------
const CATALOG = [
  { lang: ["EN", "Tiếng Anh"], programs: [
    { code: "DM-IELTS", name: "IELTS", levels: ["B1", "B2", "C1"], fee: [9, 14] },
    { code: "DM-GTAN", name: "Tiếng Anh giao tiếp", levels: ["A1", "A2", "B1"], fee: [4, 7] },
    { code: "DM-KIDS", name: "Tiếng Anh thiếu nhi", levels: ["A1", "A2"], fee: [3, 5] },
  ] },
  { lang: ["JP", "Tiếng Nhật"], programs: [
    { code: "DM-JLPT", name: "JLPT", levels: ["A2", "B1"], fee: [6, 10] },
  ] },
  { lang: ["KR", "Tiếng Hàn"], programs: [
    { code: "DM-TOPIK", name: "TOPIK", levels: ["A2", "B1"], fee: [5, 9] },
  ] },
  { lang: ["CN", "Tiếng Trung"], programs: [
    { code: "DM-HSK", name: "HSK", levels: ["A2", "B1"], fee: [5, 8] },
  ] },
];

const LEVEL_NAMES: Record<string, string> = {
  A1: "Sơ cấp A1", A2: "Sơ cấp A2", B1: "Trung cấp B1", B2: "Trung cấp B2", C1: "Cao cấp C1",
};

type Offering = {
  id: bigint;
  code: string;
  courseVersionId: bigint;
  fee: number;
  start: Date;
  end: Date;
  maxStudents: number;
  programName: string;
  levelCode: string;
};

async function getOrCreate(
  table: string,
  code: string,
  insertSql: string,
  ...params: unknown[]
): Promise<bigint> {
  const found = await q(`SELECT id FROM ${table} WHERE code = ? LIMIT 1`, code);

  if (found.length > 0) return idOf(found[0]);

  await run(insertSql, ...params);

  const created = await q(`SELECT id FROM ${table} WHERE code = ? LIMIT 1`, code);

  return idOf(created[0]);
}

async function buildCatalog(branchId: bigint): Promise<Offering[]> {
  const offerings: Offering[] = [];
  const levelIds: Record<string, bigint> = {};

  for (const code of Object.keys(LEVEL_NAMES)) {
    levelIds[code] = await getOrCreate(
      "levels", code,
      "INSERT INTO levels (code, name, description) VALUES (?, ?, NULL)",
      code, LEVEL_NAMES[code],
    );
  }

  for (const group of CATALOG) {
    const languageId = await getOrCreate(
      "languages", group.lang[0],
      "INSERT INTO languages (code, name) VALUES (?, ?)",
      group.lang[0], group.lang[1],
    );

    for (const program of group.programs) {
      const programId = await getOrCreate(
        "programs", program.code,
        "INSERT INTO programs (language_id, code, name, description) VALUES (?, ?, ?, ?)",
        languageId, program.code, program.name, `Chương trình ${program.name}`,
      );

      let pv = await q("SELECT id FROM program_versions WHERE program_id = ? LIMIT 1", programId);

      if (pv.length === 0) {
        await run(
          "INSERT INTO program_versions (program_id, version_no, description, status, created_at) VALUES (?, ?, ?, 'ACTIVE', NOW())",
          programId, "2026", "Phiên bản 2026",
        );
        pv = await q("SELECT id FROM program_versions WHERE program_id = ? LIMIT 1", programId);
      }

      const programVersionId = idOf(pv[0]);

      for (const levelCode of program.levels) {
        const courseCode = `${program.code}-${levelCode}`;
        const courseId = await getOrCreate(
          "courses", courseCode,
          "INSERT INTO courses (program_version_id, level_id, code, name, description) VALUES (?, ?, ?, ?, NULL)",
          programVersionId, levelIds[levelCode], courseCode, `${program.name} ${LEVEL_NAMES[levelCode]}`,
        );

        const fee = int(program.fee[0], program.fee[1]) * 1_000_000;
        let cv = await q("SELECT id, CAST(tuition_fee AS CHAR) AS fee FROM course_versions WHERE course_id = ? LIMIT 1", courseId);

        if (cv.length === 0) {
          await run(
            "INSERT INTO course_versions (course_id, version_no, description, tuition_fee, status, created_at) VALUES (?, '1.0', NULL, ?, 'ACTIVE', NOW())",
            courseId, money(fee),
          );
          cv = await q("SELECT id, CAST(tuition_fee AS CHAR) AS fee FROM course_versions WHERE course_id = ? LIMIT 1", courseId);
        }

        const courseVersionId = idOf(cv[0]);
        const realFee = Math.round(Number(cv[0].fee));

        // Mỗi khóa có 3 đợt khai giảng: đã kết thúc một phần, đang học, sắp khai giảng.
        const offsets = [-int(9, WEEKS_BEFORE), -int(2, 7), int(1, 4)];

        for (let k = 0; k < offsets.length; k += 1) {
          const start = addDays(NOW, offsets[k] * 7);
          const weeks = int(10, 12);
          const end = addDays(start, weeks * 7);
          const code = `DM-${courseCode.slice(3)}-${fmtDate(start).slice(2, 7).replace("-", "")}-${k + 1}`;

          const offeringId = await getOrCreate(
            "course_offerings", code,
            "INSERT INTO course_offerings (branch_id, course_version_id, code, start_date, end_date, max_students, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')",
            branchId, courseVersionId, code, fmtDate(start), fmtDate(end), int(14, 20),
          );

          const row = (await q(
            "SELECT DATE_FORMAT(start_date,'%Y-%m-%d') AS s, DATE_FORMAT(end_date,'%Y-%m-%d') AS e, max_students AS m FROM course_offerings WHERE id = ?",
            offeringId,
          ))[0];

          offerings.push({
            id: offeringId,
            code,
            courseVersionId,
            fee: realFee,
            start: new Date(`${row.s}T00:00:00`),
            end: new Date(`${row.e}T00:00:00`),
            maxStudents: Number(row.m),
            programName: program.name,
            levelCode,
          });
        }
      }
    }
  }

  return offerings;
}

// ---------- Chương trình chính ----------
const SLOT_PATTERNS: Array<Array<{ d: number; s: string; e: string }>> = [
  [{ d: 1, s: "18:00", e: "19:30" }, { d: 3, s: "18:00", e: "19:30" }],
  [{ d: 2, s: "18:00", e: "19:30" }, { d: 4, s: "18:00", e: "19:30" }],
  [{ d: 3, s: "19:45", e: "21:15" }, { d: 5, s: "19:45", e: "21:15" }],
  [{ d: 2, s: "19:45", e: "21:15" }, { d: 4, s: "19:45", e: "21:15" }],
  [{ d: 6, s: "08:00", e: "10:00" }, { d: 7, s: "08:00", e: "10:00" }],
  [{ d: 6, s: "10:15", e: "12:15" }, { d: 7, s: "10:15", e: "12:15" }],
  [{ d: 6, s: "14:00", e: "16:00" }, { d: 7, s: "14:00", e: "16:00" }],
  [{ d: 1, s: "08:00", e: "09:30" }, { d: 3, s: "08:00", e: "09:30" }, { d: 5, s: "08:00", e: "09:30" }],
  [{ d: 2, s: "14:00", e: "15:30" }, { d: 4, s: "14:00", e: "15:30" }],
  [{ d: 1, s: "19:45", e: "21:15" }, { d: 3, s: "19:45", e: "21:15" }],
];

type Interval = { start: string; end: string };
type ClassInfo = {
  id: bigint;
  offering: Offering;
  roomId: bigint;
  capacity: number;
  teacherId: bigint;
  teacherUserId: bigint;
  sessions: Array<{ id: bigint; date: string; start: string; end: string; done: boolean }>;
  students: bigint[];
};

function sessionsFor(offering: Offering, pattern: typeof SLOT_PATTERNS[number]) {
  const result: Array<{ date: string; start: string; end: string }> = [];
  const cursor = new Date(offering.start.getTime());

  while (cursor.getTime() <= offering.end.getTime()) {
    const js = cursor.getDay();
    const iso = js === 0 ? 7 : js;

    for (const slot of pattern) {
      if (slot.d === iso) {
        const date = fmtDate(cursor);

        result.push({ date, start: `${date} ${slot.s}:00`, end: `${date} ${slot.e}:00` });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function overlaps(list: Interval[] | undefined, start: string, end: string): boolean {
  if (!list) return false;

  return list.some((x) => x.start < end && start < x.end);
}

async function main() {
  const mode = (process.argv[2] ?? "").toLowerCase();

  if (mode === "reset") {
    console.log("Đang xóa dữ liệu mẫu hàng loạt...");
    await reset();
    console.log("Xong.");
    return;
  }

  const profile = PROFILES[mode];

  if (!profile) {
    console.log("Cách dùng: npx tsx scripts/seed-bulk.ts small|medium|large|reset");
    return;
  }

  const existing = await q("SELECT COUNT(*) AS n FROM students WHERE email LIKE ?", `%${DOMAIN}`);

  if (Number(existing[0].n) > 0) {
    console.log("Đã có dữ liệu mẫu hàng loạt. Hãy chạy `reset` trước rồi tạo lại.");
    return;
  }

  const branch = (await q("SELECT id FROM branches WHERE code = 'HN01' LIMIT 1"))[0];

  if (!branch) {
    console.log("Không tìm thấy chi nhánh HN01. Hãy chạy scripts/seed-demo.ts trước.");
    return;
  }

  const branchId = idOf(branch);
  const roles: Record<string, bigint> = {};

  for (const row of await q("SELECT id, code FROM roles")) {
    roles[String(row.code)] = idOf(row);
  }

  const adminRow = (await q("SELECT id FROM users WHERE username = 'admin' LIMIT 1"))[0];
  const salesRow = (await q("SELECT id FROM users WHERE username = 'sales' LIMIT 1"))[0];
  const adminId = adminRow ? idOf(adminRow) : null;
  const salesId = salesRow ? idOf(salesRow) : adminId;

  if (!adminId || !salesId || !roles.TEACHER || !roles.STUDENT) {
    console.log("Thiếu tài khoản admin/sales hoặc vai trò. Hãy chạy scripts/seed-demo.ts trước.");
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 10);

  // 1. Giáo viên (tài khoản + hồ sơ)
  console.log("1/8 Giáo viên...");
  const teacherUsers: unknown[][] = [];

  for (let i = 1; i <= profile.teachers; i += 1) {
    const person = makePerson(chance(0.5) ? "MALE" : "FEMALE");
    const username = `gv${String(i).padStart(2, "0")}.${unaccent(person.ten)}`;

    teacherUsers.push([username, hash, person.fullName, `${username}${DOMAIN}`, makePhone(), "ACTIVE", NOW_TEXT]);
  }

  await insertMany("users", ["username", "password_hash", "full_name", "email", "phone", "status", "created_at"], teacherUsers);

  const tUsers = await q("SELECT id, full_name, email, phone FROM users WHERE email LIKE ? AND username LIKE 'gv%' ORDER BY id", `%${DOMAIN}`);

  await insertMany("user_roles", ["user_id", "role_id", "created_at"], tUsers.map((u) => [idOf(u), roles.TEACHER, NOW_TEXT]));
  await insertMany("user_branch_scopes", ["user_id", "branch_id", "created_at"], tUsers.map((u) => [idOf(u), branchId, NOW_TEXT]));
  await insertMany(
    "teachers",
    ["user_id", "teacher_code", "full_name", "phone", "email", "employment_status", "created_at"],
    tUsers.map((u, i) => [idOf(u), `DMTMP${i}`, u.full_name, u.phone, u.email, "ACTIVE", NOW_TEXT]),
  );
  await run("UPDATE teachers SET teacher_code = CONCAT('GV', LPAD(id, 6, '0')) WHERE teacher_code LIKE 'DMTMP%'");

  const teachers = await q<{ id: bigint; user_id: bigint }>("SELECT id, user_id FROM teachers WHERE email LIKE ? ORDER BY id", `%${DOMAIN}`);

  // 2. Phòng học
  console.log("2/8 Phòng học...");
  const roomRows: unknown[][] = [];

  for (let i = 1; i <= profile.rooms; i += 1) {
    roomRows.push([branchId, `DM-P${100 + i}`, `Phòng ${100 + i}`, "ACTIVE", pick([12, 15, 18, 20, 24])]);
  }

  await insertMany("rooms", ["branch_id", "code", "name", "status", "capacity"], roomRows);

  const rooms = await q<{ id: bigint; capacity: number }>("SELECT id, capacity FROM rooms WHERE code LIKE 'DM-%' ORDER BY id");

  // 3. Danh mục khóa học
  console.log("3/8 Danh mục khóa học...");
  const offerings = await buildCatalog(branchId);

  // 4. Lớp học + lịch + buổi học
  console.log("4/8 Lớp học và lịch dạy...");
  const roomBusy = new Map<string, Interval[]>();
  const teacherBusy = new Map<string, Interval[]>();
  const classes: ClassInfo[] = [];
  const sessionRows: unknown[][] = [];
  const scheduleRows: unknown[][] = [];
  const classRows: Array<{ offering: Offering; room: (typeof rooms)[number]; teacher: (typeof teachers)[number]; pattern: typeof SLOT_PATTERNS[number]; name: string }> = [];

  for (const offering of offerings) {
    for (let n = 1; n <= profile.classesPerOffering; n += 1) {
      for (let attempt = 0; attempt < 150; attempt += 1) {
        const room = pick(rooms);
        const teacher = pick(teachers);
        const pattern = pick(SLOT_PATTERNS);
        const list = sessionsFor(offering, pattern);

        const clash = list.some(
          (s) =>
            overlaps(roomBusy.get(String(room.id)), s.start, s.end) ||
            overlaps(teacherBusy.get(String(teacher.id)), s.start, s.end),
        );

        if (clash || list.length === 0 || list.length > 300) continue;

        for (const s of list) {
          const rk = String(room.id);
          const tk = String(teacher.id);

          roomBusy.set(rk, [...(roomBusy.get(rk) ?? []), { start: s.start, end: s.end }]);
          teacherBusy.set(tk, [...(teacherBusy.get(tk) ?? []), { start: s.start, end: s.end }]);
        }

        classRows.push({ offering, room, teacher, pattern, name: `${offering.programName} ${LEVEL_NAMES[offering.levelCode]} - Lớp ${String.fromCharCode(64 + n)}` });
        break;
      }
    }
  }

  await insertMany(
    "classes",
    ["branch_id", "code", "name", "status", "course_offering_id", "created_at", "room_id"],
    classRows.map((c, i) => [branchId, `DMTMP${i}`, c.name, "ACTIVE", c.offering.id, fmtDateTime(addDays(c.offering.start, -14)), c.room.id]),
  );
  await run("UPDATE classes SET code = CONCAT('LH', LPAD(id, 6, '0')) WHERE code LIKE 'DMTMP%'");

  const classIds = await q<{ id: bigint; course_offering_id: bigint; room_id: bigint }>(
    "SELECT c.id, c.course_offering_id, c.room_id FROM classes c JOIN course_offerings o ON o.id = c.course_offering_id WHERE o.code LIKE 'DM-%' ORDER BY c.id",
  );

  // classRows và classIds cùng thứ tự chèn (id tăng dần) nên ghép theo vị trí.
  const teacherUser = new Map(teachers.map((t) => [String(t.id), t.user_id]));

  for (let i = 0; i < classRows.length; i += 1) {
    const c = classRows[i];
    const id = idOf(classIds[i]);
    const list = sessionsFor(c.offering, c.pattern);

    classes.push({
      id,
      offering: c.offering,
      roomId: c.room.id,
      capacity: Math.min(Number(c.room.capacity), c.offering.maxStudents),
      teacherId: c.teacher.id,
      teacherUserId: teacherUser.get(String(c.teacher.id)) ?? adminId,
      sessions: [],
      students: [],
    });

    for (const slot of c.pattern) {
      scheduleRows.push([id, slot.d, `${slot.s}:00`, `${slot.e}:00`]);
    }

    for (const s of list) {
      sessionRows.push([id, c.teacher.id, c.room.id, s.date, s.start, s.end, s.end < NOW_TEXT ? "DONE" : "SCHEDULED"]);
    }
  }

  await insertMany("teacher_assignments", ["class_id", "teacher_id", "role", "start_date", "end_date"], classes.map((c, i) => [c.id, c.teacherId, "MAIN", fmtDate(classRows[i].offering.start), fmtDate(classRows[i].offering.end)]));
  await insertMany("class_schedules", ["class_id", "day_of_week", "start_time", "end_time"], scheduleRows);
  await insertMany("class_sessions", ["class_id", "teacher_id", "room_id", "session_date", "start_at", "end_at", "status"], sessionRows);

  const classById = new Map(classes.map((c) => [String(c.id), c]));

  for (const row of await q(
    "SELECT s.id, s.class_id, DATE_FORMAT(s.session_date,'%Y-%m-%d') AS d, DATE_FORMAT(s.start_at,'%Y-%m-%d %H:%i:%s') AS st, DATE_FORMAT(s.end_at,'%Y-%m-%d %H:%i:%s') AS en, s.status FROM class_sessions s JOIN classes c ON c.id = s.class_id JOIN course_offerings o ON o.id = c.course_offering_id WHERE o.code LIKE 'DM-%' ORDER BY s.start_at",
  )) {
    classById.get(String(row.class_id))?.sessions.push({
      id: idOf(row),
      date: String(row.d),
      start: String(row.st),
      end: String(row.en),
      done: row.status === "DONE",
    });
  }

  // 5. Học viên + phụ huynh
  console.log("5/8 Học viên và phụ huynh...");
  const studentRows: unknown[][] = [];
  const studentMeta: Array<{ email: string; minor: boolean; fullName: string; ho: string }> = [];

  for (let i = 1; i <= profile.students; i += 1) {
    const gender = chance(0.55) ? "FEMALE" : "MALE";
    const person = makePerson(gender);
    const minor = chance(0.3);
    const age = minor ? int(7, 17) : int(18, 38);
    const dob = new Date(NOW.getFullYear() - age, int(0, 11), int(1, 28));
    const email = `${unaccent(person.ten)}${unaccent(person.ho)}${i}${DOMAIN}`;
    const created = addDays(NOW, -int(10, 330));

    studentMeta.push({ email, minor, fullName: person.fullName, ho: person.ho });
    studentRows.push([branchId, person.fullName, email, makePhone(), gender, fmtDateTime(created), chance(0.04) ? "INACTIVE" : "ACTIVE", `DMTMP${i}`, fmtDate(dob), makeAddress()]);
  }

  await insertMany("students", ["branch_id", "full_name", "email", "phone", "gender", "created_at", "status", "student_code", "dob", "address"], studentRows);
  await run("UPDATE students SET student_code = CONCAT('HV', LPAD(id, 6, '0')) WHERE student_code LIKE 'DMTMP%'");

  const students = await q<{ id: bigint; email: string; full_name: string }>("SELECT id, email, full_name FROM students WHERE email LIKE ? ORDER BY id", `%${DOMAIN}`);
  const studentIds = students.map((s) => idOf(s));
  const metaByEmail = new Map(studentMeta.map((m) => [m.email, m]));

  const guardianRows: unknown[][] = [];
  const guardianOf: bigint[] = [];

  for (const s of students) {
    const meta = metaByEmail.get(String(s.email));

    if (!meta?.minor) continue;

    const mother = chance(0.5);
    const person = makePerson(mother ? "FEMALE" : "MALE");

    const rest = person.fullName.split(" ").slice(1).join(" ");

    guardianRows.push([`${meta.ho} ${rest}`, `ph.${unaccent(person.ten)}${idOf(s)}${DOMAIN}`, makePhone(), NOW_TEXT, makeAddress()]);
    guardianOf.push(idOf(s));
  }

  if (guardianRows.length > 0) {
    await insertMany("guardians", ["full_name", "email", "phone", "created_at", "address"], guardianRows);

    const gs = await q("SELECT id FROM guardians WHERE email LIKE ? AND email LIKE 'ph.%' ORDER BY id", `%${DOMAIN}`);

    await insertMany(
      "student_guardians",
      ["guardian_id", "relationship", "is_primary", "student_id"],
      gs.map((g, i) => [idOf(g), "PARENT", 1, guardianOf[i]]),
    );
  }

  // 10 học viên đầu có tài khoản đăng nhập cổng học viên (mật khẩu 123456)
  const accountRows = students.slice(0, 10).map((s, i) => [`hocvien${String(i + 1).padStart(2, "0")}`, hash, s.full_name, s.email, makePhone(), "ACTIVE", NOW_TEXT]);

  await insertMany("users", ["username", "password_hash", "full_name", "email", "phone", "status", "created_at"], accountRows);

  const sUsers = await q("SELECT id FROM users WHERE username LIKE 'hocvien%' AND email LIKE ? ORDER BY id", `%${DOMAIN}`);

  await insertMany("user_roles", ["user_id", "role_id", "created_at"], sUsers.map((u) => [idOf(u), roles.STUDENT, NOW_TEXT]));
  await insertMany("user_branch_scopes", ["user_id", "branch_id", "created_at"], sUsers.map((u) => [idOf(u), branchId, NOW_TEXT]));

  // 6. Ghi danh + hóa đơn + thanh toán
  console.log("6/8 Ghi danh, hóa đơn, thanh toán...");
  const enrollRows: unknown[][] = [];
  const enrollMeta: Array<{ student: bigint; offering: Offering; classId: bigint | null; created: Date; cancelled: boolean }> = [];
  const seen = new Set<string>();
  const usable = classes.filter((c) => c.sessions.length > 0);

  for (const studentId of studentIds) {
    const count = chance(0.25) ? 2 : 1;

    for (let k = 0; k < count; k += 1) {
      const target = pick(usable);
      const key = `${studentId}-${target.offering.id}`;

      if (seen.has(key) || target.students.length >= target.capacity) continue;

      seen.add(key);

      const cancelled = chance(0.05);
      const waiting = !cancelled && chance(0.04);
      const created = addDays(target.offering.start, -int(1, 20));

      if (!cancelled && !waiting) target.students.push(studentId);

      enrollMeta.push({ student: studentId, offering: target.offering, classId: waiting ? null : target.id, created, cancelled });
      enrollRows.push([studentId, target.offering.id, waiting ? null : target.id, target.offering.courseVersionId, money(target.offering.fee), fmtDateTime(created), fmtDateTime(created), cancelled ? "CANCELLED" : "ACTIVE"]);
    }
  }

  await insertMany("enrollments", ["student_id", "course_offering_id", "class_id", "course_version_id", "price_snapshot", "created_at", "updated_at", "status"], enrollRows);

  const enrollDb = await q(
    "SELECT e.id, e.student_id, e.course_offering_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE s.email LIKE ? ORDER BY e.id",
    `%${DOMAIN}`,
  );
  const enrollId = new Map(enrollDb.map((e) => [`${e.student_id}-${e.course_offering_id}`, idOf(e)]));

  const histRows: unknown[][] = [];
  const invoiceRows: unknown[][] = [];
  const invoiced: Array<{ enrollmentId: bigint; amount: number; due: Date; issued: Date }> = [];

  for (const m of enrollMeta) {
    const id = enrollId.get(`${m.student}-${m.offering.id}`);

    if (!id) continue;

    histRows.push([id, null, "ACTIVE", adminId, fmtDateTime(m.created), "Ghi danh mới"]);

    if (m.cancelled) {
      histRows.push([id, "ACTIVE", "CANCELLED", adminId, fmtDateTime(addDays(m.created, int(1, 6))), "Học viên xin hủy"]);
      continue; // ghi danh đã hủy không phát hành hóa đơn
    }

    const due = addDays(m.created, 14);

    invoiced.push({ enrollmentId: id, amount: m.offering.fee, due, issued: m.created });
    invoiceRows.push([branchId, id, `DMTMP${id}`, money(m.offering.fee), fmtDate(due), "ISSUED", fmtDateTime(m.created)]);
  }

  await insertMany("enrollment_status_history", ["enrollment_id", "old_status", "new_status", "changed_by", "changed_at", "reason"], histRows);
  await insertMany("invoices", ["branch_id", "enrollment_id", "invoice_no", "amount", "due_date", "status", "issued_at"], invoiceRows);
  await run("UPDATE invoices SET invoice_no = CONCAT('HD', LPAD(id, 6, '0')) WHERE invoice_no LIKE 'DMTMP%'");

  const invDb = await q(
    "SELECT i.id, i.enrollment_id FROM invoices i JOIN enrollments e ON e.id = i.enrollment_id JOIN students s ON s.id = e.student_id WHERE s.email LIKE ? ORDER BY i.id",
    `%${DOMAIN}`,
  );
  const invoiceOf = new Map(invDb.map((i) => [String(i.enrollment_id), idOf(i)]));

  const payRows: unknown[][] = [];
  const recvRows: unknown[][] = [];
  const invStatus: Array<[string, bigint]> = [];
  let txn = 0;

  for (const inv of invoiced) {
    const invoiceId = invoiceOf.get(String(inv.enrollmentId));

    if (!invoiceId) continue;

    const roll = rnd();
    // 65% đóng đủ, 20% đóng một phần, 15% chưa đóng
    const plan = roll < 0.65 ? "FULL" : roll < 0.85 ? "PART" : "NONE";
    const payments: number[] = [];

    if (plan === "FULL") {
      if (chance(0.3)) {
        const first = Math.round(inv.amount * 0.5 / 1000) * 1000;

        payments.push(first, inv.amount - first);
      } else {
        payments.push(inv.amount);
      }
    } else if (plan === "PART") {
      payments.push(Math.round(inv.amount * (chance(0.5) ? 0.5 : 0.3) / 1000) * 1000);
    }

    let paid = 0;

    payments.forEach((amount, idx) => {
      const paidAt = addDays(inv.issued, int(0, 10) + idx * 14);

      if (paidAt.getTime() > NOW.getTime()) return;

      txn += 1;
      paid += amount;
      payRows.push([branchId, invoiceId, money(amount), pick(["CASH", "BANK_TRANSFER", "CARD"]), `DMTX${String(txn).padStart(6, "0")}`, fmtDateTime(paidAt), adminId, "COMPLETED"]);
    });

    const remaining = Math.max(inv.amount - paid, 0);
    const status = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "OPEN";

    recvRows.push([invoiceId, money(inv.amount), money(paid), money(remaining), status, NOW_TEXT]);
    invStatus.push([status === "PAID" ? "PAID" : status === "PARTIAL" ? "PARTIAL" : "ISSUED", invoiceId]);
  }

  await insertMany("payments", ["branch_id", "invoice_id", "amount", "payment_method", "transaction_code", "paid_at", "recorded_by", "status"], payRows);
  await insertMany("receivables", ["invoice_id", "total_amount", "paid_amount", "remaining_amount", "status", "updated_at"], recvRows);

  for (const [status, invoiceId] of invStatus) {
    if (status !== "ISSUED") await run("UPDATE invoices SET status = ? WHERE id = ?", status, invoiceId);
  }

  // 7. Điểm danh
  console.log("7/8 Điểm danh...");
  const attRows: unknown[][] = [];

  for (const c of classes) {
    for (const s of c.sessions) {
      if (!s.done) continue;

      for (const studentId of c.students) {
        const r = rnd();
        const status = r < 0.85 ? "PRESENT" : r < 0.9 ? "LATE" : r < 0.96 ? "ABSENT" : "EXCUSED";

        attRows.push([s.id, studentId, status, status === "EXCUSED" ? "Báo nghỉ có phép" : null, c.teacherUserId, s.end]);
      }
    }
  }

  await insertMany("attendance_records", ["session_id", "student_id", "status", "note", "recorded_by", "created_at"], attRows);

  // 8. Bài kiểm tra + điểm, và khách hàng tiềm năng
  console.log("8/8 Bài kiểm tra, điểm, khách hàng tiềm năng...");
  const GOOD = ["Làm bài tốt, tiếp tục phát huy.", "Nắm chắc kiến thức trọng tâm.", "Phát âm rõ ràng, tự tin."];
  const MID = ["Cần luyện thêm phần nghe.", "Còn sai ngữ pháp cơ bản, nên ôn lại.", "Cần tập trung hơn khi làm bài."];

  for (const c of classes) {
    const done = c.sessions.filter((s) => s.done);

    if (done.length < 3 || c.students.length === 0) continue;

    const plan: Array<{ name: string; type: string; at: string; published: boolean }> = [];
    const quarter = done[Math.floor(done.length / 4)];

    plan.push({ name: "Kiểm tra 15 phút", type: "QUIZ", at: quarter.end, published: true });

    if (done.length >= 8) {
      plan.push({ name: "Kiểm tra giữa khóa", type: "MIDTERM", at: done[Math.floor(done.length / 2)].end, published: true });
    }

    if (c.offering.end.getTime() < NOW.getTime()) {
      plan.push({ name: "Thi cuối khóa", type: "FINAL", at: done[done.length - 1].end, published: true });
    } else {
      plan.push({ name: "Kiểm tra nói", type: "SPEAKING", at: done[done.length - 1].end, published: chance(0.5) });
    }

    for (const a of plan) {
      await run(
        "INSERT INTO assessments (class_id, name, type, max_score, scheduled_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        c.id, a.name, a.type, "10.00", a.at, a.published ? "PUBLISHED" : "OPEN", adminId,
      );

      const aid = idOf((await q("SELECT id FROM assessments WHERE class_id = ? AND name = ? ORDER BY id DESC LIMIT 1", c.id, a.name))[0]);

      await insertMany(
        "assessment_attempts",
        ["assessment_id", "student_id", "attempt_no", "started_at", "submitted_at", "status"],
        c.students.map((sid) => [aid, sid, 1, null, null, "GRADED"]),
      );

      const attempts = await q("SELECT id, student_id FROM assessment_attempts WHERE assessment_id = ?", aid);

      await insertMany(
        "assessment_results",
        ["attempt_id", "score", "feedback", "graded_by", "graded_at", "published_at", "status"],
        attempts.map((attempt) => {
          const score = Math.min(10, Math.max(3, Math.round((7 + (rnd() + rnd() + rnd() - 1.5) * 2.6) * 10) / 10));

          return [idOf(attempt), score.toFixed(2), score >= 7 ? pick(GOOD) : pick(MID), c.teacherUserId, a.at, a.published ? a.at : null, a.published ? "PUBLISHED" : "GRADED"];
        }),
      );
    }
  }

  // Khách hàng tiềm năng + thi xếp lớp
  const STATUSES = ["NEW", "NEW", "CONTACTED", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];
  const leadRows: unknown[][] = [];

  for (let i = 1; i <= profile.leads; i += 1) {
    const person = makePerson(chance(0.5) ? "MALE" : "FEMALE");

    leadRows.push([branchId, person.fullName, `kh${i}.${unaccent(person.ten)}${DOMAIN}`, makePhone(), pick(SOURCES), fmtDateTime(addDays(NOW, -int(0, 90))), pick(STATUSES), salesId]);
  }

  await insertMany("leads", ["branch_id", "full_name", "email", "phone", "source", "created_at", "status", "assigned_user_id"], leadRows);

  const leads = await q("SELECT id, status FROM leads WHERE email LIKE ? ORDER BY id", `%${DOMAIN}`);
  const levelRows = await q("SELECT id FROM levels WHERE code IN ('A1','A2','B1','B2','C1')");

  for (const lead of leads) {
    if (!["CONTACTED", "QUALIFIED", "CONVERTED"].includes(String(lead.status)) || !chance(0.6)) continue;

    const taken = chance(0.6);
    const when = addDays(NOW, taken ? -int(1, 40) : int(1, 14));

    await run(
      "INSERT INTO placement_tests (branch_id, lead_id, test_date, created_by, status) VALUES (?, ?, ?, ?, ?)",
      branchId, idOf(lead), fmtDateTime(when), salesId, taken ? "COMPLETED" : "SCHEDULED",
    );

    if (taken && levelRows.length > 0) {
      const testId = idOf((await q("SELECT id FROM placement_tests WHERE lead_id = ? ORDER BY id DESC LIMIT 1", idOf(lead)))[0]);
      const scores = [0, 1, 2, 3].map(() => int(40, 95) / 10);
      const total = Math.round((scores.reduce((a, b) => a + b, 0) / 4) * 10) / 10;

      await run(
        "INSERT INTO placement_results (placement_test_id, listening_score, speaking_score, reading_score, writing_score, total_score, recommended_level_id, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        testId, scores[0].toFixed(2), scores[1].toFixed(2), scores[2].toFixed(2), scores[3].toFixed(2), total.toFixed(2),
        idOf(levelRows[Math.min(levelRows.length - 1, Math.floor(total / 2.2))]), salesId, fmtDateTime(when),
      );
    }
  }

  console.log("\nHOÀN TẤT. Tóm tắt:");

  for (const table of ["teachers", "rooms", "classes", "class_sessions", "students", "enrollments", "invoices", "payments", "attendance_records", "assessments", "assessment_results", "leads", "placement_tests"]) {
    const n = (await q(`SELECT COUNT(*) AS n FROM ${table}`))[0].n;

    console.log(`  ${table}: ${String(n)}`);
  }

  console.log("\nĐăng nhập thử: hocvien01 ... hocvien10 / gv01.<tên> (xem bảng users) — mật khẩu 123456");
}

main()
  .catch((error) => {
    console.error("LỖI:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });