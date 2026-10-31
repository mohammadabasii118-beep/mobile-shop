import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mafia_ghab_editor/services/subtitle/vad.dart';
import 'package:mafia_ghab_editor/services/subtitle/subtitle_timing.dart';

/// این تست خروجی پورت Dart را عدد‌به‌عدد با خروجی مرجعِ editor.py
/// (ref_out.json) و بایت‌های خام test1.pcm مقایسه می‌کند.
void main() {
  final ref = jsonDecode(
    File('test/fixtures/ref_out.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  test('Vad.speechFromPcm matches editor.py speech()', () {
    final pcm = File('test/fixtures/test1.pcm').readAsBytesSync();
    final segs = Vad.speechFromPcm(pcm);
    final expected = (ref['speech_segments'] as List)
        .map((e) => (e as List).map((x) => (x as num).toDouble()).toList())
        .toList();
    expect(segs.length, expected.length, reason: 'تعداد قطعات گفتار');
    for (var i = 0; i < segs.length; i++) {
      expect(segs[i][0], closeTo(expected[i][0], 1e-9), reason: 'start $i');
      expect(segs[i][1], closeTo(expected[i][1], 1e-9), reason: 'end $i');
    }
  });

  test('SubtitleTiming.splitText matches editor.py split_text()', () {
    final cases = ref['split_text'] as Map<String, dynamic>;
    cases.forEach((text, exp) {
      final expected = (exp as List).map((e) => e as String).toList();
      final got = SubtitleTiming.splitText(text);
      expect(got, expected, reason: 'split_text روی: $text');
    });
  });

  test('SubtitleTiming.timedSubs matches editor.py timed_subs()', () {
    // مدت و قطعات گفتار همان test1.mp4 است (۶ ثانیه، همان segments مرجع).
    const duration = 6.0;
    final speech = (ref['speech_segments'] as List)
        .map((e) => (e as List).map((x) => (x as num).toDouble()).toList())
        .toList();
    final cases = ref['timed_subs_test1'] as Map<String, dynamic>;
    cases.forEach((text, exp) {
      final expected = exp as List;
      final got = SubtitleTiming.timedSubs(
        duration: duration,
        speech: speech,
        text: text,
      );
      expect(got.length, expected.length, reason: 'تعداد خطوط: $text');
      for (var i = 0; i < got.length; i++) {
        final e = expected[i] as List;
        expect(got[i].start, closeTo((e[0] as num).toDouble(), 1e-9),
            reason: 'start خط $i در: $text');
        expect(got[i].end, closeTo((e[1] as num).toDouble(), 1e-9),
            reason: 'end خط $i در: $text');
        expect(got[i].text, e[2] as String, reason: 'متن خط $i در: $text');
      }
    });
  });
}
