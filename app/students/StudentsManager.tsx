"use client"

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react"

type Student = {
  id: string
  branchId: string
  branchCode: string
  branchName: string
  studentCode: string
  fullName: string
  phone: string | null
  email: string | null
  gender: string | null
  dob: string | null
  address: string | null
  status: string
  enrollmentCount: number
}

type Branch = {
  id: string
  code: string
  name: string
}

type LeadOption = {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  status: string
  branchCode: string
}

type StudentForm = {
  fullName: string
  phone: string
  email: string
  gender: string
  dob: string
  address: string
  branchId: string
  status: string
}

const initialForm: StudentForm = {
  fullName: "",
  phone: "",
  email: "",
  gender: "",
  dob: "",
  address: "",
  branchId: "",
  status: "ACTIVE",
}

const genderLabels: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
}

const leadStatusLabels: Record<string, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  QUALIFIED: "Tiềm năng phù hợp",
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"

const labelClass = "mb-1.5 block text-sm font-medium text-slate-700"

export default function StudentsManager({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean
  canUpdate: boolean
}) {
  const [students, setStudents] = useState<Student[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])

  const [form, setForm] = useState<StudentForm>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [convertLeadId, setConvertLeadId] = useState("")

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [notice, setNotice] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/students", {
        method: "GET",
        cache: "no-store",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách học viên.")
      }

      setStudents(data.students)
      setBranches(data.branches)
      setLeads(data.leads)

      setForm((current) => ({
        ...current,
        branchId: current.branchId || data.branches[0]?.id || "",
      }))
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

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
          .includes(keyword)

      const matchesStatus =
        filterStatus === "ALL" || student.status === filterStatus

      return matchesKeyword && matchesStatus
    })
  }, [students, search, filterStatus])

  const activeCount = students.filter(
    (student) => student.status === "ACTIVE",
  ).length
  const inactiveCount = students.filter(
    (student) => student.status !== "ACTIVE",
  ).length
  const totalEnrollments = students.reduce(
    (total, student) => total + student.enrollmentCount,
    0,
  )

  function updateForm<K extends keyof StudentForm>(
    field: K,
    value: StudentForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function callApi(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ) {
    setSaving(true)
    setNotice(null)

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? "Thao tác thất bại.")
      }

      setNotice({
        type: "success",
        text: data.message ?? "Thành công.",
      })

      await loadData()
      return true
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Đã xảy ra lỗi.",
      })

      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!convertLeadId) return

    const ok = await callApi("/api/students", "POST", {
      leadId: convertLeadId,
    })

    if (ok) {
      setConvertLeadId("")
    }
  }

  function startEditing(student: Student) {
    setEditingId(student.id)

    setForm({
      fullName: student.fullName,
      phone: student.phone ?? "",
      email: student.email ?? "",
      gender: student.gender ?? "",
      dob: student.dob ?? "",
      address: student.address ?? "",
      branchId: student.branchId,
      status: student.status,
    })

    setNotice(null)

    document.getElementById("student-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  function cancelEditing() {
    setEditingId(null)

    setForm({
      ...initialForm,
      branchId: branches[0]?.id ?? "",
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const isEditing = editingId !== null

    const ok = await callApi(
      isEditing
        ? `/api/students/${encodeURIComponent(editingId)}`
        : "/api/students",
      isEditing ? "PATCH" : "POST",
      form,
    )

    if (ok) {
      setEditingId(null)
      setForm({
        ...initialForm,
        branchId: form.branchId,
      })
    }
  }

  const showForm = editingId !== null ? canUpdate : canCreate

  return (
    <div className="space-y-6 pb-8">
      {/* Page heading */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
            <GraduationCap className="h-4 w-4" />
            QUẢN LÝ ĐÀO TẠO
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý học viên
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Quản lý hồ sơ, thông tin liên hệ và quá trình ghi danh của học viên.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setForm({
                  ...initialForm,
                  branchId: form.branchId || branches[0]?.id || "",
                })
                document.getElementById("student-form")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Thêm học viên
            </button>
          )}
        </div>
      </section>

      {/* Notice */}
      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p className="flex-1 leading-6">{notice.text}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo"
            className="rounded-lg p-1 transition hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Tổng học viên
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : students.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tất cả hồ sơ trong hệ thống</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Đang học</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : activeCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Học viên có trạng thái hoạt động</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Tạm dừng</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <UserRound className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : inactiveCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Hồ sơ không ở trạng thái đang học</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Lượt ghi danh</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <BookOpen className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : totalEnrollments}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tổng lượt ghi danh của học viên</p>
        </div>
      </section>

      {/* Convert lead */}
      {canCreate && leads.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-blue-100 bg-blue-50/70 p-5 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Chuyển khách hàng tiềm năng thành học viên
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Chọn khách hàng để tạo hồ sơ học viên từ thông tin đã có.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleConvert}
            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:p-6"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="convert-lead" className={labelClass}>
                Khách hàng tiềm năng
              </label>
              <select
                id="convert-lead"
                value={convertLeadId}
                onChange={(event) => setConvertLeadId(event.target.value)}
                required
                className={inputClass}
              >
                <option value="">-- Chọn khách hàng --</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.fullName}
                    {lead.phone ? ` - ${lead.phone}` : ""} ({lead.branchCode},{" "}
                    {leadStatusLabels[lead.status] ?? lead.status})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !convertLeadId}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {saving ? "Đang xử lý..." : "Chuyển thành học viên"}
            </button>
          </form>
        </section>
      )}

      {/* Student form */}
      {showForm && (
        <section
          id="student-form"
          className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {editingId ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editingId ? "Cập nhật hồ sơ học viên" : "Thêm học viên trực tiếp"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingId
                    ? "Cập nhật thông tin cần thiết cho hồ sơ này."
                    : "Nhập thông tin để tạo hồ sơ học viên mới."}
                </p>
              </div>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
                Hủy sửa
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label htmlFor="student-fullname" className={labelClass}>
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  id="student-fullname"
                  value={form.fullName}
                  onChange={(event) => updateForm("fullName", event.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Nhập họ tên học viên"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="student-phone" className={labelClass}>
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="student-phone"
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    autoComplete="tel"
                    placeholder="Nhập số điện thoại"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="student-email" className={labelClass}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="student-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="student-gender" className={labelClass}>
                  Giới tính
                </label>
                <select
                  id="student-gender"
                  value={form.gender}
                  onChange={(event) => updateForm("gender", event.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Không chọn --</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              <div>
                <label htmlFor="student-dob" className={labelClass}>
                  Ngày sinh
                </label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="student-dob"
                    type="date"
                    value={form.dob}
                    onChange={(event) => updateForm("dob", event.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="student-branch" className={labelClass}>
                  Chi nhánh <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="student-branch"
                    value={form.branchId}
                    onChange={(event) => updateForm("branchId", event.target.value)}
                    required
                    disabled={editingId !== null}
                    className={`${inputClass} pl-9`}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} - {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2 xl:col-span-3">
                <label htmlFor="student-address" className={labelClass}>
                  Địa chỉ
                </label>
                <input
                  id="student-address"
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                  autoComplete="street-address"
                  placeholder="Nhập địa chỉ (không bắt buộc)"
                  className={inputClass}
                />
              </div>

              {editingId && (
                <div>
                  <label htmlFor="student-status" className={labelClass}>
                    Trạng thái
                  </label>
                  <select
                    id="student-status"
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                    className={inputClass}
                  >
                    <option value="ACTIVE">Đang học</option>
                    <option value="INACTIVE">Tạm dừng</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Hủy
                </button>
              )}
              <button
                type="submit"
                disabled={saving || branches.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {saving
                  ? "Đang lưu..."
                  : editingId
                    ? "Lưu thay đổi"
                    : "Tạo hồ sơ học viên"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Student list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Danh sách học viên
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Hiển thị {filteredStudents.length} trên tổng số {students.length} hồ sơ.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:min-w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã, tên, SĐT, email..."
                  aria-label="Tìm kiếm học viên"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                aria-label="Lọc theo trạng thái"
                className={`${inputClass} sm:w-44`}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang học</option>
                <option value="INACTIVE">Tạm dừng</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-600">
              Đang tải danh sách học viên...
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              {students.length === 0
                ? "Chưa có học viên"
                : "Không tìm thấy kết quả"}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              {students.length === 0
                ? "Danh sách hiện chưa có hồ sơ học viên nào."
                : "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."}
            </p>
            {(search || filterStatus !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setFilterStatus("ALL")
                }}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4 font-semibold">Học viên</th>
                  <th className="px-5 py-4 font-semibold">Liên hệ</th>
                  <th className="px-5 py-4 font-semibold">Thông tin</th>
                  <th className="px-5 py-4 font-semibold">Chi nhánh</th>
                  <th className="px-5 py-4 text-center font-semibold">Ghi danh</th>
                  <th className="px-5 py-4 font-semibold">Trạng thái</th>
                  {canUpdate && (
                    <th className="px-5 py-4 text-right font-semibold">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                          {student.fullName
                            .trim()
                            .split(/\s+/)
                            .slice(-2)
                            .map((part) => part[0] ?? "")
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-52 truncate font-semibold text-slate-900">
                            {student.fullName}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {student.studentCode}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex min-w-44 flex-col gap-1.5">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {student.phone || "Chưa cập nhật"}
                        </span>
                        <span className="inline-flex max-w-56 items-center gap-2 truncate text-xs text-slate-500">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{student.email || "Chưa có email"}</span>
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      <p>{student.gender ? genderLabels[student.gender] ?? student.gender : "Chưa cập nhật"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {student.dob || "Chưa có ngày sinh"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        {student.branchCode}
                      </span>
                      <p className="mt-1.5 max-w-40 truncate text-xs text-slate-500">
                        {student.branchName}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-9 items-center justify-center rounded-lg bg-violet-50 px-2.5 py-1.5 font-semibold text-violet-700">
                        {student.enrollmentCount}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${
                          student.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            student.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {student.status === "ACTIVE" ? "Đang học" : "Tạm dừng"}
                      </span>
                    </td>

                    {canUpdate && (
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => startEditing(student)}
                          aria-label={`Sửa thông tin ${student.fullName}`}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredStudents.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Đang hiển thị {filteredStudents.length} học viên sau khi lọc.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Sử dụng tìm kiếm và bộ lọc để thu hẹp danh sách
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        )}
      </section>
    </div>
  )
}
