/// مدل پروژه‌ی یک قسمت — برای ذخیره‌ی خودکار (ادامه دادن بعداً) و بازاستفاده‌ی
/// کلیپ‌ها در «قسمت قبل...».
library;

import '../services/subtitle/subtitle_timing.dart';

/// انتساب یک ویدیو به یک صحنه، با امکان برش دلخواه.
class ClipAssignment {
  /// مسیر ویدیوی کپی‌شده در فضای برنامه.
  String path;

  /// برش دلخواه (ثانیه). اگر null باشد، کل کلیپ استفاده می‌شود (مثل editor.py).
  double? trimStart;
  double? trimEnd;

  ClipAssignment(this.path, {this.trimStart, this.trimEnd});

  bool get hasTrim => trimStart != null || trimEnd != null;

  Map<String, dynamic> toJson() => {
        'path': path,
        if (trimStart != null) 'trimStart': trimStart,
        if (trimEnd != null) 'trimEnd': trimEnd,
      };

  factory ClipAssignment.fromJson(Map<String, dynamic> j) => ClipAssignment(
        j['path'] as String,
        trimStart: (j['trimStart'] as num?)?.toDouble(),
        trimEnd: (j['trimEnd'] as num?)?.toDouble(),
      );
}

/// پروژه‌ی یک قسمت: کدام ویدیو برای کدام صحنه، تنظیمات، و زیرنویس‌های ویرایش‌شده.
class EpisodeProject {
  final int season;
  final String seasonFile;
  final int episode;

  /// شماره‌ی صحنه -> ویدیو.
  Map<int, ClipAssignment> clips;

  /// خروجی ۷۲۰p سریع برای گوشی.
  bool fast720;

  /// زیرنویس‌های ویرایش‌شده بعد از زمان‌بندی خودکار (فاز ۲): شماره‌ی کلیپ -> خطوط.
  Map<int, List<SubLine>>? editedSubs;

  /// برچسب‌های ویرایش‌شده (اختیاری، فاز ۲).
  Map<int, List<dynamic>>? editedLabels;

  String? lastOutputPath;
  DateTime updatedAt;

  EpisodeProject({
    required this.season,
    required this.seasonFile,
    required this.episode,
    Map<int, ClipAssignment>? clips,
    this.fast720 = false,
    this.editedSubs,
    this.editedLabels,
    this.lastOutputPath,
    DateTime? updatedAt,
  })  : clips = clips ?? {},
        updatedAt = updatedAt ?? DateTime.now();

  int get assignedCount => clips.length;

  Map<String, dynamic> toJson() => {
        'season': season,
        'seasonFile': seasonFile,
        'episode': episode,
        'clips': clips.map((k, v) => MapEntry(k.toString(), v.toJson())),
        'fast720': fast720,
        'editedSubs': editedSubs?.map((k, v) =>
            MapEntry(k.toString(), v.map((s) => s.toJson()).toList())),
        'lastOutputPath': lastOutputPath,
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory EpisodeProject.fromJson(Map<String, dynamic> j) => EpisodeProject(
        season: j['season'] as int,
        seasonFile: (j['seasonFile'] ?? 'season1.json') as String,
        episode: j['episode'] as int,
        clips: (j['clips'] as Map<String, dynamic>? ?? {}).map(
            (k, v) => MapEntry(
                int.parse(k), ClipAssignment.fromJson(v as Map<String, dynamic>))),
        fast720: (j['fast720'] ?? false) as bool,
        editedSubs: (j['editedSubs'] as Map<String, dynamic>?)?.map((k, v) =>
            MapEntry(int.parse(k),
                (v as List).map((e) => SubLine.fromJson(e as List)).toList())),
        lastOutputPath: j['lastOutputPath'] as String?,
        updatedAt: DateTime.tryParse((j['updatedAt'] ?? '') as String) ??
            DateTime.now(),
      );
}
