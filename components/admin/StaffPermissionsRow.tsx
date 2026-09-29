"use client";
import { useState } from "react";
import { updateStaffPermissions, deleteStaffAccount } from "@/lib/actions/staff";
import { STAFF_PERMISSIONS } from "@/lib/permissions";

export default function StaffPermissionsRow({ id, name, email, permissions }: { id: string; name: string; email: string; permissions: string[] }) {
  const [editing, setEditing] = useState(false);

  return (
    <tr className="border-t line align-top">
      <td className="p-3">
        <div className="font-medium">{name}</div>
        <div className="text-xs muted">{email}</div>
      </td>
      <td className="p-3">
        {!editing ? (
          <span className="text-xs muted">
            {permissions.length ? STAFF_PERMISSIONS.filter((p) => permissions.includes(p.key)).map((p) => p.label).join("، ") : "بدون دسترسی"}
          </span>
        ) : (
          <form action={async (fd) => { await updateStaffPermissions(id, fd); setEditing(false); }} className="flex flex-col gap-2">
            {STAFF_PERMISSIONS.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="permissions" value={p.key} defaultChecked={permissions.includes(p.key)} /> {p.label}
              </label>
            ))}
            <button className="text-xs font-medium w-fit" style={{ color: "#404040" }}>ذخیره</button>
          </form>
        )}
      </td>
      <td className="p-3 flex gap-3">
        {!editing && <button onClick={() => setEditing(true)} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش دسترسی</button>}
        <form action={async () => { if (confirm("حذف این حساب کارمند؟")) await deleteStaffAccount(id); }}>
          <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
        </form>
      </td>
    </tr>
  );
}
