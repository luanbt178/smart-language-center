import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

type IdRow = {
  id: bigint;
};

type LanguageRow = {
  id: bigint;
  code: string;
  name: string;
};

type LevelRow = {
  id: bigint;
  code: string;
  name: string;
  description: string | null;
};

type ProgramRow = {
  id: bigint;
  language_id: bigint;
  code: string;
  name: string;
  description: string | null;
  language_code: string;
  language_name: string;
};

type ProgramVersionRow = {
  id: bigint;
  program_id: bigint;
  version_no: string;
  description: string | null;
  status: string;
  program_code: string;
  program_name: string;
};

type CourseRow = {
  id: bigint;
  program_version_id: bigint;
  level_id: bigint | null;
  code: string;
  name: string;
  description: string | null;
  program_version_no: string;
  program_code: string;
  program_name: string;
  level_code: string | null;
  level_name: string | null;
};

type CourseVersionRow = {
  id: bigint;
  course_id: bigint;
  version_no: string;
  description: string | null;
  tuition_fee: string | null;
  status: string;
  course_code: string;
  course_name: string;
};

type OfferingRow = {
  id: bigint;
  branch_id: bigint;
  course_version_id: bigint;
  code: string;
  start_date: string;
  end_date: string;
  max_students: number | null;
  status: string;
  branch_code: string;
  branch_name: string;
  course_code: string;
  course_name: string;
  course_version_no: string;
};

type BranchRow = {
  id: bigint;
  code: string;
  name: string;
};

const allowedStatuses = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
] as const;

/**
 * Chuyển dữ liệu có BigInt hoặc Date thành dữ liệu
 * có thể serialize thành JSON.
 *
 * Quan trọng:
 * Không chỉ chuyển id, mà còn chuyển toàn bộ BigInt
 * ở các cột khóa ngoại như language_id, program_id,
 * course_id, branch_id...
 */
function makeJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(makeJsonSafe);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [
          key,
          makeJsonSafe(nestedValue),
        ],
      ),
    );
  }

  return value;
}

/**
 * Chuyển id của một bản ghi thành string.
 * Các trường BigInt còn lại sẽ được xử lý
 * bởi makeJsonSafe().
 */
function toId<T extends { id: bigint }>(row: T) {
  const { id, ...rest } = row;

  return {
    ...rest,
    id: id.toString(),
  };
}

function text(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result.length > 0 ? result : null;
}

function optionalText(value: unknown): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return text(value);
}

function validText(
  value: unknown,
  maxLength: number,
  required = false,
): boolean {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return !required;
  }

  if (typeof value !== "string") {
    return false;
  }

  const result = value.trim();

  if (result.length > maxLength) {
    return false;
  }

  return !required || result.length > 0;
}

function validId(value: unknown): boolean {
  return /^\d+$/.test(String(value ?? ""));
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return allowedStatuses.includes(
    value as (typeof allowedStatuses)[number],
  )
    ? value
    : null;
}

/**
 * GET /api/catalog
 *
 * Yêu cầu quyền COURSE_VIEW.
 *
 * Đọc:
 * languages
 * levels
 * programs
 * program_versions
 * courses
 * course_versions
 * course_offerings
 * branches
 */
