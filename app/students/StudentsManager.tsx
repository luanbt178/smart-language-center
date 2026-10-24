"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

type Student = {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  studentCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  status: string;
  enrollmentCount: number;
};

type Branch = {
  id: string;
  code: string;
  name: string;
};

type LeadOption = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  branchCode: string;
};

type StudentForm = {
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  dob: string;
  address: string;
  branchId: string;
  status: string;
};

const initialForm: StudentForm = {
  fullName: "",
  phone: "",
  email: "",
  gender: "",
  dob: "",
  address: "",
  branchId: "",
  status: "ACTIVE",
};

const genderLabels: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

const leadStatusLabels: Record<string, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  QUALIFIED: "Tiềm năng phù hợp",
};

const inputClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

export default function StudentsManager({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);

  const [form, setForm] = useState<StudentForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertLeadId, setConvertLeadId] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/students", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Không thể tải danh sách học viên.",
        );
      }

      setStudents(data.students);
      setBranches(data.branches);
      setLeads(data.leads);

      setForm((current) => ({
        ...current,
        branchId: current.branchId || data.branches[0]?.id || "",
      }));
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesKeyword =
        keyword.length === 0 ||
        [
          student.studentCode,
          student.fullName,
          student.phone ?? "",
          student.email ?? "",
          student.branchName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        filterStatus === "ALL" || student.status === filterStatus;

      return matchesKeyword && matchesStatus;
    });
  }, [students, search, filterStatus]);

  function updateForm<K extends keyof StudentForm>(
    field: K,
    value: StudentForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function callApi(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ) {
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Thao tác thất bại.");
      }

      setNotice({
        type: "success",
        text: data.message ?? "Thành công.",
      });

      await loadData();
      return true;
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Đã xảy ra lỗi.",
      });

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ok = await callApi("/api/students", "POST", {
      leadId: convertLeadId,
    });

    if (ok) {
      setConvertLeadId("");
    }
  }

  function startEditing(student: Student) {
    setEditingId(student.id);

    setForm({
      fullName: student.fullName,
      phone: student.phone ?? "",
      email: student.email ?? "",
      gender: student.gender ?? "",
      dob: student.dob ?? "",
      address: student.address ?? "",
      branchId: student.branchId,
      status: student.status,
    });

    setNotice(null);

    document.getElementById("student-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function cancelEditing() {
    setEditingId(null);

    setForm({
      ...initialForm,
      branchId: branches[0]?.id ?? "",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isEditing = editingId !== null;

    const ok = await callApi(
      isEditing
        ? `/api/students/${encodeURIComponent(editingId)}`
        : "/api/students",
      isEditing ? "PATCH" : "POST",
      form,
    );

    if (ok) {
      setEditingId(null);

      setForm({
        ...initialForm,
        branchId: form.branchId,
      });
    }
  }

  const showForm = editingId !== null ? canUpdate : canCreate;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Quản lý học viên</h1>

            <p className="mt-1 text-sm text-slate-600">
              Hồ sơ học viên, chuyển đổi từ khách hàng tiềm năng
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {notice && (
          <div
            className={`rounded-md border p-3 text-sm ${
              notice.type === "success"
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            {notice.text}
          </div>
        )}

        {canCreate && leads.length > 0 && (
          <section className="rounded-lg border border-blue-300 bg-blue-50 p-5">
            <h2 className="mb-1 text-lg font-semibold">
              Chuyển khách hàng thành học viên
            </h2>

            <p className="mb-4 text-sm text-slate-700">
              Lấy họ tên, số điện thoại, email từ khách hàng. Khách hàng
              sẽ chuyển sang &quot;Đã chuyển đổi&quot;.
            </p>

            <form
              onSubmit={handleConvert}
              className="flex flex-wrap items-end gap-4"
            >
              <div className="min-w-72 flex-1">
                <label className="mb-1 block text-sm font-medium">
                  Khách hàng
                </label>

                <select
                  value={convertLeadId}
                  onChange={(e) => setConvertLeadId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">-- Chọn khách hàng --</option>

                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName}
                      {lead.phone ? ` - ${lead.phone}` : ""} (
                      {lead.branchCode},{" "}
                      {leadStatusLabels[lead.status] ?? lead.status})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? "Đang xử lý..." : "Chuyển thành học viên"}
              </button>
            </form>
          </section>
        )}

        {showForm && (
          <section
            id="student-form"
            className="rounded-lg border border-slate-300 bg-white p-5"
          >
            <h2 className="mb-4 text-lg font-semibold">
              {editingId ? "Sửa thông tin học viên" : "Thêm học viên trực tiếp"}
            </h2>

            <form
              onSubmit={handleSubmit}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Họ tên *
                </label>
                <input
                  value={form.fullName}
                  onChange={(e) => updateForm("fullName", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Số điện thoại
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Email
                </label>
                <input
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Giới tính
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => updateForm("gender", e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Không chọn --</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => updateForm("dob", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Địa chỉ
                </label>
                <input
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Chi nhánh *
                </label>
                <select
                  value={form.branchId}
                  onChange={(e) => updateForm("branchId", e.target.value)}
                  required
                  disabled={editingId !== null}
                  className={`${inputClass} disabled:bg-slate-100`}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {editingId && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Trạng thái
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                    className={inputClass}
                  >
                    <option value="ACTIVE">Đang học</option>
                    <option value="INACTIVE">Tạm dừng</option>
                  </select>
                </div>
              )}

              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving
                    ? "Đang lưu..."
                    : editingId
                      ? "Cập nhật"
                      : "Thêm học viên"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Danh sách học viên ({filteredStudents.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo mã, tên, SĐT, email..."
                className="w-64 rounded-md border border-slate-400 bg-white px-3 py-2"
              />

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-md border border-slate-400 bg-white px-3 py-2"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang học</option>
                <option value="INACTIVE">Tạm dừng</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-600">Đang tải...</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-slate-600">Chưa có học viên nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50">
                    <th className="p-3">Mã</th>
                    <th className="p-3">Họ tên</th>
                    <th className="p-3">Liên hệ</th>
                    <th className="p-3">Giới tính / Ngày sinh</th>
                    <th className="p-3">Chi nhánh</th>
                    <th className="p-3">Số lần ghi danh</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-slate-200"
                    >
                      <td className="p-3 font-mono">
                        {student.studentCode}
                      </td>

                      <td className="p-3 font-medium">
                        {student.fullName}
                      </td>

                      <td className="p-3">
                        <div>{student.phone ?? "—"}</div>
                        <div className="text-xs text-slate-600">
                          {student.email ?? ""}
                        </div>
                      </td>

                      <td className="p-3">
                        {student.gender
                          ? (genderLabels[student.gender] ?? student.gender)
                          : "—"}
                        {" / "}
                        {student.dob ?? "—"}
                      </td>

                      <td className="p-3">{student.branchCode}</td>
                      <td className="p-3">{student.enrollmentCount}</td>

                      <td className="p-3">
                        <span
                          className={`rounded border px-2 py-1 text-xs font-medium ${
                            student.status === "ACTIVE"
                              ? "border-green-300 bg-green-50 text-green-800"
                              : "border-slate-300 bg-slate-100 text-slate-800"
                          }`}
                        >
                          {student.status === "ACTIVE"
                            ? "Đang học"
                            : "Tạm dừng"}
                        </span>
                      </td>

                      <td className="p-3">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => startEditing(student)}
                            className="rounded-md border border-blue-600 px-3 py-1 text-blue-800 hover:bg-blue-50"
                          >
                            Sửa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}