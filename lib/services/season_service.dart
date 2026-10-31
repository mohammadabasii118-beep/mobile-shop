/// بارگذاری فصل‌ها: season1.json باندل‌شده + فایل‌های seasonN.json واردشده.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;

import '../models/season.dart';
import 'app_paths.dart';

class SeasonService {
  /// فصل باندل‌شده با برنامه.
  Future<SeasonData> loadBundled() async {
    final raw = await rootBundle.loadString('assets/season1.json');
    return SeasonData.fromJson(
        jsonDecode(raw) as Map<String, dynamic>, sourceName: 'season1.json (داخلی)');
  }

  /// همه‌ی فصل‌ها: باندل‌شده + واردشده. اگر فصلی با همان شماره وارد شده باشد،
  /// نسخه‌ی واردشده جایگزین نسخه‌ی داخلی می‌شود. خروجی بر اساس شماره مرتب است.
  Future<List<SeasonData>> loadAll() async {
    final bySeason = <int, SeasonData>{};
    final bundled = await loadBundled();
    bySeason[bundled.season] = bundled;

    final dir = await AppPaths.seasonsDir();
    for (final f in dir.listSync().whereType<File>()) {
      if (!f.path.toLowerCase().endsWith('.json')) continue;
      try {
        final s = SeasonData.fromJson(
            jsonDecode(f.readAsStringSync()) as Map<String, dynamic>,
            sourceName: p.basename(f.path));
        bySeason[s.season] = s; // جایگزینی نسخه‌ی داخلی در صورت وجود
      } catch (_) {/* فایل خراب را رد کن */}
    }

    final out = bySeason.values.toList()
      ..sort((a, b) => a.season.compareTo(b.season));
    return out;
  }

  /// وارد کردن یک فایل فصل جدید (کپی به پوشه‌ی فصل‌ها) و برگرداندن آن.
  Future<SeasonData> importSeasonFile(String srcPath) async {
    final src = File(srcPath);
    final data = SeasonData.fromJson(
        jsonDecode(src.readAsStringSync()) as Map<String, dynamic>,
        sourceName: p.basename(srcPath));
    final dir = await AppPaths.seasonsDir();
    final dst = File(p.join(dir.path, 'season${data.season}.json'));
    src.copySync(dst.path);
    return data;
  }
}
