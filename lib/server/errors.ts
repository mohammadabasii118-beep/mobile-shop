export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const badRequest = (message: string, code = "bad_request", details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = "برای ادامه وارد حساب کاربری شوید.") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "شما به این بخش دسترسی ندارید.") => new AppError(403, "forbidden", message);
export const notFound = (message = "مورد پیدا نشد.") => new AppError(404, "not_found", message);
export const conflict = (message: string, code = "conflict", details?: unknown) => new AppError(409, code, message, details);
export const tooMany = (retryAfter: number) => new AppError(429, "rate_limited", "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.", { retryAfter });
