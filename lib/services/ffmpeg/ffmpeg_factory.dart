/// انتخاب سرویس ffmpeg بر اساس پلتفرم: اندروید/iOS -> ffmpeg_kit،
/// ویندوز/دسکتاپ -> ffmpeg.exe باندل‌شده با Process.
library;

import 'dart:io';

import 'ffmpeg_service.dart';
import 'ffmpeg_kit_service.dart';
import 'process_ffmpeg_service.dart';

FFmpegService createFFmpegService() {
  if (Platform.isAndroid || Platform.isIOS) {
    return FfmpegKitService();
  }
  return ProcessFFmpegService();
}
