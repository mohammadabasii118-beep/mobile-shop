/// ذخیره/بازخوانی خودکار پروژه‌ها و مدیریت کلیپ‌های کپی‌شده (برای ادامه‌ی کار
/// و بازاستفاده در «قسمت قبل...»).
library;

import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

import '../models/project.dart';
import 'app_paths.dart';

class ProjectStore {
  String _projFile(Directory dir, int season, int episode) =>
      p.join(dir.path, 's${season}e$episode.json');

  /// ذخیره‌ی خودکار پروژه.
  Future<void> save(EpisodeProject project) async {
    project.updatedAt = DateTime.now();
    final dir = await AppPaths.projectsDir();
    final f = File(_projFile(dir, project.season, project.episode));
    f.writeAsStringSync(
        const JsonEncoder.withIndent(' ').convert(project.toJson()));
  }

  /// بازخوانی پروژه (در صورت وجود).
  Future<EpisodeProject?> load(int season, int episode) async {
    final dir = await AppPaths.projectsDir();
    final f = File(_projFile(dir, season, episode));
    if (!f.existsSync()) return null;
    try {
      return EpisodeProject.fromJson(
          jsonDecode(f.readAsStringSync()) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// بازخوانی یا ساخت پروژه‌ی جدید.
  Future<EpisodeProject> loadOrCreate(
      int season, String seasonFile, int episode) async {
    final existing = await load(season, episode);
    if (existing != null) return existing;
    return EpisodeProject(
        season: season, seasonFile: seasonFile, episode: episode);
  }

  /// کپی ویدیوی انتخاب‌شده به فضای برنامه برای یک صحنه و برگرداندن مسیر جدید.
  Future<ClipAssignment> importClip(
      int season, int episode, int scene, String srcPath) async {
    final dir = await AppPaths.clipsDir(season, episode);
    final ext = p.extension(srcPath).isEmpty ? '.mp4' : p.extension(srcPath);
    final dst =
        File(p.join(dir.path, '${scene.toString().padLeft(2, '0')}$ext'));
    if (dst.existsSync()) dst.deleteSync();
    File(srcPath).copySync(dst.path);
    return ClipAssignment(dst.path);
  }

  /// نگاشت صحنه -> مسیر ویدیو برای یک پروژه.
  Map<int, String> filesFor(EpisodeProject project) =>
      project.clips.map((k, v) => MapEntry(k, v.path));
}
