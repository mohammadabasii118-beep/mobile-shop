/// رندر اورلی‌ها (زیرنویس، تیتر، برچسب، شروع تند، کارت پایانی) به‌صورت
/// PNG شفافِ ۱۰۸۰×۱۹۲۰ با canvas فلاتر (PictureRecorder + TextPainter، RTL)،
/// مطابق موقعیت/اندازه/رنگ CSS در editor.py.
///
/// هر تابع یک تصویرِ تمام‌قابِ ۱۰۸۰×۱۹۲۰ می‌سازد که فقط همان یک المان را
/// دارد — دقیقاً مثل تابع add() در editor.py که برای هر اورلی یک PNG می‌ساخت.
library;

import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

class Overlays {
  static const double w = 1080;
  static const double h = 1920;

  // رنگ‌ها، دقیقاً مطابق CSS.
  static const Color gold = Color(0xFFE2B04A); // #e2b04a
  static const Color white = Color(0xFFFFFFFF);
  static const Color subBg = Color(0x8C000000); // rgba(0,0,0,.55)
  static const Color endBase = Color(0xFF0B0908); // #0b0908
  static const Color endQuestion = Color(0xFFCFC3AE); // #cfc3ae
  static const Color endCase = Color(0xFF8D8577); // #8d8577

  static const String _fontV = 'Vazirmatn';
  static const String _fontL = 'Lalezar';

  /// ارقام فارسی (مثل FA در editor.py).
  static String faDigits(Object n) {
    const en = '0123456789';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    return n.toString().split('').map((c) {
      final i = en.indexOf(c);
      return i < 0 ? c : fa[i];
    }).join();
  }

  static List<Shadow> _shadows(List<List<double>> specs) => [
        for (final s in specs)
          Shadow(
            color: Color.fromRGBO(0, 0, 0, s[3]),
            offset: Offset(s[0], s[1]),
            blurRadius: s[2],
          ),
      ];

  static TextStyle _v(double size, int weight,
          {Color color = white, double? height, List<Shadow>? shadows}) =>
      TextStyle(
        fontFamily: _fontV,
        fontSize: size,
        height: height,
        color: color,
        fontWeight: _fw(weight),
        fontVariations: [FontVariation('wght', weight.toDouble())],
        shadows: shadows,
      );

  static TextStyle _l(double size,
          {Color color = white, double? height, List<Shadow>? shadows}) =>
      TextStyle(
        fontFamily: _fontL,
        fontSize: size,
        height: height,
        color: color,
        shadows: shadows,
      );

  static FontWeight _fw(int w) {
    const map = {
      100: FontWeight.w100,
      200: FontWeight.w200,
      300: FontWeight.w300,
      400: FontWeight.w400,
      500: FontWeight.w500,
      600: FontWeight.w600,
      700: FontWeight.w700,
      800: FontWeight.w800,
      900: FontWeight.w900,
    };
    return map[w] ?? FontWeight.w400;
  }

  static TextPainter _painter(InlineSpan span, double maxWidth,
      {TextAlign align = TextAlign.center}) {
    final tp = TextPainter(
      text: span,
      textDirection: TextDirection.rtl,
      textAlign: align,
    )..layout(maxWidth: maxWidth);
    return tp;
  }

  static Future<Uint8List> _png(void Function(ui.Canvas) draw,
      {Color? background}) async {
    final rec = ui.PictureRecorder();
    final canvas = ui.Canvas(rec, const Rect.fromLTWH(0, 0, w, h));
    if (background != null) {
      canvas.drawRect(
          const Rect.fromLTWH(0, 0, w, h), Paint()..color = background);
    }
    draw(canvas);
    final pic = rec.endRecording();
    final img = await pic.toImage(w.toInt(), h.toInt());
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    img.dispose();
    pic.dispose();
    return data!.buffer.asUint8List();
  }

