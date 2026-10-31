/// پورت دقیق تقسیم متن و زمان‌بندی زیرنویس از editor.py
/// -> split_text() و timed_subs().
library;

import 'dart:math' as math;

/// یک خط زیرنویس زمان‌بندی‌شده.
class SubLine {
  double start;
  double end;
  String text;
  SubLine(this.start, this.end, this.text);

  SubLine copy() => SubLine(start, end, text);

  List<dynamic> toJson() => [start, end, text];

  factory SubLine.fromJson(List<dynamic> j) =>
      SubLine((j[0] as num).toDouble(), (j[1] as num).toDouble(), j[2] as String);
}

class SubtitleTiming {
  /// گرد کردن به ۲ رقم اعشار، سازگار با round() پایتون (half-to-even).
  static double round2(double v) {
    if (v.isNaN || v.isInfinite) return v;
    final neg = v < 0;
    final x = neg ? -v : v;
    final scaled = x * 100.0;
    final fl = scaled.floorToDouble();
    final diff = scaled - fl;
    double rounded;
    const eps = 1e-9;
    if ((diff - 0.5).abs() < eps) {
      // دقیقاً وسط: گرد به زوج.
      rounded = (fl.toInt() % 2 == 0) ? fl : fl + 1.0;
    } else if (diff > 0.5) {
      rounded = fl + 1.0;
    } else {
      rounded = fl;
    }
    final res = rounded / 100.0;
    return neg ? -res : res;
  }

  /// طول بر حسب کد-پوینت (معادل len() پایتون روی رشته‌ی یونیکد).
  static int _cpLen(String s) => s.runes.length;

  static final RegExp _sentence = RegExp(r'[^.!?؟…]+[.!?؟…]*');

  /// پورت split_text: متن را به خطوط مناسب زیرنویس می‌شکند.
  static List<String> splitText(String t) {
    final parts = <String>[];
    for (final mch in _sentence.allMatches(t)) {
      final p = mch.group(0)!.trim();
      if (p.isNotEmpty) parts.add(p);
    }

    final out = <String>[];
    var carry = '';
    for (var p in parts) {
      p = carry.isNotEmpty ? '$carry $p'.trim() : p;
      carry = '';
      if (_cpLen(p) < 9) {
        carry = p;
      } else {
        out.add(p);
      }
    }
    if (carry.isNotEmpty) {
      if (out.isNotEmpty) {
        out[out.length - 1] = '${out.last} $carry';
      } else {
        out.add(carry);
      }
    }

    final finalLines = <String>[];
    for (final p in out) {
      if (_cpLen(p) > 46) {
        final runes = p.runes.toList();
        final mid = runes.length ~/ 2;
        int? best;
        var bestDist = 1 << 30;
        for (var i = 0; i < runes.length; i++) {
          final ch = runes[i];
          // عضویت در مجموعه‌ی '،, ' : ویرگول فارسی، ویرگول لاتین، فاصله.
          if (ch == 0x060C || ch == 0x002C || ch == 0x0020) {
            final d = (i - mid).abs();
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          }
        }
        final cut = best ?? mid;
        final left = String.fromCharCodes(runes.sublist(0, cut + 1)).trim();
        final right = String.fromCharCodes(runes.sublist(cut + 1)).trim();
        finalLines.add(left);
        finalLines.add(right);
      } else {
        finalLines.add(p);
      }
    }

    final res = [for (final f in finalLines) if (f.isNotEmpty) f];
    return res.isNotEmpty ? res : [t];
  }

  /// پورت timed_subs: با داشتن مدت کلیپ و قطعات گفتار، زمان هر خط را می‌سازد.
  /// [speech] خروجی Vad.speechFromPcm است.
  static List<SubLine> timedSubs({
    required double duration,
    required List<List<double>> speech,
    required String text,
  }) {
    final d = duration;
    final sg = speech;
    double a, b;
    if (sg.isNotEmpty) {
      a = math.max(0.0, sg.first[0] - 0.1);
      b = math.min(d - 0.05, sg.last[1] + 0.25);
    } else {
      a = 0.5;
      b = d - 0.5;
    }

    final lines = splitText(text);
    if (lines.length == 1) {
      return [SubLine(round2(a), round2(b), lines[0])];
    }

    final total = lines.fold<int>(0, (s, l) => s + _cpLen(l));
    final res = <SubLine>[];
    var t = a;
    for (var k = 0; k < lines.length; k++) {
      final l = lines[k];
      final e = (k == lines.length - 1)
          ? b
          : t + (b - a) * _cpLen(l) / total;
      if (k > 0 && sg.isNotEmpty) {
        // نزدیک‌ترین شروعِ گفتار به t.
        var near = sg.first[0];
        var nd = (near - t).abs();
        for (final seg in sg) {
          final dd = (seg[0] - t).abs();
          if (dd < nd) {
            nd = dd;
            near = seg[0];
          }
        }
        final prevStart = res.last.start;
        if ((near - t).abs() < 0.6 &&
            near - prevStart > 0.7 &&
            e - near > 0.7) {
          t = near;
          res.last.end = round2(t - 0.05);
        }
      }
      res.add(SubLine(round2(t), round2(e), l));
      t = e;
    }
    return res;
  }
}
