/// پایپلاین ساخت قسمت — پورت دقیق make_spec() و build() از editor.py.
/// دستورهای ffmpeg عیناً مثل editor.py هستند تا خروجی هم‌شکل بماند؛ فقط
/// مرحله‌ی ساخت اورلی (که در پایتون با Playwright بود) با canvas فلاتر عوض شده.
library;

import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:path/path.dart' as p;

import '../models/season.dart';
import 'overlay_renderer.dart';
import 'subtitle/subtitle_timing.dart';
import 'subtitle/vad.dart';
import 'ffmpeg/ffmpeg_service.dart';

typedef ProgressCb = void Function(double fraction, String step);

/// مشخصات یک برچسب مکان/زمان: [s,e] بازه‌ی نمایش و دو خط متن.
class LabelSpec {
  double s;
  double e;
  String a;
  String b;
  LabelSpec(this.s, this.e, this.a, this.b);

  Map<String, dynamic> toJson() => {'s': s, 'e': e, 'a': a, 'b': b};
  factory LabelSpec.fromJson(Map<String, dynamic> j) => LabelSpec(
      (j['s'] as num).toDouble(), (j['e'] as num).toDouble(),
      j['a'] as String, j['b'] as String);
}

/// نقشه‌ی کامل ساخت یک قسمت (معادل spec.json در editor.py).
class BuildSpec {
  final int ep;
  final String title;

  /// مسیر کلیپ‌ها به ترتیب نهایی (شروع تند، قسمت قبل، صحنه‌ها).
  final List<String> clips;

  /// شماره‌ی کلیپی که تیتر روی آن می‌آید (۱-مبنا).
  final int titleClip;

  /// زیرنویس هر کلیپ: شماره‌ی کلیپ -> خطوط.
  final Map<int, List<SubLine>> subs;

  /// برچسب هر کلیپ: شماره‌ی کلیپ -> LabelSpec.
  final Map<int, LabelSpec> labels;

  /// [خط اول کارت پایانی، خط دوم (سؤال + <br>کامنت کن)].
  final List<String> endLines;

  /// متن شروع تندِ تایپوگرافیک (اختیاری؛ [[...]] = طلایی). معمولاً null.
  final String? hook;

  final String outPath;
  final String workDir;

  BuildSpec({
    required this.ep,
    required this.title,
    required this.clips,
    required this.titleClip,
    required this.subs,
    required this.labels,
    required this.endLines,
    required this.outPath,
    required this.workDir,
    this.hook,
  });

  Map<String, dynamic> toJson() => {
        'ep': ep,
        'title': title,
        'clips': clips,
        'title_clip': titleClip,
        'subs': subs.map((k, v) =>
            MapEntry(k.toString(), v.map((s) => s.toJson()).toList())),
        'labels': labels.map((k, v) => MapEntry(k.toString(), v.toJson())),
        'end_lines': endLines,
        if (hook != null) 'hook': hook,
        'out': outPath,
        'work_dir': workDir,
      };

  factory BuildSpec.fromJson(Map<String, dynamic> j) => BuildSpec(
        ep: j['ep'] as int,
        title: j['title'] as String,
        clips: (j['clips'] as List).map((e) => e as String).toList(),
        titleClip: j['title_clip'] as int,
        subs: (j['subs'] as Map<String, dynamic>).map((k, v) => MapEntry(
            int.parse(k),
            (v as List).map((e) => SubLine.fromJson(e as List)).toList())),
        labels: (j['labels'] as Map<String, dynamic>).map((k, v) =>
            MapEntry(int.parse(k), LabelSpec.fromJson(v as Map<String, dynamic>))),
        endLines: (j['end_lines'] as List).map((e) => e as String).toList(),
        hook: j['hook'] as String?,
        outPath: j['out'] as String,
        workDir: j['work_dir'] as String,
      );
}

class _Ov {
  final double s;
  final double e;
  final String png;
  _Ov(this.s, this.e, this.png);
}

class EpisodeBuilder {
  final FFmpegService ffmpeg;
  EpisodeBuilder(this.ffmpeg);

  int _vadCounter = 0;

  /// مدت یک ویدیو (عمومی، برای UI).
  Future<double> probeDuration(String f) => _duration(f);

