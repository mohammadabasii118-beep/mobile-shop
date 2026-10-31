@Tags(['integration'])
library;

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mafia_ghab_editor/models/season.dart';
import 'package:mafia_ghab_editor/services/build_service.dart';
import 'package:mafia_ghab_editor/services/ffmpeg/process_ffmpeg_service.dart';

/// می‌سازد یک قسمتِ کوچکِ واقعی را روی همین ماشین (ffmpeg سیستم) تا کل
/// پایپلاین فاز ۱ ثابت شود: شروع تند + قسمت قبل + تیتر + برچسب + زیرنویس +
/// کارت پایانی + چسباندن، و بررسی می‌کند خروجی mp4 معتبر و ۱۰۸۰×۱۹۲۰ است.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const base =
      '/tmp/claude-0/-home-user-mobile-shop/496828b0-e757-5650-a637-7831624ec6c6/scratchpad';
  const clips = '$base/clips';
  const outDir = '$base/pipeline_out';

  setUpAll(() async {
    final v = File('assets/fonts/Vazirmatn[wght].ttf').readAsBytesSync();
    final l = File('assets/fonts/Lalezar-Regular.ttf').readAsBytesSync();
    await (FontLoader('Vazirmatn')..addFont(Future.value(ByteData.view(v.buffer))))
        .load();
    await (FontLoader('Lalezar')..addFont(Future.value(ByteData.view(l.buffer))))
        .load();
    Directory(outDir).createSync(recursive: true);
  });

  test('build a mini episode end-to-end', () async {
    final prevEp = EpisodeData(
      number: 4,
      title: 'بندر',
      cold: const [],
      labels: const {},
      question: 'سؤال قبلی؟',
      isFinal: false,
      clips: const [
        SceneData(who: 'M', title: 's1', sub: 'این جمله‌ی اول قسمت قبله.'),
        SceneData(who: 'S', title: 's2', sub: 'و این جمله‌ی دوم قسمت قبل.'),
      ],
    );
    final ep = EpisodeData(
      number: 5,
      title: 'گمرک',
      cold: const [2, 3],
      labels: const {1: 'گمرک بندرعباس'},
      question: 'به نظرت کی پشت دره؟',
      isFinal: false,
      clips: const [
        SceneData(who: 'M', title: 'c1', sub: 'همه‌ی مدارکش قانونیه! چرا توقیفه؟'),
        SceneData(who: 'E', title: 'c2', sub: 'یه شکایت داریم. از یه کاسب محترم.'),
        SceneData(who: 'M', title: 'c3', sub: 'بذار حدس بزنم... سلطان.'),
      ],
    );

    final ffmpeg = ProcessFFmpegService(); // از ffmpeg سیستم
    final builder = EpisodeBuilder(ffmpeg);

    final spec = await builder.prepareSpec(
      ep: ep,
      files: {1: '$clips/cur1.mp4', 2: '$clips/cur2.mp4', 3: '$clips/cur3.mp4'},
      prevEp: prevEp,
      prevFiles: {1: '$clips/prev1.mp4', 2: '$clips/prev2.mp4'},
      workDir: '$outDir/work',
      outPath: '$outDir/mafia-ghab-ep05.mp4',
    );

    // ساختار spec: cold(2) + recap(1) + scenes(3) = 6 کلیپ، تیتر روی کلیپ ۴.
    expect(spec.clips.length, 6);
    expect(spec.titleClip, 4);
    expect(spec.labels.containsKey(3), true); // لیبل قسمت قبل روی کلیپ ۳
    expect(spec.labels[3]!.a, 'قسمت قبل...');
    expect(spec.labels.containsKey(4), true); // لیبل مکان روی اولین صحنه
    expect(spec.labels[4]!.a, 'گمرک بندرعباس');
    expect(spec.endLines[0], 'ادامه دارد...');

    await builder.runBuild(spec, onProgress: (f, s) {
      // ignore: avoid_print
      print('progress ${(f * 100).toStringAsFixed(0)}%  $s');
    });

    final out = File(spec.outPath);
    expect(out.existsSync(), true, reason: 'فایل خروجی باید ساخته شود');
    expect(out.lengthSync() > 10000, true);

    final size = await ffmpeg.probe([
      '-v', 'error', '-select_streams', 'v', '-show_entries',
      'stream=width,height', '-of', 'csv=p=0:s=x', spec.outPath
    ]);
    expect(size.trim(), '1080x1920');

    final hasAudio = await ffmpeg.probe([
      '-v', 'error', '-select_streams', 'a', '-show_entries',
      'stream=index', '-of', 'csv=p=0', spec.outPath
    ]);
    expect(hasAudio.trim().isNotEmpty, true, reason: 'باید صدا داشته باشد');
  }, timeout: const Timeout(Duration(minutes: 5)));
}
