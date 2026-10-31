/// مسیرهای ذخیره‌سازی برنامه (پروژه‌ها، فصل‌های واردشده، کلیپ‌ها، خروجی).
library;

import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class AppPaths {
  static Directory? _root;

  /// ریشه‌ی داده‌های برنامه: پوشه‌ی Documents برنامه، زیرپوشه‌ی MafiaGhab.
  static Future<Directory> root() async {
    if (_root != null) return _root!;
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(docs.path, 'MafiaGhab'));
    dir.createSync(recursive: true);
    _root = dir;
    return dir;
  }

  static Future<Directory> _sub(String name) async {
    final r = await root();
    final d = Directory(p.join(r.path, name));
    d.createSync(recursive: true);
    return d;
  }

  static Future<Directory> projectsDir() => _sub('projects');
  static Future<Directory> seasonsDir() => _sub('seasons');
  static Future<Directory> outputDir() => _sub('output');
  static Future<Directory> tmpDir() => _sub('tmp');

  static Future<Directory> clipsDir(int season, int episode) =>
      _sub(p.join('clips', 's${season}e$episode'));

  static Future<Directory> workDir(int season, int episode) =>
      _sub(p.join('work', 's${season}e$episode'));
}
