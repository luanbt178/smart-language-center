"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Notice } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert, Clock, Users, RefreshCw } from "lucide-react";

type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "CONVERTED"
  | "LOST";

type Lead = {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: LeadStatus;
  assignedUserId: string | null;
  assignedUsername: string | null;
  assignedFullName: string | null;
  createdAt: string;
};

type Branch = {
  id: string;
  code: string;
  name: string;
};

type SalesUser = {
  id: string;
  username: string;
  fullName: string;
  branchIds: string[];
};

type LeadForm = {
  fullName: string;
  phone: string;
  email: string;
  source: string;
  branchId: string;
  assignedUserId: string;
  status: LeadStatus;
};

const initialForm: LeadForm = {
  fullName: "",
  phone: "",
  email: "",
  source: "",
  branchId: "",
  assignedUserId: "",
  status: "NEW",
};

const statusOptions: {
  value: LeadStatus;
  label: string;
}[] = [
  { value: "NEW", label: "Mới" },
  { value: "CONTACTED", label: "Đã liên hệ" },
  { value: "QUALIFIED", label: "Tiềm năng phù hợp" },
  { value: "CONVERTED", label: "Đã chuyển đổi" },
  { value: "LOST", label: "Không tiếp tục" },
];

function statusLabel(status: string) {
  return (
    statusOptions.find((item) => item.value === status)
      ?.label ?? status
  );
}