export async function GET() {
  const auth = await requireApiPermission("COURSE_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const [
      languages,
      levels,
      programs,
      programVersions,
      courses,
      courseVersions,
      offerings,
      branches,
    ] = await Promise.all([
      prisma.$queryRaw<LanguageRow[]>`
        SELECT
          id,
          code,
          name
        FROM languages
        ORDER BY name
      `,

      prisma.$queryRaw<LevelRow[]>`
        SELECT
          id,
          code,
          name,
          description
        FROM levels
        ORDER BY code
      `,

      prisma.$queryRaw<ProgramRow[]>`
        SELECT
          p.id,
          p.language_id,
          p.code,
          p.name,
          p.description,
          l.code AS language_code,
          l.name AS language_name
        FROM programs p
        INNER JOIN languages l
          ON l.id = p.language_id
        ORDER BY p.name
      `,

      prisma.$queryRaw<ProgramVersionRow[]>`
        SELECT
          pv.id,
          pv.program_id,
          pv.version_no,
          pv.description,
          pv.status,
          p.code AS program_code,
          p.name AS program_name
        FROM program_versions pv
        INNER JOIN programs p
          ON p.id = pv.program_id
        ORDER BY p.name, pv.version_no
      `,

      prisma.$queryRaw<CourseRow[]>`
        SELECT
          c.id,
          c.program_version_id,
          c.level_id,
          c.code,
          c.name,
          c.description,
          pv.version_no AS program_version_no,
          p.code AS program_code,
          p.name AS program_name,
          l.code AS level_code,
          l.name AS level_name
        FROM courses c
        INNER JOIN program_versions pv
          ON pv.id = c.program_version_id
        INNER JOIN programs p
          ON p.id = pv.program_id
        LEFT JOIN levels l
          ON l.id = c.level_id
        ORDER BY c.name
      `,

      prisma.$queryRaw<CourseVersionRow[]>`
        SELECT
          cv.id,
          cv.course_id,
          cv.version_no,
          cv.description,
          CAST(cv.tuition_fee AS CHAR) AS tuition_fee,
          cv.status,
          c.code AS course_code,
          c.name AS course_name
        FROM course_versions cv
        INNER JOIN courses c
          ON c.id = cv.course_id
        ORDER BY c.name, cv.version_no
      `,

      prisma.$queryRaw<OfferingRow[]>`
        SELECT
          o.id,
          o.branch_id,
          o.course_version_id,
          o.code,
          DATE_FORMAT(o.start_date, '%Y-%m-%d') AS start_date,
          DATE_FORMAT(o.end_date, '%Y-%m-%d') AS end_date,
          o.max_students,
          o.status,
          b.code AS branch_code,
          b.name AS branch_name,
          c.code AS course_code,
          c.name AS course_name,
          cv.version_no AS course_version_no
        FROM course_offerings o
        INNER JOIN branches b
          ON b.id = o.branch_id
        INNER JOIN course_versions cv
          ON cv.id = o.course_version_id
        INNER JOIN courses c
          ON c.id = cv.course_id
        WHERE EXISTS (
          SELECT 1
          FROM user_branch_scopes s
          WHERE s.user_id = ${userId}
            AND s.branch_id = o.branch_id
        )
        ORDER BY o.start_date DESC, o.id DESC
      `,

      prisma.$queryRaw<BranchRow[]>`
        SELECT DISTINCT
          b.id,
          b.code,
          b.name
        FROM branches b
        INNER JOIN user_branch_scopes s
          ON s.branch_id = b.id
        WHERE s.user_id = ${userId}
          AND b.status = 'ACTIVE'
        ORDER BY b.name
      `,
    ]);

    const responseData = {
      languages: languages.map((row) => toId(row)),

      levels: levels.map((row) => toId(row)),

      programs: programs.map((row) => ({
        ...toId(row),

        languageId: row.language_id.toString(),
        languageCode: row.language_code,
        languageName: row.language_name,
      })),

      programVersions: programVersions.map((row) => ({
        ...toId(row),

        programId: row.program_id.toString(),
        programCode: row.program_code,
        programName: row.program_name,
      })),

      courses: courses.map((row) => ({
        ...toId(row),

        programVersionId:
          row.program_version_id.toString(),

        levelId: row.level_id?.toString() ?? "",

        programVersionNo: row.program_version_no,
        programCode: row.program_code,
        programName: row.program_name,
        levelCode: row.level_code,
        levelName: row.level_name,
      })),

      courseVersions: courseVersions.map((row) => ({
        ...toId(row),

        courseId: row.course_id.toString(),
        courseCode: row.course_code,
        courseName: row.course_name,
        tuitionFee: row.tuition_fee,
      })),

      offerings: offerings.map((row) => ({
        ...toId(row),

        branchId: row.branch_id.toString(),

        courseVersionId:
          row.course_version_id.toString(),

        maxStudents: row.max_students,

        branchCode: row.branch_code,
        branchName: row.branch_name,

        courseCode: row.course_code,
        courseName: row.course_name,

        courseVersionNo: row.course_version_no,
      })),

      branches: branches.map((row) => toId(row)),
    };

    // Sửa lỗi BigInt tại đây:
    // Xử lý toàn bộ response trước khi gọi NextResponse.json().
    return NextResponse.json(makeJsonSafe(responseData));
  } catch (error) {
    console.error("GET CATALOG ERROR:", error);

    return NextResponse.json(
      {
        error: "Không thể tải dữ liệu danh mục.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/catalog
 *
 * Yêu cầu quyền COURSE_CREATE.
 *
 * entity hỗ trợ:
 * language
 * level
 * program
 * programVersion
 * course
 * courseVersion
 * offering
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission("COURSE_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<
      string,
      unknown
    >;

    const entity = text(body.entity);

    if (!entity) {
      return NextResponse.json(
        {
          error: "Thiếu loại danh mục.",
        },
        { status: 400 },
      );
    }

    const userId = BigInt(auth.session.userId);   

    let newId: bigint;

    // --------------------------------------------------
    // 1. LANGUAGES
    // --------------------------------------------------

    if (entity === "language") {
      const code = text(body.code);
      const name = text(body.name);

      if (
        !code ||
        !name ||
        !validText(body.code, 20, true) ||
        !validText(body.name, 100, true)
      ) {
        return NextResponse.json(
          {
            error:
              "Mã ngôn ngữ hoặc tên ngôn ngữ không hợp lệ.",
          },
          { status: 400 },
        );
      }

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO languages (
            code,
            name
          )
          VALUES (
            ${code},
            ${name}
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // 2. LEVELS
    // --------------------------------------------------

    else if (entity === "level") {
      const code = text(body.code);
      const name = text(body.name);
      const description = optionalText(body.description);

      if (
        !code ||
        !name ||
        !validText(body.code, 0, true) ||
        !validText(body.name, 100, true) ||
        !validText(body.description, 10000)
      ) {
        return NextResponse.json(
          {
            error:
              "Mã trình độ hoặc tên trình độ không hợp lệ.",
          },
          { status: 400 },
        );
      }

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO levels (
            code,
            name,
            description
          )
          VALUES (
            ${code},
            ${name},
            ${description}
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // 3. PROGRAMS
    // --------------------------------------------------

    else if (entity === "program") {
      const languageIdText = String(
        body.languageId ?? "",
      );

      const code = text(body.code);
      const name = text(body.name);
      const description = optionalText(body.description);

      if (
        !validId(languageIdText) ||
        !code ||
        !name ||
        !validText(body.code, 20, true) ||
        !validText(body.name, 100, true) ||
        !validText(body.description, 10000)
      ) {
        return NextResponse.json(
          {
            error:
              "Thông tin chương trình không hợp lệ.",
          },
          { status: 400 },
        );
      }

      const languageId = BigInt(languageIdText);

      const language = await prisma.$queryRaw<IdRow[]>`
        SELECT id
        FROM languages
        WHERE id = ${languageId}
        LIMIT 1
      `;

      if (language.length === 0) {
        return NextResponse.json(
          {
            error: "Ngôn ngữ được chọn không tồn tại.",
          },
          { status: 400 },
        );
      }

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO programs (
            language_id,
            code,
            name,
            description
          )
          VALUES (
            ${languageId},
            ${code},
            ${name},
            ${description}
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // 4. PROGRAM VERSIONS
    // --------------------------------------------------

    else if (entity === "programVersion") {
      const programIdText = String(
        body.programId ?? "",
      );

      const versionNo = text(body.versionNo);

      const description = optionalText(
        body.description,
      );

      const normalizedStatus = normalizeStatus(
        body.status,
      );

      if (
        !validId(programIdText) ||
        !versionNo ||
        !validText(body.versionNo, 30, true) ||
        !validText(body.description, 10000) ||
        !normalizedStatus
      ) {
        return NextResponse.json(
          {
            error:
              "Thông tin phiên bản chương trình không hợp lệ.",
          },
          { status: 400 },
        );
      }

      const programId = BigInt(programIdText);

      const program = await prisma.$queryRaw<IdRow[]>`
        SELECT id
        FROM programs
        WHERE id = ${programId}
        LIMIT 1
      `;

      if (program.length === 0) {
        return NextResponse.json(
          {
            error: "Chương trình không tồn tại.",
          },
          { status: 400 },
        );
      }

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO program_versions (
            program_id,
            version_no,
            description,
            status,
            created_at
          )
          VALUES (
            ${programId},
            ${versionNo},
            ${description},
            ${normalizedStatus},
            NOW()
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // 5. COURSES
    // --------------------------------------------------

    else if (entity === "course") {
      const programVersionIdText = String(
        body.programVersionId ?? "",
      );

      const levelIdText = String(
        body.levelId ?? "",
      ).trim();

      const code = text(body.code);
      const name = text(body.name);
      const description = optionalText(body.description);

      if (
        !validId(programVersionIdText) ||
        !code ||
        !name ||
        !validText(body.code, 50, true) ||
        !validText(body.name, 150, true) ||
        !validText(body.description, 10000) ||
        (levelIdText !== "" && !validId(levelIdText))
      ) {
        return NextResponse.json(
          {
            error: "Thông tin khóa học không hợp lệ.",
          },
          { status: 400 },
        );
      }

      const programVersionId = BigInt(
        programVersionIdText,
      );

      const programVersion =
        await prisma.$queryRaw<IdRow[]>`
          SELECT id
          FROM program_versions
          WHERE id = ${programVersionId}
          LIMIT 1
        `;

      if (programVersion.length === 0) {
        return NextResponse.json(
          {
            error:
              "Phiên bản chương trình không tồn tại.",
          },
          { status: 400 },
        );
      }

      let levelId: bigint | null = null;

      if (levelIdText !== "") {
        levelId = BigInt(levelIdText);

        const level = await prisma.$queryRaw<IdRow[]>`
          SELECT id
          FROM levels
          WHERE id = ${levelId}
          LIMIT 1
        `;

        if (level.length === 0) {
          return NextResponse.json(
            {
              error: "Trình độ không tồn tại.",
            },
            { status: 400 },
          );
        }
      }

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO courses (
            program_version_id,
            level_id,
            code,
            name,
            description
          )
          VALUES (
            ${programVersionId},
            ${levelId},
            ${code},
            ${name},
            ${description}
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // 6. COURSE VERSIONS
    // --------------------------------------------------

    else if (entity === "courseVersion") {
      const courseIdText = String(
        body.courseId ?? "",
      );

      const versionNo = text(body.versionNo);
      const description = optionalText(
        body.description,
      );

      const feeText = String(
        body.tuitionFee ?? "",
      ).trim();

      const normalizedStatus = normalizeStatus(
        body.status,
      );

      if (
        !validId(courseIdText) ||
        !versionNo ||
        !validText(body.versionNo, 30, true) ||
        !validText(body.description, 10000) ||
        !normalizedStatus ||
        (
          feeText !== "" &&
          !/^\d{1,13}(\.\d{1,2})?$/.test(feeText)
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Thông tin phiên bản khóa học hoặc học phí không hợp lệ.",
          },
          { status: 400 },
        );
      }

      const courseId = BigInt(courseIdText);

      const course = await prisma.$queryRaw<IdRow[]>`
        SELECT id
        FROM courses
        WHERE id = ${courseId}
        LIMIT 1
      `;

      if (course.length === 0) {
        return NextResponse.json(
          {
            error: "Khóa học không tồn tại.",
          },
          { status: 400 },
        );
      }

      const tuitionFee =
        feeText !== "" ? feeText : null;

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO course_versions (
            course_id,
            version_no,
            description,
            tuition_fee,
            status,
            created_at
          )
          VALUES (
            ${courseId},
            ${versionNo},
            ${description},
            ${tuitionFee},
            ${normalizedStatus},
            NOW()
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // 7. COURSE OFFERINGS
    // --------------------------------------------------

    else if (entity === "offering") {
      const branchIdText = String(
        body.branchId ?? "",
      );

      const courseVersionIdText = String(
        body.courseVersionId ?? "",
      );

      const code = text(body.code);

      const startDate = body.startDate;
      const endDate = body.endDate;

      const maxStudentsText = String(
        body.maxStudents ?? "",
      ).trim();

      const normalizedStatus = normalizeStatus(
        body.status,
      );

      if (
        !validId(branchIdText) ||
        !validId(courseVersionIdText) ||
        !code ||
        !validText(body.code, 50, true) ||
        !validDate(startDate) ||
        !validDate(endDate) ||
        startDate > endDate ||
        !normalizedStatus ||
        (
          maxStudentsText !== "" &&
          (
            !/^\d+$/.test(maxStudentsText) ||
            Number(maxStudentsText) < 1 ||
            Number(maxStudentsText) > 2147483647
          )
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Thông tin đợt mở khóa học không hợp lệ.",
          },
          { status: 400 },
        );
      }

      const branchId = BigInt(branchIdText);

      const courseVersionId = BigInt(
        courseVersionIdText,
      );

      // Kiểm tra người dùng có quyền sử dụng chi nhánh.
      const permittedBranch =
        await prisma.$queryRaw<IdRow[]>`
          SELECT b.id
          FROM branches b
          INNER JOIN user_branch_scopes s
            ON s.branch_id = b.id
          WHERE b.id = ${branchId}
            AND b.status = 'ACTIVE'
            AND s.user_id = ${userId}
          LIMIT 1
        `;

      if (permittedBranch.length === 0) {
        return NextResponse.json(
          {
            error:
              "Bạn không có quyền sử dụng chi nhánh này.",
          },
          { status: 403 },
        );
      }

      const courseVersion =
        await prisma.$queryRaw<IdRow[]>`
          SELECT id
          FROM course_versions
          WHERE id = ${courseVersionId}
          LIMIT 1
        `;

      if (courseVersion.length === 0) {
        return NextResponse.json(
          {
            error:
              "Phiên bản khóa học không tồn tại.",
          },
          { status: 400 },
        );
      }

      const maxStudents =
        maxStudentsText !== ""
          ? Number(maxStudentsText)
          : null;

      newId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO course_offerings (
            branch_id,
            course_version_id,
            code,
            start_date,
            end_date,
            max_students,
            status
          )
          VALUES (
            ${branchId},
            ${courseVersionId},
            ${code},
            ${startDate},
            ${endDate},
            ${maxStudents},
            ${normalizedStatus}
          )
        `;

        const rows = await tx.$queryRaw<IdRow[]>`
          SELECT LAST_INSERT_ID() AS id
        `;

        return rows[0].id;
      });
    }

    // --------------------------------------------------
    // ENTITY KHÔNG ĐƯỢC HỖ TRỢ
    // --------------------------------------------------

    else {
      return NextResponse.json(
        {
          error: "Loại danh mục không được hỗ trợ.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      makeJsonSafe({
        success: true,
        message: "Tạo danh mục thành công.",
        id: newId.toString(),
      }),
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("CREATE CATALOG ERROR:", error);

    // Mã trùng hoặc vi phạm UNIQUE.
    if (
      /Duplicate entry|Unique constraint|UniqueConstraintViolation/i.test(
        message,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Mã đã tồn tại. Hãy sử dụng mã khác.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "Không thể tạo dữ liệu danh mục.",
      },
      { status: 500 },
    );
  }
}