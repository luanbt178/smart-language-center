"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField, inputClass } from "@/components/shared/FormField";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { TableCard } from "@/components/shared/Panel";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { callApi } from "@/lib/client-api";

type UserItem = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  roles: string[];
  branches: string[];
  createdAt: string;
};

type RoleItem = { code: string; name: string };

type BranchItem = { id: string; code: string; name: string; status: string };

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; user: UserItem }
  | { kind: "password"; user: UserItem }
  | { kind: "status"; user: UserItem }
  | null;

/* ------------------------------ Tạo tài khoản ------------------------------ */

function CreateUserForm({
  roles,
  branches,
  onCancel,
  onDone,
}: {
  roles: RoleItem[];
  branches: BranchItem[];
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    roleCode: "",
    branchId: branches.length === 1 ? branches[0].id : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await callApi("/api/admin/users", "POST", form);

    setSaving(false);

    if (result.ok) {
      onDone(result.message);
    } else {
      setError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && <Notice notice={{ type: "error", text: error }} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Tên đăng nhập" htmlFor="new-username" required>
          <input
            id="new-username"
            className={inputClass}
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            minLength={3}
            maxLength={100}
            required
            autoComplete="off"
          />
        </FormField>

        <FormField label="Họ và tên" htmlFor="new-fullname" required>
          <input
            id="new-fullname"
            className={inputClass}
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            maxLength={150}
            required
          />
        </FormField>

        <FormField label="Email" htmlFor="new-email">
          <input
            id="new-email"
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            maxLength={150}
          />
        </FormField>

        <FormField label="Số điện thoại" htmlFor="new-phone">
          <input
            id="new-phone"
            className={inputClass}
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            maxLength={30}
          />
        </FormField>

        <FormField
          label="Mật khẩu"
          htmlFor="new-password"
          required
          hint="Tối thiểu 8 ký tự."
        >
          <input
            id="new-password"
            type="password"
            className={inputClass}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </FormField>

        <FormField label="Vai trò" htmlFor="new-role" required>
          <select
            id="new-role"
            className={inputClass}
            value={form.roleCode}
            onChange={(e) => update("roleCode", e.target.value)}
            required
          >
            <option value="">-- Chọn vai trò --</option>
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name} ({role.code})
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Chi nhánh"
          htmlFor="new-branch"
          required
          className="sm:col-span-2"
        >
          <select
            id="new-branch"
            className={inputClass}
            value={form.branchId}
            onChange={(e) => update("branchId", e.target.value)}
            required
          >
            <option value="">-- Chọn chi nhánh --</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {branches.length === 0 && (
        <p className="text-sm text-red-700">
          Chưa có chi nhánh đang hoạt động. Hãy kiểm tra dữ liệu bảng branches.
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={saving || roles.length === 0 || branches.length === 0}
        >
          {saving ? "Đang tạo..." : "Tạo tài khoản"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ------------------------------ Sửa thông tin ------------------------------ */

function EditUserForm({
  user,
  onCancel,
  onDone,
}: {
  user: UserItem;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await callApi(
      `/api/admin/users/${encodeURIComponent(user.id)}/profile`,
      "PATCH",
      { fullName, email, phone },
    );

    setSaving(false);

    if (result.ok) {
      onDone(result.message);
    } else {
      setError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && <Notice notice={{ type: "error", text: error }} />}

      <FormField label="Họ và tên" htmlFor="edit-fullname" required>
        <input
          id="edit-fullname"
          className={inputClass}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={150}
          required
        />
      </FormField>

      <FormField
        label="Email"
        htmlFor="edit-email"
        hint="Email dùng để liên kết tài khoản học viên/phụ huynh với hồ sơ. Đổi email có thể làm mất liên kết đó."
      >
        <input
          id="edit-email"
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={150}
        />
      </FormField>

      <FormField label="Số điện thoại" htmlFor="edit-phone">
        <input
          id="edit-phone"
          className={inputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ----------------------------- Đặt lại mật khẩu ----------------------------- */

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  const values = crypto.getRandomValues(new Uint32Array(12));

  return Array.from(
    values,
    (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length],
  ).join("");
}

function ResetPasswordForm({
  user,
  onCancel,
  onDone,
}: {
  user: UserItem;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await callApi(
      `/api/admin/users/${encodeURIComponent(user.id)}/password`,
      "POST",
      { newPassword },
    );

    setSaving(false);

    if (result.ok) {
      onDone(result.message);
    } else {
      setError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && <Notice notice={{ type: "error", text: error }} />}

      <FormField
        label="Mật khẩu mới"
        htmlFor="reset-password"
        required
        hint="Mật khẩu hiển thị để bạn gửi cho người dùng. Ít nhất 8 ký tự."
      >
        <div className="flex gap-2">
          <input
            id="reset-password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
            onClick={() => setNewPassword(generatePassword())}
          >
            Tạo ngẫu nhiên
          </Button>
        </div>
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Đặt mật khẩu"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* --------------------------------- Trang chính --------------------------------- */

export default function UsersManager({
  currentUsername,
}: {
  currentUsername: string;
}) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tải tài khoản.");
      }

      setUsers(data.users);
      setRoles(data.roles);
      setBranches(data.branches);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Đã xảy ra lỗi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const roleNames = useMemo(
    () => new Map(roles.map((role) => [role.code, role.name])),
    [roles],
  );

  const stats = useMemo(() => {
    const active = users.filter((user) => user.status === "ACTIVE").length;

    return {
      total: users.length,
      active,
      inactive: users.length - active,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      if (statusFilter !== "ALL" && user.status !== statusFilter) {
        return false;
      }

      if (roleFilter !== "ALL" && !user.roles.includes(roleFilter)) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        user.username,
        user.fullName,
        user.email ?? "",
        user.phone ?? "",
        user.roles.join(" "),
        user.branches.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [users, search, statusFilter, roleFilter]);

  function handleDone(message: string) {
    setDialog(null);
    setNotice({ type: "success", text: message });
    void loadData();
  }

  async function confirmStatusChange() {
    if (dialog?.kind !== "status") {
      return;
    }

    const user = dialog.user;
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setStatusSaving(true);

    const result = await callApi(
      `/api/admin/users/${encodeURIComponent(user.id)}`,
      "PATCH",
      { status: nextStatus },
    );

    setStatusSaving(false);
    setDialog(null);
    setNotice({ type: result.ok ? "success" : "error", text: result.message });

    if (result.ok) {
      void loadData();
    }
  }

  const statusTarget = dialog?.kind === "status" ? dialog.user : null;
  const locking = statusTarget?.status === "ACTIVE";

  return (
    <div className="text-slate-900">
      <PageHeader
        title="Quản lý tài khoản"
        description="Tạo tài khoản, sửa thông tin, đặt lại mật khẩu và khóa hoặc kích hoạt."
        actions={
          <Button
            type="button"
            onClick={() => setDialog({ kind: "create" })}
            disabled={loading}
          >
            <Plus />
            Tạo tài khoản
          </Button>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng số tài khoản"
          value={stats.total}
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Đang hoạt động"
          value={stats.active}
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Đã khóa"
          value={stats.inactive}
          icon={Lock}
          tone="slate"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên đăng nhập, họ tên, email, vai trò..."
            aria-label="Tìm kiếm tài khoản"
            className={`${inputClass} pl-9`}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Lọc theo trạng thái"
          className={`${inputClass} sm:w-44`}
        >
          <option value="ALL">Mọi trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Đã khóa</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Lọc theo vai trò"
          className={`${inputClass} sm:w-48`}
        >
          <option value="ALL">Mọi vai trò</option>
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw />
          Làm mới
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void loadData()} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài khoản"
          description="Hãy thử đổi từ khóa hoặc bộ lọc."
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Tài khoản</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">Chi nhánh</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                <th className="px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isCurrentUser = user.username === currentUsername;
                const isActive = user.status === "ACTIVE";

                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {user.fullName}
                        {isCurrentUser && (
                          <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                            Bạn
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{user.username}</p>
                      <p className="text-xs text-slate-500">
                        {user.email || "Chưa có email"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((code) => (
                          <span
                            key={code}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {roleNames.get(code) ?? code}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {user.branches.join(", ") || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge
                        status={user.status}
                        label={isActive ? "Đang hoạt động" : "Đã khóa"}
                      />
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog({ kind: "edit", user })}
                        >
                          <Pencil />
                          Sửa
                        </Button>

                        {isCurrentUser ? (
                          <Link
                            href="/account"
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                          >
                            <KeyRound className="size-3.5" />
                            Đổi mật khẩu
                          </Link>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setDialog({ kind: "password", user })
                              }
                            >
                              <KeyRound />
                              Mật khẩu
                            </Button>

                            <Button
                              type="button"
                              variant={isActive ? "destructive" : "outline"}
                              size="sm"
                              onClick={() =>
                                setDialog({ kind: "status", user })
                              }
                            >
                              {isActive ? "Khóa" : "Kích hoạt"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      )}

      {/* Hộp thoại: tạo tài khoản */}
      <Dialog
        open={dialog?.kind === "create"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản mới</DialogTitle>
            <DialogDescription>
              Điền thông tin, chọn vai trò và chi nhánh cho tài khoản.
            </DialogDescription>
          </DialogHeader>

          <CreateUserForm
            roles={roles}
            branches={branches}
            onCancel={() => setDialog(null)}
            onDone={handleDone}
          />
        </DialogContent>
      </Dialog>

      {/* Hộp thoại: sửa thông tin */}
      <Dialog
        open={dialog?.kind === "edit"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {dialog?.kind === "edit" && (
            <>
              <DialogHeader>
                <DialogTitle>Sửa thông tin tài khoản</DialogTitle>
                <DialogDescription>
                  Tài khoản: {dialog.user.username}
                </DialogDescription>
              </DialogHeader>

              <EditUserForm
                key={dialog.user.id}
                user={dialog.user}
                onCancel={() => setDialog(null)}
                onDone={handleDone}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hộp thoại: đặt lại mật khẩu */}
      <Dialog
        open={dialog?.kind === "password"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {dialog?.kind === "password" && (
            <>
              <DialogHeader>
                <DialogTitle>Đặt lại mật khẩu</DialogTitle>
                <DialogDescription>
                  Tài khoản: {dialog.user.username} ({dialog.user.fullName})
                </DialogDescription>
              </DialogHeader>

              <ResetPasswordForm
                key={dialog.user.id}
                user={dialog.user}
                onCancel={() => setDialog(null)}
                onDone={handleDone}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Xác nhận khóa / kích hoạt */}
      <ConfirmDialog
        open={dialog?.kind === "status"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={locking ? "Khóa tài khoản?" : "Kích hoạt tài khoản?"}
        description={
          statusTarget
            ? locking
              ? `Tài khoản "${statusTarget.username}" sẽ không đăng nhập được nữa. Phiên đang mở (nếu có) hết hạn theo thời gian.`
              : `Tài khoản "${statusTarget.username}" sẽ đăng nhập lại được.`
            : undefined
        }
        confirmLabel={locking ? "Khóa tài khoản" : "Kích hoạt"}
        destructive={locking}
        loading={statusSaving}
        onConfirm={() => void confirmStatusChange()}
      />
    </div>
  );
}