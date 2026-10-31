/// پورت دقیق تشخیص گفتار (Energy VAD) از editor.py -> speech().
///
/// منطق عیناً مثل پایتون است: فریم ۲۰ms (۳۲۰ نمونه در ۱۶kHz)، RMS + ۱،
/// تبدیل به دسی‌بل، آستانه‌ی floor(۱۵٪) + ۰.۴۵×(peak(۹۷٪)−floor)،
/// ادغام شکاف‌های کوچک‌تر از ۰.۳ ثانیه، حذف قطعات کوتاه‌تر از ۰.۲ ثانیه.
library;

import 'dart:math' as math;
import 'dart:typed_data';

class Vad {
  /// تعداد نمونه‌های هر فریم (۲۰ms در ۱۶kHz).
  static const int frame = 320;

  /// ورودی: بایت‌های خام PCM با فرمت 16kHz mono s16le (همان چیزی که
  /// `ffmpeg -ac 1 -ar 16000 -f s16le -` تولید می‌کند).
  /// خروجی: لیستی از [start, end] به ثانیه.
  static List<List<double>> speechFromPcm(Uint8List raw) {
    final count = raw.lengthInBytes ~/ 2;
    final bd = raw.buffer.asByteData(raw.offsetInBytes, count * 2);
    final n = count ~/ frame;
    if (n < 5) return <List<double>>[];

    // انرژی RMS هر فریم + ۱، سپس دسی‌بل.
    final db = List<double>.filled(n, 0);
    for (var i = 0; i < n; i++) {
      double sumsq = 0;
      final base = i * frame;
      for (var k = 0; k < frame; k++) {
        final v = bd.getInt16((base + k) * 2, Endian.little).toDouble();
        sumsq += v * v;
      }
      final e = math.sqrt(sumsq / frame) + 1.0;
      db[i] = 20.0 * (math.log(e) / math.ln10);
    }

    final floor = _percentile(db, 15);
    final peak = _percentile(db, 97);
    final thr = floor + 0.45 * (peak - floor);

    // گروه‌بندی فریم‌های روشن.
    final s = <List<double>>[];
    var i = 0;
    while (i < n) {
      if (db[i] > thr) {
        var j = i;
        while (j < n && db[j] > thr) {
          j++;
        }
        s.add([i * 0.02, j * 0.02]);
        i = j;
      } else {
        i++;
      }
    }

    // ادغام شکاف‌های کوچک‌تر از ۰.۳ ثانیه.
    final m = <List<double>>[];
    for (final seg in s) {
      if (m.isNotEmpty && seg[0] - m.last[1] < 0.3) {
        m.last[1] = seg[1];
      } else {
        m.add([seg[0], seg[1]]);
      }
    }

    // حذف قطعات کوتاه‌تر از ۰.۲ ثانیه.
    return [
      for (final seg in m)
        if (seg[1] - seg[0] >= 0.2) [seg[0], seg[1]],
    ];
  }

  /// معادل numpy.percentile با روش خطی (type 7) — دقیقاً مثل پایتون.
  static double _percentile(List<double> data, double q) {
    final a = List<double>.of(data)..sort();
    final n = a.length;
    if (n == 0) return 0;
    if (n == 1) return a[0];
    final rank = (q / 100.0) * (n - 1);
    final lo = rank.floor();
    if (lo + 1 >= n) return a[n - 1];
    final frac = rank - lo;
    return a[lo] + frac * (a[lo + 1] - a[lo]);
  }
}
