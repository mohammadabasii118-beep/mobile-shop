/** Labels shared by the server and the client. Tickets and live chats have separate status sets on purpose. */
export const CATEGORIES = { general: "عمومی", order: "مشکل سفارش", payment: "مشکل پرداخت", product: "محصول", return: "مرجوعی / لغو", technical: "مشکل فنی", financial: "درخواست مالی", complaint: "شکایت / پیگیری", wholesale: "همکاری عمده" } as const;
/** Ticket life cycle (stored lower-case). open = waiting for staff, in_progress = staff working on it, waiting_for_user = staff asked the customer, answered = staff replied, closed. */
export const TICKET_STATUSES = ["open", "in_progress", "waiting_for_user", "answered", "closed"] as const;
export type TicketTone = "warn" | "info" | "ok" | "mute";
export const TICKET_STATUS_LABEL: Record<(typeof TICKET_STATUSES)[number], [string, TicketTone]> = {
  open: ["باز (در انتظار پشتیبانی)", "warn"], in_progress: ["در حال بررسی", "info"], waiting_for_user: ["در انتظار پاسخ شما", "warn"], answered: ["پاسخ داده شد", "ok"], closed: ["بسته", "mute"],
};
export const CHAT_STATUS_LABEL: Record<string, [string, TicketTone]> = { waiting: ["منتظر پاسخ", "warn"], active: ["در جریان", "ok"], closed: ["بسته", "mute"] };
