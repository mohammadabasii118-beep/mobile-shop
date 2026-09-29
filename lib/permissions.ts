// The single list of staff permissions that actually mean something right
// now — deliberately short. Every value here MUST have a real
// requireStaffPermission(...) check somewhere and a matching entry in
// middleware.ts's STAFF_ALLOWED list; otherwise checking the box would be
// a decorative no-op, which this project's rules explicitly forbid.
//
// Kept in its own plain module (not lib/actions/staff.ts) because a
// "use server" file may only export async functions — a client component
// importing a plain constant from one would break.
export const STAFF_PERMISSIONS = [{ key: "SUPPORT", label: "پشتیبانی و پیام‌های تماس با ما" }];
