/// پیاده‌سازی ffmpeg برای اندروید/iOS با پلاگین نگه‌داری‌شده‌ی
/// ffmpeg_kit_flutter_new (نسخه‌ی Full+GPL، شامل libx264).
library;

import 'package:ffmpeg_kit_flutter_new/ffmpeg_kit.dart';
import 'package:ffmpeg_kit_flutter_new/ffmpeg_kit_config.dart';
import 'package:ffmpeg_kit_flutter_new/ffprobe_kit.dart';
import 'package:ffmpeg_kit_flutter_new/return_code.dart';
import 'package:ffmpeg_kit_flutter_new/statistics.dart';

import 'ffmpeg_service.dart';

class FfmpegKitService implements FFmpegService {
  @override
  String get backendName => 'ffmpeg_kit';

  @override
  Future<void> init() async {}

  @override
  Future<void> run(List<String> args,
      {void Function(String chunk)? onStderr}) async {
    if (onStderr != null) {
      // گزارش پیشرفت: getTime() برحسب میلی‌ثانیه است -> به میکروثانیه.
      FFmpegKitConfig.enableStatisticsCallback((Statistics s) {
        onStderr('out_time_us=${s.getTime() * 1000}');
      });
    } else {
      FFmpegKitConfig.enableStatisticsCallback();
    }
    final session = await FFmpegKit.executeWithArguments(args);
    final rc = await session.getReturnCode();
    if (!ReturnCode.isSuccess(rc)) {
      final logs = await session.getAllLogsAsString();
      throw FfException('ffmpeg خطا داد (کد ${rc?.getValue()})\n${logs ?? ''}');
    }
  }

  @override
  Future<String> probe(List<String> args) async {
    final session = await FFprobeKit.executeWithArguments(args);
    final rc = await session.getReturnCode();
    if (!ReturnCode.isSuccess(rc)) {
      final logs = await session.getAllLogsAsString();
      throw FfException('ffprobe خطا داد\n${logs ?? ''}');
    }
    return (await session.getOutput()) ?? '';
  }
}
