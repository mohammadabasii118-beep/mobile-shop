export const faDateTime = (d: Date | string) => new Date(d).toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
export const faDate = (d: Date | string) => new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
export const orderNo = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
export const TICKET_STATUS: Record<string, [string, string]> = { open: ["در انتظار پاسخ پشتیبانی", "bg-warning/15 text-warning"], answered: ["پاسخ داده شد", "bg-success/15 text-success"], closed: ["بسته شده", "bg-surface-2 text-muted"] };