  // ---------------------------------------------------------------- زیرنویس
  /// .sub: left:90 width:780 top:1180 (وسطِ باکس = x۴۸۰)، Vazirmatn 800 54px،
  /// پس‌زمینه‌ی rgba(0,0,0,.55)، padding 10/26، گوشه‌ی ۱۴.
  static Future<Uint8List> subtitle(String text) {
    return _png((canvas) {
      const boxLeft = 90.0, boxWidth = 780.0;
      const padX = 26.0, padY = 10.0, radius = 14.0;
      const contentMax = boxWidth - padX * 2; // 728
      final style = _v(54, 800,
          height: 1.5,
          shadows: _shadows([
            [0, 2, 6, 0.8]
          ]));
      final tp = _painter(TextSpan(text: text, style: style), contentMax);
      final centerX = boxLeft + boxWidth / 2; // 480
      final bgW = tp.width + padX * 2;
      final bgH = tp.height + padY * 2;
      final left = centerX - bgW / 2;
      const top = 1180.0;
      final rrect = RRect.fromRectAndRadius(
          Rect.fromLTWH(left, top, bgW, bgH), const Radius.circular(radius));
      canvas.drawRRect(rrect, Paint()..color = subBg);
      tp.paint(canvas, Offset(left + padX, top + padY));
    });
  }

  // ---------------------------------------------------------------- تیتر قسمت
  /// .tt (روی .c: left:60 right:60، وسط x۵۴۰) top:300. دو خط:
  /// «مافیای قاب» Lalezar 150 طلایی، «قسمت N · title» Lalezar 70 سفید.
  static Future<Uint8List> title(int episode, String episodeTitle) {
    return _png((canvas) {
      const top = 300.0;
      const maxW = 960.0; // 1080 - 60 - 60
      final a = _painter(
        TextSpan(
          text: 'مافیای قاب',
          style: _l(150,
              color: gold,
              height: 1.1,
              shadows: _shadows([
                [0, 6, 30, 0.95]
              ])),
        ),
        maxW,
      );
      final b = _painter(
        TextSpan(
          text: 'قسمت ${faDigits(episode)} · $episodeTitle',
          style: _l(70,
              color: white,
              shadows: _shadows([
                [0, 4, 20, 0.95]
              ])),
        ),
        maxW,
      );
      _paintCentered(canvas, a, 60, maxW, top);
      _paintCentered(canvas, b, 60, maxW, top + a.height);
    });
  }

  // ---------------------------------------------------------------- برچسب مکان
  /// .lab top:620 (وسط x۵۴۰). .a Lalezar 96 طلایی، .b Vazirmatn 700 46 سفید.
  static Future<Uint8List> label(String lineA, String lineB) {
    return _png((canvas) {
      const top = 620.0;
      const maxW = 960.0;
      final a = _painter(
        TextSpan(
          text: lineA,
          style: _l(96,
              color: gold,
              shadows: _shadows([
                [0, 4, 18, 0.9]
              ])),
        ),
        maxW,
      );
      _paintCentered(canvas, a, 60, maxW, top);
      if (lineB.isNotEmpty) {
        final b = _painter(
          TextSpan(
            text: lineB,
            style: _v(46, 700,
                color: white,
                shadows: _shadows([
                  [0, 2, 10, 0.9]
                ])),
          ),
          maxW,
        );
        _paintCentered(canvas, b, 60, maxW, top + a.height);
      }
    });
  }

  // ---------------------------------------------------------------- شروع تند
  /// .hook top:330 Lalezar 92 سفید، [[...]] -> طلایی.
  static Future<Uint8List> hook(String raw) {
    return _png((canvas) {
      const top = 330.0;
      const maxW = 960.0;
      final span = _boldSpan(
        raw,
        base: _l(92,
            color: white,
            height: 1.25,
            shadows: _shadows([
              [0, 4, 24, 0.9]
            ])),
        bold: _l(92,
            color: gold,
            height: 1.25,
            shadows: _shadows([
              [0, 4, 24, 0.9]
            ])),
      );
      final tp = _painter(span, maxW);
      _paintCentered(canvas, tp, 60, maxW, top);
    });
  }

