import Link from "next/link";
import { db } from "@/lib/db";

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">کاربران</h1>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">نام</th>
              <th className="p-3 text-right">ایمیل</th>
              <th className="p-3 text-right">تعداد سفارش</th>
              <th className="p-3 text-right">تاریخ عضویت</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t line">
                <td className="p-3">{u.name}</td>
                <td className="p-3 muted">{u.email}</td>
                <td className="p-3">{u._count.orders}</td>
                <td className="p-3 muted">{new Date(u.createdAt).toLocaleDateString("fa-IR")}</td>
                <td className="p-3"><Link href={`/admin/users/${u.id}`} className="text-xs font-medium" style={{ color: "#404040" }}>جزئیات</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {users.length === 0 && <p className="p-6 text-center muted text-sm">کاربری ثبت نشده است.</p>}
      </div>
    </div>
  );
}
