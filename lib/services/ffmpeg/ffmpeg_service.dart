/// واسط واحد ffmpeg. اندروید از پلاگین ffmpeg_kit و ویندوز/دسکتاپ از
/// ffmpeg.exe باندل‌شده (dart:io Process) استفاده می‌کند — پشت همین واسط.
library;

class FfException implements Exception {
  final String message;
  FfException(this.message);
  @override
  String toString() => 'FfException: $message';
}

abstract class FFmpegService {
  /// آماده‌سازی (مثلاً یافتن مسیر ffmpeg.exe). قبل از استفاده صدا زده شود.
  Future<void> init();

  /// اجرای ffmpeg با آرگومان‌های دقیق. در صورت خطا FfException پرتاب می‌کند
  /// (مثل run() در editor.py). [onStderr] برای گزارش پیشرفت/لاگ.
  Future<void> run(List<String> args, {void Function(String chunk)? onStderr});

  /// اجرای ffprobe و برگرداندن خروجی استاندارد (stdout).
  Future<String> probe(List<String> args);

  /// نام قابل‌نمایش برای تشخیص نوع سرویس (برای لاگ).
  String get backendName;
}
