"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

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

type RoleItem = {
  code: string;
  name: string;
};

type BranchItem = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type FormState = {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  roleCode: string;
  branchId: string;
};

const initialForm: FormState = {
  username: "",
  fullName: "",
  email: "",
  phone: "",
  password: "",
  roleCode: "STUDENT",
  branchId: "",
};

export default function UsersManager({
  currentUsername,
}: {
  currentUsername: string;
}) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(
    null,
  );

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Không thể tải tài khoản.",
        );
      }

      setUsers(data.users);
      setRoles(data.roles);
      setBranches(data.branches);

      setForm((previous) => ({
        ...previous,
        roleCode:
          previous.roleCode ||
          data.roles[0]?.code ||
          "STUDENT",
        branchId:
          previous.branchId ||
          data.branches[0]?.id ||
          "",
      }));
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Đã xảy ra lỗi.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const content = [
        user.username,
        user.fullName,
        user.email ?? "",
        user.phone ?? "",
        user.roles.join(" "),
        user.branches.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(keyword);
    });
  }, [users, search]);

  function updateForm(
    field: keyof FormState,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Không thể tạo tài khoản.",
        );
      }

      setNotice({
        type: "success",
        text: "Tạo tài khoản thành công.",
      });

      setForm({
        ...initialForm,
        roleCode: form.roleCode,
        branchId: form.branchId,
      });

      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể tạo tài khoản.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: UserItem) {
    if (user.username === currentUsername) {
      setNotice({
        type: "error",
        text: "Bạn không thể khóa tài khoản đang sử dụng.",
      });
      return;
    }

    const nextStatus =
      user.status === "ACTIVE"
        ? "INACTIVE"
        : "ACTIVE";

    const confirmed = window.confirm(
      nextStatus === "INACTIVE"
        ? `Bạn có chắc muốn khóa tài khoản "${user.username}"?`
        : `Bạn có chắc muốn kích hoạt tài khoản "${user.username}"?`,
    );

    if (!confirmed) {
      return;
    }

    setUpdatingId(user.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Không thể cập nhật trạng thái.",
        );
      }

      setNotice({
        type: "success",
        text: data.message,
      });

      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật tài khoản.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">
              Quản lý tài khoản
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Tạo tài khoản, gán vai trò và quản lý trạng thái.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
          >
            Quay lại Dashboard
          </Link>
        </header>

        {notice && (
          <div
            role="status"
            className={
              notice.type === "success"
                ? "rounded-md border border-green-300 bg-green-50 p-3 text-green-900"
                : "rounded-md border border-red-300 bg-red-50 p-3 text-red-900"
            }
          >
            {notice.text}
          </div>
        )}

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">
            Tạo tài khoản mới
          </h2>

          <form
            onSubmit={handleCreate}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Username *
              </label>

              <input
                value={form.username}
                onChange={(event) =>
                  updateForm("username", event.target.value)
                }
                minLength={3}
                maxLength={100}
                required
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
              />
            </div>

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
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
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
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
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
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Mật khẩu *
              </label>

              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  updateForm("password", event.target.value)
                }
                minLength={8}
                required
                autoComplete="new-password"
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
              />

              <p className="mt-1 text-xs text-slate-600">
                Tối thiểu 8 ký tự.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Vai trò *
              </label>

              <select
                value={form.roleCode}
                onChange={(event) =>
                  updateForm("roleCode", event.target.value)
                }
                required
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
              >
                {roles.map((role) => (
                  <option
                    key={role.code}
                    value={role.code}
                  >
                    {role.name} ({role.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Chi nhánh *
              </label>

              <select
                value={form.branchId}
                onChange={(event) =>
                  updateForm("branchId", event.target.value)
                }
                required
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
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

            <div className="flex items-end">
              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  roles.length === 0 ||
                  branches.length === 0
                }
                className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Đang tạo..."
                  : "Tạo tài khoản"}
              </button>
            </div>
          </form>

          {branches.length === 0 && !loading && (
            <p className="mt-4 text-sm text-red-700">
              Chưa có chi nhánh ACTIVE. Hãy kiểm tra dữ liệu bảng branches trước khi tạo tài khoản.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Danh sách tài khoản
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Số kết quả: {filteredUsers.length}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
            >
              Làm mới
            </button>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">
              Tìm kiếm
            </label>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Nhập username, họ tên, email hoặc role..."
              className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
            />
          </div>

          {loading ? (
            <p className="py-8 text-center text-slate-600">
              Đang tải dữ liệu...
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-slate-600">
              Không tìm thấy tài khoản.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100">
                    <th className="p-3">Tài khoản</th>
                    <th className="p-3">Họ tên</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Chi nhánh</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const isActive =
                      user.status === "ACTIVE";

                    const isCurrentUser =
                      user.username === currentUsername;

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-slate-200 hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium">
                          {user.username}
                        </td>

                        <td className="p-3">
                          {user.fullName}
                        </td>

                        <td className="p-3">
                          {user.email || "—"}
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((code) => (
                              <span
                                key={code}
                                className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="p-3">
                          {user.branches.join(", ") || "—"}
                        </td>

                        <td className="p-3">
                          <span
                            className={
                              isActive
                                ? "rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800"
                                : "rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800"
                            }
                          >
                            {user.status}
                          </span>
                        </td>

                        <td className="p-3">
                          {isCurrentUser ? (
                            <span className="text-xs text-slate-500">
                              Tài khoản hiện tại
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={updatingId === user.id}
                              onClick={() =>
                                void toggleStatus(user)
                              }
                              className={
                                isActive
                                  ? "rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                                  : "rounded-md border border-green-300 bg-white px-3 py-1.5 font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                              }
                            >
                              {updatingId === user.id
                                ? "Đang cập nhật..."
                                : isActive
                                  ? "Khóa"
                                  : "Kích hoạt"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}