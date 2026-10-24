"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("")

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Đăng nhập thất bại",
        );

        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(
        "Không thể kết nối máy chủ",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-8 text-slate-900 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Smart Language Center
        </h1>

        <p className="mt-1 mb-6 text-sm text-slate-600">
          Đăng nhập hệ thống quản lý trung tâm
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">
              Tên đăng nhập
            </label>

            <input
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value,
                )
              }
              className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700"
              placeholder="admin"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">
              Mật khẩu
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value,
                )
              }
              className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700"
              placeholder="123456"
              required
            />
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading
              ? "Đang đăng nhập..."
              : "Đăng nhập"}
          </button>
        </form>    
      </div>
    </main>
  );
}