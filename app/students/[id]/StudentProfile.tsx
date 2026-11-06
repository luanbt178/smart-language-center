"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { Panel } from "@/components/shared/Panel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { FormField, inputClass } from "@/components/shared/FormField";
import { LoadingState } from "@/components/shared/states";

type Student = {
  id: string;
  studentCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  branchName: string;
};

type Guardian = {
  linkId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  relationship: string | null;
  isPrimary: boolean;
};

type Enrollment = {
  id: string;
  status: string;
  price: string;
  createdAt: string;
  courseName: string;
  versionNo: string;
  offeringCode: string;
  classCode: string | null;
  className: string | null;
};

type Profile = {
  student: Student;
  guardians: Guardian[];
  enrollments: Enrollment[];
};

const emptyGuardian = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  relationship: "",
  isPrimary: false,
};

function genderLabel(value: string | null) {
  if (value === "MALE") return "Nam";
  if (value === "FEMALE") return "Nữ";
  if (value === "OTHER") return "Khác";
  return value || "—";
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default function StudentProfile({
  studentId,
  canUpdate,
}: {
  studentId: string;
  canUpdate: boolean;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [form, setForm] = useState(emptyGuardian);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
  try {
    const response = await fetch(`/api/students/${studentId}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không thể tải hồ sơ học viên.");
    }

    setProfile(result);
  } catch (error) {
    setProfile(null);
    setNotice({
      type: "error",
      text:
        error instanceof Error
          ? error.message
          : "Không thể tải hồ sơ học viên.",
    });
  } finally {
    setLoading(false);
  }
}, [studentId]);

  useEffect(() => {
  let cancelled = false;

  async function fetchProfile() {
    try {
      const response = await fetch(`/api/students/${studentId}`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể tải hồ sơ học viên.");
      }

      if (!cancelled) {
        setProfile(result);
      }
    } catch (error) {
      if (!cancelled) {
        setProfile(null);
        setNotice({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Không thể tải hồ sơ học viên.",
        });
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchProfile();

  return () => {
    cancelled = true;
  };
}, [studentId]);

  async function addGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/students/${studentId}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể thêm phụ huynh.");
      }

      setForm(emptyGuardian);
      setNotice({ type: "success", text: result.message || "Đã thêm phụ huynh." });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể thêm phụ huynh.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeGuardian(guardian: Guardian) {
    if (!window.confirm(`Gỡ phụ huynh "${guardian.fullName}" khỏi học viên này?`)) {
      return;
    }

    setNotice(null);

    try {
      const response = await fetch(
        `/api/students/${studentId}/guardians?linkId=${guardian.linkId}`,
        { method: "DELETE" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể gỡ phụ huynh.");
      }

      setNotice({ type: "success", text: result.message || "Đã gỡ phụ huynh." });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể gỡ phụ huynh.",
      });
    }
  }

  const student = profile?.student;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title={student ? student.fullName : "Hồ sơ học viên"}
        description={
          student ? `Mã học viên: ${student.studentCode} · ${student.branchName}` : undefined
        }
        actions={
          <>
            <Link
              href="/students"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" />
              Danh sách học viên
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Làm mới
            </Button>
          </>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {loading && !profile && <LoadingState text="Đang tải hồ sơ..." />}

      {profile && student && (
        <>
          <Panel
            title="Thông tin cá nhân"
            actions={<StatusBadge status={student.status} />}
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Họ và tên" value={student.fullName} />
              <Info label="Giới tính" value={genderLabel(student.gender)} />
              <Info label="Ngày sinh" value={student.dob} />
              <Info label="Số điện thoại" value={student.phone} />
              <Info label="Email" value={student.email} />
              <Info label="Ngày tạo hồ sơ" value={student.createdAt} />
              <div className="sm:col-span-2 lg:col-span-3">
                <Info label="Địa chỉ" value={student.address} />
              </div>
            </dl>
          </Panel>

          <Panel
            title={`Phụ huynh (${profile.guardians.length})`}
            description="Phụ huynh có tài khoản cổng thông tin sẽ xem được học phí và kết quả của học viên."
          >
            {profile.guardians.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có thông tin phụ huynh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="p-3">Họ tên</th>
                      <th className="p-3">Quan hệ</th>
                      <th className="p-3">Điện thoại</th>
                      <th className="p-3">Email</th>
                      {canUpdate && <th className="p-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.guardians.map((g) => (
                      <tr key={g.linkId} className="border-b border-slate-100">
                        <td className="p-3 font-medium text-slate-900">
                          {g.fullName}
                          {g.isPrimary && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Liên hệ chính
                            </span>
                          )}
                        </td>
                        <td className="p-3">{g.relationship || "—"}</td>
                        <td className="p-3">{g.phone || "—"}</td>
                        <td className="p-3">{g.email || "—"}</td>
                        {canUpdate && (
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => void removeGuardian(g)}
                              aria-label={`Gỡ phụ huynh ${g.fullName}`}
                              className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"
                            >
                              <Trash2 className="size-4" />
                              Gỡ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canUpdate && (
              <form
                onSubmit={addGuardian}
                className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2"
              >
                <FormField label="Họ tên phụ huynh" htmlFor="g-name" required>
                  <input
                    id="g-name"
                    required
                    maxLength={150}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Quan hệ" htmlFor="g-rel" hint="Ví dụ: Cha, Mẹ, Người giám hộ">
                  <input
                    id="g-rel"
                    maxLength={50}
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Số điện thoại" htmlFor="g-phone">
                  <input
                    id="g-phone"
                    maxLength={30}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Email" htmlFor="g-email">
                  <input
                    id="g-email"
                    type="email"
                    maxLength={150}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Địa chỉ" htmlFor="g-addr" className="sm:col-span-2">
                  <input
                    id="g-addr"
                    maxLength={255}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                  />
                  Đặt làm liên hệ chính
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={saving}>
                    <Plus />
                    {saving ? "Đang lưu..." : "Thêm phụ huynh"}
                  </Button>
                </div>
              </form>
            )}
          </Panel>

          <Panel title={`Khóa học đã ghi danh (${profile.enrollments.length})`}>
            {profile.enrollments.length === 0 ? (
              <p className="text-sm text-slate-500">Học viên chưa ghi danh khóa học nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="p-3">Khóa học</th>
                      <th className="p-3">Đợt mở</th>
                      <th className="p-3">Lớp</th>
                      <th className="p-3">Học phí</th>
                      <th className="p-3">Ngày ghi danh</th>
                      <th className="p-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.enrollments.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100">
                        <td className="p-3 font-medium text-slate-900">
                          {e.courseName} ({e.versionNo})
                        </td>
                        <td className="p-3">{e.offeringCode}</td>
                        <td className="p-3">
                          {e.classCode ? `${e.classCode} - ${e.className}` : "Chưa xếp lớp"}
                        </td>
                        <td className="p-3">
                          {Number(e.price).toLocaleString("vi-VN")} đ
                        </td>
                        <td className="p-3">{e.createdAt}</td>
                        <td className="p-3">
                          <StatusBadge status={e.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}