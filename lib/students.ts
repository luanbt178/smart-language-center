export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\-\s]{6,30}$/;

// null = để trống, undefined = sai (không phải chuỗi hoặc quá dài)
export function readText(
  value: unknown,
  max: number,
): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;

  const text = value.trim();

  if (text === "") return null;

  return text.length > max ? undefined : text;
}

export function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export type StudentInput = {
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
};

type ParseResult =
  | { ok: true; data: StudentInput }
  | { ok: false; error: string };

export function parseStudentInput(
  body: Record<string, unknown>,
): ParseResult {
  const fullName = readText(body.fullName, 150);

  if (!fullName) {
    return {
      ok: false,
      error: "Vui lòng nhập họ tên (tối đa 150 ký tự).",
    };
  }

  const phone = readText(body.phone, 30);

  if (phone === undefined || (phone !== null && !PHONE_PATTERN.test(phone))) {
    return { ok: false, error: "Số điện thoại không hợp lệ." };
  }

  const email = readText(body.email, 150);

  if (email === undefined || (email !== null && !EMAIL_PATTERN.test(email))) {
    return { ok: false, error: "Email không đúng định dạng." };
  }

  const gender = readText(body.gender, 20);

  if (
    gender === undefined ||
    (gender !== null && !(GENDERS as readonly string[]).includes(gender))
  ) {
    return { ok: false, error: "Giới tính không hợp lệ." };
  }

  const dob = readText(body.dob, 10);
  const today = new Date().toISOString().slice(0, 10);

  if (
    dob === undefined ||
    (dob !== null &&
      (!validDateOnly(dob) || dob < "1900-01-01" || dob > today))
  ) {
    return { ok: false, error: "Ngày sinh không hợp lệ." };
  }

  const address = readText(body.address, 255);

  if (address === undefined) {
    return { ok: false, error: "Địa chỉ không hợp lệ (tối đa 255 ký tự)." };
  }

  return {
    ok: true,
    data: { fullName, phone, email, gender, dob, address },
  };
}

// Mã học viên sinh từ id: HV000001, HV000002, ...
export function makeStudentCode(id: bigint): string {
  return `HV${id.toString().padStart(6, "0")}`;
}