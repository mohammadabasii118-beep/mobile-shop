/// ساخت تصویر بندانگشتی از یک ویدیو با ffmpeg (بدون پلاگین اضافه).
library;

import 'dart:io';

import 'package:path/path.dart' as p;

import 'app_paths.dart';
import 'ffmpeg/ffmpeg_service.dart';

class ThumbnailService {
  final FFmpegService ffmpeg;
  ThumbnailService(this.ffmpeg);

  /// یک فریم در ثانیه‌ی [at] استخراج و به‌صورت PNG ذخیره می‌کند؛ مسیر را برمی‌گرداند.
  Future<String?> thumbnail(String videoPath, {double at = 1.0}) async {
    try {
      final dir = await AppPaths.tmpDir();
      final name = 'thumb_${videoPath.hashCode}_${at.toStringAsFixed(1)}.png';
      final out = p.join(dir.path, name);
      if (File(out).existsSync()) return out;
      await ffmpeg.run([
        '-v', 'error', '-y', '-ss', at.toStringAsFixed(2), '-i', videoPath,
        '-frames:v', '1', '-vf', 'scale=320:-1', out
      ]);
      return File(out).existsSync() ? out : null;
    } catch (_) {
      return null;
    }
  }
}