export default function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);

  const [form, setForm] = useState<LeadForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      const response = await fetch("/api/sales/leads", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Không thể tải danh sách Lead.",
        );
      }

      setLeads(data.leads);
      setBranches(data.branches);
      setSalesUsers(data.salesUsers);

      setForm((current) => ({
        ...current,
        branchId:
          current.branchId ||
          data.branches[0]?.id ||
          "",
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

  const filteredLeads = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesKeyword =
        keyword.length === 0 ||
        [
          lead.fullName,
          lead.phone ?? "",
          lead.email ?? "",
          lead.source ?? "",
          lead.branchName,
          lead.assignedFullName ?? "",
          lead.assignedUsername ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        filterStatus === "ALL" ||
        lead.status === filterStatus;

      return matchesKeyword && matchesStatus;
    });
  }, [leads, search, filterStatus]);

  const availableAssignees = useMemo(() => {
    return salesUsers.filter((user) =>
      user.branchIds.includes(form.branchId),
    );
  }, [salesUsers, form.branchId]);

  function updateForm<K extends keyof LeadForm>(
    field: K,
    value: LeadForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditing(lead: Lead) {
    setEditingId(lead.id);

    setForm({
      fullName: lead.fullName,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      source: lead.source ?? "",
      branchId: lead.branchId,
      assignedUserId: lead.assignedUserId ?? "",
      status: lead.status,
    });

    setNotice(null);

    document.getElementById("lead-form")?.scrollIntoView({
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

    setNotice(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const isEditing = editingId !== null;

      const url = isEditing
        ? `/api/sales/leads/${encodeURIComponent(editingId)}`
        : "/api/sales/leads";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            (isEditing
              ? "Không thể cập nhật Lead."
              : "Không thể tạo Lead."),
        );
      }

      setNotice({
        type: "success",
        text:
          data.message ??
          (isEditing
            ? "Cập nhật Lead thành công."
            : "Tạo Lead thành công."),
      });

      setEditingId(null);

      setForm({
        ...initialForm,
        branchId: form.branchId,
      });

      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Đã xảy ra lỗi.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Quản lý khách hàng tiềm năng"
          description="Theo dõi khách hàng tiềm năng từ lúc tiếp nhận đến khi chuyển đổi."
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw />
              Làm mới
            </Button>
          }
        />

        <Notice notice={notice} onClose={() => setNotice(null)} />

        {!loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tổng số lead" value={leads.length} icon={Users} tone="blue" />
            <StatCard label="Đang chăm sóc" value={leads.filter((lead) => ["NEW", "CONTACTED", "QUALIFIED"].includes(lead.status)).length} icon={Clock} tone="amber" />
            <StatCard label="Đã chuyển đổi" value={leads.filter((lead) => lead.status === "CONVERTED").length} icon={CheckCircle2} tone="green" />
            <StatCard label="Không tiếp tục" value={leads.filter((lead) => lead.status === "LOST").length} icon={CircleAlert} tone="slate" />
          </div>
        )}

        <section
          id="lead-form"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Cập nhật Lead" : "Thêm Lead mới"}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Họ và tên *
              </label>

              <input
                value={form.fullName}
                onChange={(event) =>
                  updateForm("fullName", event.target.value)
                }
                maxLength={150}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Số điện thoại
              </label>

              <input
                value={form.phone}
                onChange={(event) =>
                  updateForm("phone", event.target.value)
                }
                maxLength={30}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                placeholder="0901234567"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Email
              </label>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateForm("email", event.target.value)
                }
                maxLength={150}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                placeholder="student@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Nguồn khách hàng
              </label>

              <select
                value={form.source}
                onChange={(event) =>
                  updateForm("source", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              >
                <option value="">Chưa xác định</option>
                <option value="WEBSITE">Website</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="ZALO">Zalo</option>
                <option value="HOTLINE">Hotline</option>
                <option value="REFERRAL">Giới thiệu</option>
                <option value="WALK_IN">Đến trực tiếp</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Chi nhánh *
              </label>

              <select
                value={form.branchId}
                disabled={editingId !== null}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    branchId: event.target.value,
                    assignedUserId: "",
                  }));
                }}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:bg-slate-100"
              >
                <option value="">
                  -- Chọn chi nhánh --
                </option>

                {branches.map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Nhân viên tư vấn
              </label>

              <select
                value={form.assignedUserId}
                onChange={(event) =>
                  updateForm(
                    "assignedUserId",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              >
                <option value="">Chưa phân công</option>

                {availableAssignees.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.fullName} ({user.username})
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
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value as LeadStatus,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                >
                  {statusOptions.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                    >
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  branches.length === 0
                }
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Đang lưu..."
                  : editingId
                    ? "Lưu thay đổi"
                    : "Tạo Lead"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          {branches.length === 0 && !loading && (
            <p className="mt-4 text-sm text-red-700">
              Tài khoản chưa có chi nhánh đang hoạt động trong phạm vi được cấp.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              Danh sách Lead
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Số kết quả: {filteredLeads.length}
            </p>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Tìm kiếm
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Họ tên, điện thoại, email, nguồn..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Lọc theo trạng thái
              </label>

              <select
                value={filterStatus}
                onChange={(event) =>
                  setFilterStatus(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              >
                <option value="ALL">Tất cả trạng thái</option>

                {statusOptions.map((status) => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-slate-600">
              Đang tải dữ liệu...
            </p>
          ) : filteredLeads.length === 0 ? (
            <p className="py-8 text-center text-slate-600">
              Chưa có Lead phù hợp. Bạn có thể tạo Lead ở biểu mẫu phía trên.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100">
                    <th className="p-3">Họ tên</th>
                    <th className="p-3">Liên hệ</th>
                    <th className="p-3">Nguồn</th>
                    <th className="p-3">Chi nhánh</th>
                    <th className="p-3">Nhân viên</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Ngày tạo</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="p-3 font-medium">
                        {lead.fullName}
                      </td>

                      <td className="p-3">
                        <div>{lead.phone || "—"}</div>
                        <div className="text-xs text-slate-600">
                          {lead.email || ""}
                        </div>
                      </td>

                      <td className="p-3">
                        {lead.source || "—"}
                      </td>

                      <td className="p-3">
                        {lead.branchName}
                      </td>

                      <td className="p-3">
                        {lead.assignedFullName
                          ? `${lead.assignedFullName} (${lead.assignedUsername})`
                          : "Chưa phân công"}
                      </td>

                      <td className="p-3">
                        <StatusBadge status={lead.status} label={statusLabel(lead.status)} />
                      </td>

                      <td className="whitespace-nowrap p-3 text-slate-600">
                        {new Date(lead.createdAt).toLocaleString(
                          "vi-VN",
                        )}
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => startEditing(lead)}
                          className="rounded-md border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-800 hover:bg-blue-50"
                        >
                          Sửa
                        </button>
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