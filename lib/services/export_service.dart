/// خروجی گرفتن: اندروید -> ذخیره در Movies/MafiaGhab + اشتراک (اینستاگرام)،
/// ویندوز/دسکتاپ -> کپی به پوشه‌ی انتخابی کاربر.
library;

import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';

class ExportResult {
  final bool ok;
  final String message;
  final String? savedPath;
  const ExportResult(this.ok, this.message, {this.savedPath});
}

class ExportService {
  /// اندروید: کپی به Movies/MafiaGhab (در صورت امکان).
  Future<ExportResult> saveToMovies(String outPath) async {
    if (!Platform.isAndroid) {
      return const ExportResult(false, 'فقط روی اندروید');
    }
    try {
      // اندروید ۱۳+ : دسترسی ویدیو؛ قدیمی‌تر: دسترسی حافظه.
      await Permission.videos.request();
      await Permission.storage.request();
      final dir = Directory('/storage/emulated/0/Movies/MafiaGhab');
      dir.createSync(recursive: true);
      final dst = p.join(dir.path, p.basename(outPath));
      File(outPath).copySync(dst);
      return ExportResult(true, 'ذخیره شد در Movies/MafiaGhab', savedPath: dst);
    } catch (e) {
      return ExportResult(false, 'ذخیره در گالری نشد: $e');
    }
  }

  /// اشتراک‌گذاری (برای فرستادن به اینستاگرام).
  Future<void> share(String outPath) async {
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(outPath)],
        text: 'مافیای قاب',
      ),
    );
  }

  /// دسکتاپ/ویندوز: انتخاب پوشه و کپی فایل.
  Future<ExportResult> saveToFolder(String outPath) async {
    final dir = await FilePickerPlatform.instance.getDirectoryPath(
      dialogTitle: 'پوشه‌ی ذخیره را انتخاب کن',
    );
    if (dir == null) return const ExportResult(false, 'لغو شد');
    try {
      final dst = p.join(dir, p.basename(outPath));
      File(outPath).copySync(dst);
      return ExportResult(true, 'ذخیره شد: $dst', savedPath: dst);
    } catch (e) {
      return ExportResult(false, 'ذخیره نشد: $e');
    }
  }
}