  // ---------------------------------------------------------------- کارت پایانی
  /// .full: پس‌زمینه‌ی تیره + گرادیان شعاعی، «ادامه دارد...»/«پایان فصل اول»
  /// طلایی 170، خط جداکننده، سؤال 52، و CASE LINE پایین.
  static Future<Uint8List> endCard(String line1, String line2WithBr) {
    return _png((canvas) {
      // گرادیان شعاعی بیضوی: ellipse 70% 45% at 50% 52%.
      final center = Offset(w / 2, 0.52 * h);
      const rx = 0.70 * w; // 756
      const ry = 0.45 * h; // 864
      // تبدیلِ «مقیاس عمودی حول مرکز» تا دایره به بیضی تبدیل شود
      // (معادلِ ellipse در CSS)، به‌صورت ماتریس ۴×۴ ستون‌محور.
      const sy = ry / rx;
      final matrix = Float64List(16)
        ..[0] = 1.0
        ..[5] = sy
        ..[10] = 1.0
        ..[15] = 1.0
        ..[13] = center.dy * (1 - sy);
      final shader = ui.Gradient.radial(
        center,
        rx,
        const [
          Color(0x73964614), // rgba(150,70,20,.45)
          Color(0x263C140A), // rgba(60,20,10,.15)
          Color(0x00000000), // transparent
        ],
        const [0.0, 0.55, 0.75],
        TileMode.clamp,
        matrix,
      );
      canvas.drawRect(
          const Rect.fromLTWH(0, 0, w, h), Paint()..shader = shader);

      // گروهِ مرکزی: عنوان + خط + سؤال، به‌صورت عمودی وسط‌چین.
      final t = _painter(
        TextSpan(
          text: line1,
          style: _l(170,
              color: gold,
              shadows: _shadows([
                [0, 6, 40, 0.5]
              ])),
        ),
        960,
      );
      const lineW = 360.0, lineH = 4.0, gap = 36.0;
      final kLines = line2WithBr.split('<br>');
      final kPainters = [
        for (final l in kLines)
          _painter(
            TextSpan(
                text: l, style: _v(52, 700, color: endQuestion, height: 1.6)),
            900,
          ),
      ];
      final kHeight = kPainters.fold<double>(0, (s, p) => s + p.height);
      final totalH = t.height + gap + lineH + gap + kHeight;
      var y = (h - totalH) / 2;
      _paintCentered(canvas, t, 0, w, y);
      y += t.height + gap;
      final lineRect =
          Rect.fromLTWH(w / 2 - lineW / 2, y, lineW, lineH);
      final lineShader = ui.Gradient.linear(
        Offset(lineRect.left, 0),
        Offset(lineRect.right, 0),
        const [Color(0x00E2B04A), gold, Color(0x00E2B04A)],
        const [0.0, 0.5, 1.0],
      );
      canvas.drawRect(lineRect, Paint()..shader = lineShader);
      y += lineH + gap;
      for (final p in kPainters) {
        _paintCentered(canvas, p, 0, w, y);
        y += p.height;
      }

      // CASE LINE، پایین، letter-spacing 10.
      final br = _painter(
        TextSpan(
          text: 'CASE LINE',
          style: _v(40, 800, color: endCase).copyWith(letterSpacing: 10),
        ),
        960,
      );
      _paintCentered(canvas, br, 0, w, h - 170 - br.height);
    }, background: endBase);
  }

  // ---------------------------------------------------------------- کمک‌ها
  static void _paintCentered(
      ui.Canvas canvas, TextPainter tp, double left, double width, double top) {
    final x = left + (width - tp.width) / 2;
    tp.paint(canvas, Offset(x, top));
  }

  /// متن با [[...]] را به TextSpan با بخش‌های طلایی تبدیل می‌کند.
  static InlineSpan _boldSpan(String raw,
      {required TextStyle base, required TextStyle bold}) {
    final children = <TextSpan>[];
    var i = 0;
    while (i < raw.length) {
      final open = raw.indexOf('[[', i);
      if (open < 0) {
        children.add(TextSpan(text: raw.substring(i), style: base));
        break;
      }
      if (open > i) {
        children.add(TextSpan(text: raw.substring(i, open), style: base));
      }
      final close = raw.indexOf(']]', open + 2);
      if (close < 0) {
        children.add(TextSpan(text: raw.substring(open), style: base));
        break;
      }
      children.add(
          TextSpan(text: raw.substring(open + 2, close), style: bold));
      i = close + 2;
    }
    return TextSpan(children: children);
  }
}
