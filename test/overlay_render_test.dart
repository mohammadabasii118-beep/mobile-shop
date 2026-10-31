import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mafia_ghab_editor/services/overlay_renderer.dart';

/// رندر اورلی‌ها را اجرا می‌کند، PNGها را ذخیره می‌کند و اندازه/سلامت را می‌سنجد.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const outDir =
      '/tmp/claude-0/-home-user-mobile-shop/496828b0-e757-5650-a637-7831624ec6c6/scratchpad/overlays';

  setUpAll(() async {
    Directory(outDir).createSync(recursive: true);
    final v = File('assets/fonts/Vazirmatn[wght].ttf').readAsBytesSync();
    final l = File('assets/fonts/Lalezar-Regular.ttf').readAsBytesSync();
    final lv = FontLoader('Vazirmatn')
      ..addFont(Future.value(ByteData.view(v.buffer)));
    final ll = FontLoader('Lalezar')
      ..addFont(Future.value(ByteData.view(l.buffer)));
    await lv.load();
    await ll.load();
  });

  Future<void> save(String name, List<int> bytes) async {
    expect(bytes.isNotEmpty, true, reason: '$name نباید خالی باشد');
    File('$outDir/$name').writeAsBytesSync(bytes);
  }

  test('render subtitle', () async {
    await save('sub.png', await Overlays.subtitle('حروم‌ک*ن! مادر منو وسط می‌کشی؟!'));
  });

  test('render title', () async {
    await save('title.png', await Overlays.title(5, 'گمرک'));
  });

  test('render label', () async {
    await save('label_story.png', await Overlays.label('گمرک بندرعباس', ''));
    await save('label_recap.png', await Overlays.label('قسمت قبل...', 'مافیای قاب'));
  });

  test('render end card', () async {
    await save(
      'end.png',
      await Overlays.endCard('ادامه دارد...', 'به نظرت کی پشت دره؟<br>کامنت کن'),
    );
  });
}
