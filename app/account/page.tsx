import { redirect } from "next/navigation";

import { Panel } from "@/components/shared/Panel";
import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentSession } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Tài khoản của tôi"
        description="Xem thông tin và đổi mật khẩu đăng nhập."
      />

      <Panel title="Thông tin">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Họ và tên</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {session.fullName}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Tên đăng nhập</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {session.username}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Vai trò</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {session.roleName || session.role}
            </dd>
          </div>
        </dl>
      </Panel>

      <ChangePasswordForm />
    </div>
  );
}