  /// برش دلخواه کاربر روی یک کلیپ داستان (پیش از پایپلاین اصلی). دوباره کدگذاری
  /// می‌شود تا برش دقیق و قاب‌به‌قاب باشد؛ پایپلاین اصلی هم بعداً دوباره کد می‌کند.
  Future<String> trimClip(
      String src, String dst, double? start, double? end) async {
    final args = <String>['-v', 'error', '-y'];
    if (start != null) args.addAll(['-ss', start.toStringAsFixed(2)]);
    args.addAll(['-i', src]);
    if (end != null) {
      final dur = end - (start ?? 0);
      args.addAll(['-t', dur.toStringAsFixed(2)]);
    }
    args.addAll([
      '-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', '-ar', '44100', dst
    ]);
    await ffmpeg.run(args);
    return dst;
  }

  // ---------------------------------------------------------------- کمک‌های ffmpeg
  Future<double> _duration(String f) async {
    final out = await ffmpeg.probe(
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]);
    return double.parse(out.trim());
  }

  Future<bool> _hasAudio(String f) async {
    final out = await ffmpeg.probe([
      '-v', 'error', '-select_streams', 'a',
      '-show_entries', 'stream=index', '-of', 'csv=p=0', f
    ]);
    return out.trim().isNotEmpty;
  }

  /// معادل speech(f) در editor.py: دیکد به 16k mono s16le و اجرای VAD.
  /// چون ffmpeg_kit نمی‌تواند به stdout پایپ کند، به فایل موقت می‌نویسیم
  /// (بایت‌ها یکسان است).
  Future<List<List<double>>> _speech(String f, String workDir) async {
    if (!await _hasAudio(f)) return const [];
    final pcm = p.join(workDir, 'vad_${_vadCounter++}.pcm');
    await ffmpeg.run(
        ['-v', 'error', '-y', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', pcm]);
    final bytes = await File(pcm).readAsBytes();
    try {
      await File(pcm).delete();
    } catch (_) {}
    return Vad.speechFromPcm(bytes);
  }

  Future<List<SubLine>> _timedSubs(String f, String text, String workDir) async {
    final d = await _duration(f);
    final sg = await _speech(f, workDir);
    return SubtitleTiming.timedSubs(duration: d, speech: sg, text: text);
  }

  /// معادل cut(): پیش‌برش کلیپ به 720x1280 (برای شروع تند و قسمت قبل).
  Future<void> _cut(String src, String dst, double ss, double t,
      {bool gray = false}) async {
    var vf =
        'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24';
    if (gray) vf += ',hue=s=0.25,eq=brightness=-0.03';
    final cmd = <String>[
      '-v', 'error', '-y', '-ss', ss.toStringAsFixed(2),
      '-t', t.toStringAsFixed(2), '-i', src
    ];
    if (await _hasAudio(src)) {
      cmd.addAll(
          ['-vf', vf, '-af', 'aresample=44100,aformat=channel_layouts=stereo']);
    } else {
      cmd.addAll([
        '-f', 'lavfi', '-t', t.toStringAsFixed(2),
        '-i', 'anullsrc=r=44100:cl=stereo', '-map', '0:v', '-map', '1:a',
        '-vf', vf
      ]);
    }
    cmd.addAll(
        ['-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', '-ar', '44100', '-shortest', dst]);
    await ffmpeg.run(cmd);
  }

  // ---------------------------------------------------------------- آماده‌سازی spec
  /// معادل make_spec(): شروع تند + قسمت قبل + صحنه‌ها را می‌چیند و زیرنویس‌ها
  /// را خودکار زمان‌بندی می‌کند.
  Future<BuildSpec> prepareSpec({
    required EpisodeData ep,
    required Map<int, String> files,
    EpisodeData? prevEp,
    Map<int, String> prevFiles = const {},
    required String workDir,
    required String outPath,
    String? hook,
    ProgressCb? onProgress,
  }) async {
    Directory(workDir).createSync(recursive: true);
    final need = ep.sceneCount;
    final miss = [for (var i = 1; i <= need; i++) if (!files.containsKey(i)) i];
    if (miss.isNotEmpty) {
      throw FfException(
          'ویدیوی این صحنه‌ها انتخاب نشده: ${miss.map((i) => '${_two(i)}.mp4').join('، ')}');
    }

    final clips = <String>[];
    final subs = <int, List<SubLine>>{};
    final labels = <int, LabelSpec>{};

    // ۱) شروع تند
    for (final k in ep.cold) {
      if (!files.containsKey(k)) continue;
      final src = files[k]!;
      final sg = await _speech(src, workDir);
      final dd = await _duration(src);
      final a = sg.isNotEmpty ? _max0(sg.first[0] - 0.3) : 0.0;
      final b = sg.isNotEmpty ? math.min(dd, sg.last[1] + 0.4) : dd;
      final dst = p.join(workDir, 'cold_${_two(k)}.mp4');
      await _cut(src, dst, a, b - a);
      clips.add(dst);
      final txt = ep.clips[k - 1].sub;
      if (txt.isNotEmpty) subs[clips.length] = await _timedSubs(dst, txt, workDir);
      onProgress?.call(0.0, 'شروع تند: صحنه $k');
    }

    // ۲) قسمت قبل (از قسمت قبلی)
    if (prevEp != null && prevFiles.isNotEmpty) {
      final plen = prevEp.sceneCount;
      final speak = [
        for (var i = 1; i <= plen; i++)
          if (prevEp.clips[i - 1].sub.isNotEmpty && prevFiles.containsKey(i)) i
      ];
      final picks = speak.length >= 2 ? speak.sublist(speak.length - 2) : speak;
      if (picks.isNotEmpty) {
        final parts = <String>[];
        for (var j = 0; j < picks.length; j++) {
          final i = picks[j];
          final src = prevFiles[i]!;
          final sg = await _speech(src, workDir);
          final dd = await _duration(src);
          final a = sg.isNotEmpty ? _max0(sg.first[0] - 0.2) : 0.0;
          var b = sg.isNotEmpty ? math.min(dd, sg.last[1] + 0.4) : dd;
          if (j < picks.length - 1) b = math.min(b, a + 3.0);
          final dst = p.join(workDir, 'recap_$j.mp4');
          await _cut(src, dst, a, b - a, gray: true);
          parts.add(dst);
        }
        final rec = p.join(workDir, 'recap.mp4');
        final lst = p.join(workDir, 'recap.txt');
        await File(lst).writeAsString(
            '${parts.map((p0) => "file '${p0.replaceAll('\\', '/')}'").join('\n')}\n');
        await ffmpeg.run(
            ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', rec]);
        clips.add(rec);
        double off = 0;
        for (var x = 0; x < parts.length - 1; x++) {
          off += await _duration(parts[x]);
        }
        final lastsub =
            await _timedSubs(parts.last, prevEp.clips[picks.last - 1].sub, workDir);
        subs[clips.length] = [
          for (final s in lastsub)
            SubLine(SubtitleTiming.round2(s.start + off),
                SubtitleTiming.round2(s.end + off), s.text)
        ];
        final recDur = await _duration(rec);
        labels[clips.length] =
            LabelSpec(0, math.min(5.0, recDur), 'قسمت قبل...', 'مافیای قاب');
        onProgress?.call(0.0, 'خلاصه‌ی قسمت قبل');
      }
    }

    // ۳) صحنه‌ها
    final titleClip = clips.length + 1;
    for (var i = 1; i <= need; i++) {
      clips.add(files[i]!);
      final c = ep.clips[i - 1];
      if (c.sub.isNotEmpty) {
        subs[clips.length] = await _timedSubs(files[i]!, c.sub, workDir);
      }
      if (ep.labels.containsKey(i)) {
        labels[clips.length] = LabelSpec(0.2, 3.5, ep.labels[i]!, '');
      }
    }

    final line1 = ep.isFinal ? 'پایان فصل اول' : 'ادامه دارد...';
    return BuildSpec(
      ep: ep.number,
      title: ep.title,
      clips: clips,
      titleClip: titleClip,
      subs: subs,
      labels: labels,
      endLines: [line1, '${ep.question}<br>کامنت کن'],
      hook: hook,
      outPath: outPath,
      workDir: workDir,
    );
  }

  // ---------------------------------------------------------------- ساخت نهایی
  Future<void> runBuild(
    BuildSpec spec, {
    bool fast720 = false,
    ProgressCb? onProgress,
  }) async {
    final work = p.join(spec.workDir, 'build');
    if (Directory(work).existsSync()) Directory(work).deleteSync(recursive: true);
    Directory(work).createSync(recursive: true);
    Directory(p.dirname(spec.outPath)).createSync(recursive: true);

    // وزن پیشرفت: رندر اورلی + هر کلیپ (۲) + کارت پایانی (۱) + چسباندن (۴).
    final nClips = spec.clips.length;
    final totalW = 1 + nClips * 2 + 1 + 4;
    var doneW = 0;
    void prog(String step) =>
        onProgress?.call(doneW / totalW, step);

    // --- کارت پایانی را از قبل رندر کن.
    prog('ساخت زیرنویس‌ها و تیترها...');
    final endPng = p.join(work, 'end.png');
    await File(endPng)
        .writeAsBytes(await Overlays.endCard(spec.endLines[0], spec.endLines[1]));
    doneW += 1;
    prog('اورلی‌ها آماده شد');

    // --- پردازش هر کلیپ با فیلترهای editor.py
    final segs = <String>[];
    for (var i = 1; i <= nClips; i++) {
      prog('کلیپ $i از $nClips');
      final lst = await _renderClipOverlays(spec, i, work);
      final o = p.join(work, 'seg${_two(i)}.mp4');
      await _encodeSegment(spec.clips[i - 1], lst, o);
      segs.add(o);
      doneW += 2;
      prog('کلیپ $i از $nClips آماده شد');
    }

    // --- کارت پایانی (۲.۵ ثانیه با زوم آرام و صدای افت)
    prog('ساخت کارت پایانی...');
    final endMp4 = p.join(work, 'end.mp4');
    await ffmpeg.run([
      '-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-t', '2.5', '-i', endPng,
      '-f', 'lavfi', '-t', '2.5', '-i',
      'aevalsrc=0.9*sin(2*PI*(55-20*t)*t)*exp(-3.5*t):s=44100:c=stereo',
      '-filter_complex',
      "[0]scale=1188:2112,zoompan=z='1+0.04*on/75':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,fade=in:0:8,format=yuv420p[v]",
      '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-crf', '20',
      '-c:a', 'aac', '-ar', '44100', '-shortest', endMp4
    ]);
    segs.add(endMp4);
    doneW += 1;

    // --- چسباندن همه با xfade/acrossfade + نرمال‌سازی صدا
    prog('چسبوندن همه‌ی کلیپ‌ها (چند دقیقه طول می‌کشه)...');
    const x = 0.2;
    final durs = <double>[];
    for (final s in segs) {
      durs.add(await _duration(s));
    }
    final args = <String>['-v', 'error', '-y'];
    for (final s in segs) {
      args.addAll(['-i', s]);
    }
    var fc = '';
    var lv = '0:v';
    var la = '0:a';
    var off = 0.0;
    for (var k = 1; k < segs.length; k++) {
      off += durs[k - 1] - x;
      fc +=
          '[$lv][$k:v]xfade=transition=fade:duration=$x:offset=${off.toStringAsFixed(3)}[xv$k];[$la][$k:a]acrossfade=d=$x[xa$k];';
      lv = 'xv$k';
      la = 'xa$k';
    }
    // گزینه‌ی ۷۲۰p سریع برای گوشی: فقط مقیاس نهایی و پریست سریع‌تر.
    String vmap;
    if (fast720) {
      fc += '[$lv]scale=720:1280[vout];';
      vmap = '[vout]';
    } else {
      vmap = '[$lv]';
    }
    fc += '[$la]loudnorm=I=-14:TP=-1.5:LRA=11[aout]';
    final script = p.join(work, 'join.txt');
    await File(script).writeAsString(fc);

    // پیشرفت ریز هنگام چسباندن (از خروجی ffmpeg؛ out_time_us برحسب میکروثانیه).
    final totalSec = durs.fold<double>(0, (s, d) => s + d);
    void onErr(String chunk) {
      final m = RegExp(r'out_time_us=(\d+)').firstMatch(chunk) ??
          RegExp(r'out_time_ms=(\d+)').firstMatch(chunk);
      if (m != null && totalSec > 0) {
        final curSec = int.parse(m.group(1)!) / 1000000.0;
        final ratio = (curSec / totalSec).clamp(0.0, 1.0);
        final frac = (doneW + 4 * ratio) / totalW;
        onProgress?.call(frac.clamp(0.0, 1.0).toDouble(), 'چسبوندن کلیپ‌ها...');
      }
    }

    await ffmpeg.run([
      ...args, '-filter_complex_script', script, '-map', vmap, '-map', '[aout]',
      '-c:v', 'libx264', '-crf', fast720 ? '23' : '21',
      '-preset', fast720 ? 'veryfast' : 'medium',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart',
      spec.outPath
    ], onStderr: onErr);
    doneW += 4;
    onProgress?.call(1.0, 'تمام شد!');
  }

  /// اورلی‌های یک کلیپ را رندر و روی دیسک می‌نویسد؛ ترتیب دقیقاً مثل editor.py:
  /// شروع تند (فقط کلیپ ۱) ← تیتر (فقط کلیپ تیتر) ← برچسب ← زیرنویس‌ها.
  Future<List<_Ov>> _renderClipOverlays(
      BuildSpec spec, int ci, String work) async {
    final lst = <_Ov>[];
    Future<void> add(double s, double e, Uint8List png) async {
      final path = p.join(work, 'ov_${ci}_${lst.length}.png');
      await File(path).writeAsBytes(png);
      lst.add(_Ov(s, e, path));
    }

    if (ci == 1 && spec.hook != null && spec.hook!.isNotEmpty) {
      await add(0, 3.0, await Overlays.hook(spec.hook!));
    }
    if (ci == spec.titleClip) {
      await add(0, 2.6, await Overlays.title(spec.ep, spec.title));
    }
    final label = spec.labels[ci];
    if (label != null) {
      await add(label.s, label.e, await Overlays.label(label.a, label.b));
    }
    final subs = spec.subs[ci];
    if (subs != null) {
      for (final line in subs) {
        await add(line.start, line.end, await Overlays.subtitle(line.text));
      }
    }
    return lst;
  }

  /// یک کلیپ را با اورلی‌هایش پردازش می‌کند (فیلترهای عیناً editor.py).
  Future<void> _encodeSegment(String clip, List<_Ov> lst, String out) async {
    final args = <String>['-v', 'error', '-y', '-i', clip];
    for (final o in lst) {
      args.addAll(['-i', o.png]);
    }
    final aud = await _hasAudio(clip);
    if (!aud) {
      args.addAll(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']);
    }
    var fc =
        '[0:v]crop=iw/1.04:ih/1.04,scale=1080:1920:flags=lanczos,unsharp=5:5:0.6,eq=contrast=1.06:saturation=1.08:brightness=0.01,fps=30,setsar=1[v0]';
    var last = 'v0';
    for (var k = 0; k < lst.length; k++) {
      final o = lst[k];
      fc +=
          ";[$last][${k + 1}:v]overlay=0:0:enable='between(t,${_num(o.s)},${_num(o.e)})'[v${k + 1}]";
      last = 'v${k + 1}';
    }
    fc += ';[$last]format=yuv420p[vo]';
    final ain = aud ? '0:a' : '${lst.length + 1}:a';
    fc += ';[$ain]aresample=44100,aformat=channel_layouts=stereo[ao]';
    await ffmpeg.run([
      ...args, '-filter_complex', fc, '-map', '[vo]', '-map', '[ao]',
      '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-b:a', '192k',
      '-ar', '44100', '-shortest', out
    ]);
  }

  /// پیش‌نمایش یک کلیپ با اورلی‌هایش (برای ویرایشگر زیرنویس، بدون xfade/نرمال‌سازی).
  Future<String> previewClip(BuildSpec spec, int clipIndex) async {
    final work = p.join(spec.workDir, 'preview');
    Directory(work).createSync(recursive: true);
    final lst = await _renderClipOverlays(spec, clipIndex, work);
    final out = p.join(work, 'preview_$clipIndex.mp4');
    await _encodeSegment(spec.clips[clipIndex - 1], lst, out);
    return out;
  }

  // ---------------------------------------------------------------- کمک‌ها
  static String _two(int i) => i.toString().padLeft(2, '0');
  static double _max0(double x) => x < 0 ? 0.0 : x;

  /// فرمت عدد برای عبارت‌های ffmpeg (عدد صحیح بدون اعشار).
  static String _num(double v) {
    if (v == v.roundToDouble()) return v.toInt().toString();
    return v.toString();
  }
}
