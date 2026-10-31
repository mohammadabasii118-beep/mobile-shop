/// پیاده‌سازی ffmpeg با dart:io Process — برای ویندوز (ffmpeg.exe باندل‌شده)
/// و دسکتاپ توسعه (لینوکس/مک با ffmpeg نصب‌شده روی PATH).
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

import 'ffmpeg_service.dart';

class ProcessFFmpegService implements FFmpegService {
  String _ffmpeg;
  String _ffprobe;

  /// اگر مسیرها داده نشوند، init() به‌صورت خودکار پیدا می‌کند.
  ProcessFFmpegService({String? ffmpeg, String? ffprobe})
      : _ffmpeg = ffmpeg ?? '',
        _ffprobe = ffprobe ?? '';

  @override
  String get backendName => 'process($_ffmpeg)';

  @override
  Future<void> init() async {
    if (_ffmpeg.isNotEmpty && _ffprobe.isNotEmpty) return;
    final exeExt = Platform.isWindows ? '.exe' : '';
    // ۱) کنار فایل اجرایی برنامه (باندل‌شده).
    final exeDir = p.dirname(Platform.resolvedExecutable);
    final candidates = <List<String>>[
      [p.join(exeDir, 'ffmpeg$exeExt'), p.join(exeDir, 'ffprobe$exeExt')],
      [
        p.join(exeDir, 'data', 'flutter_assets', 'assets', 'bin',
            'ffmpeg$exeExt'),
        p.join(exeDir, 'data', 'flutter_assets', 'assets', 'bin',
            'ffprobe$exeExt'),
      ],
      [p.join(exeDir, 'ffmpeg', 'ffmpeg$exeExt'),
       p.join(exeDir, 'ffmpeg', 'ffprobe$exeExt')],
    ];
    for (final c in candidates) {
      if (File(c[0]).existsSync() && File(c[1]).existsSync()) {
        _ffmpeg = c[0];
        _ffprobe = c[1];
        return;
      }
    }
    // ۲) در غیر این صورت از PATH سیستم.
    _ffmpeg = 'ffmpeg$exeExt';
    _ffprobe = 'ffprobe$exeExt';
  }

  @override
  Future<void> run(List<String> args,
      {void Function(String chunk)? onStderr}) async {
    await init();
    // افزودن گزارش پیشرفت بدون تغییر در فایل خروجی.
    final full = <String>['-progress', 'pipe:2', '-stats_period', '0.3', ...args];
    final proc = await Process.start(_ffmpeg, full);
    final err = StringBuffer();
    final errDone = proc.stderr.transform(utf8.decoder).listen((d) {
      err.write(d);
      if (onStderr != null) onStderr(d);
    }).asFuture<void>();
    // stdout را هم تخلیه کن تا بافر پر نشود.
    final outDone = proc.stdout.drain<void>();
    final code = await proc.exitCode;
    await errDone;
    await outDone;
    if (code != 0) {
      final tail = err.toString();
      throw FfException(
          'ffmpeg خطا داد (کد $code)\n${tail.substring(tail.length > 2000 ? tail.length - 2000 : 0)}');
    }
  }

  @override
  Future<String> probe(List<String> args) async {
    await init();
    final r = await Process.run(_ffprobe, args);
    if (r.exitCode != 0) {
      throw FfException('ffprobe خطا داد: ${r.stderr}');
    }
    return r.stdout as String;
  }
}
