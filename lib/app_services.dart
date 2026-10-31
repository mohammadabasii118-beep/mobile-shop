/// ظرف سرویس‌ها (تزریق وابستگی ساده) که از بالای درخت ویجت در دسترس است.
library;

import 'package:flutter/widgets.dart';

import 'services/build_service.dart';
import 'services/caption_service.dart';
import 'services/ffmpeg/ffmpeg_factory.dart';
import 'services/ffmpeg/ffmpeg_service.dart';
import 'services/project_store.dart';
import 'services/season_service.dart';
import 'services/thumbnail_service.dart';

class AppServices {
  final FFmpegService ffmpeg;
  final EpisodeBuilder builder;
  final SeasonService seasons;
  final ProjectStore projects;
  final ThumbnailService thumbnails;
  final CaptionService captions;

  AppServices._(this.ffmpeg, this.builder, this.seasons, this.projects,
      this.thumbnails, this.captions);

  factory AppServices.create() {
    final ffmpeg = createFFmpegService();
    return AppServices._(
      ffmpeg,
      EpisodeBuilder(ffmpeg),
      SeasonService(),
      ProjectStore(),
      ThumbnailService(ffmpeg),
      CaptionService(),
    );
  }
}

class ServicesScope extends InheritedWidget {
  final AppServices services;
  const ServicesScope(
      {super.key, required this.services, required super.child});

  static AppServices of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<ServicesScope>();
    assert(scope != null, 'ServicesScope پیدا نشد');
    return scope!.services;
  }

  @override
  bool updateShouldNotify(ServicesScope oldWidget) =>
      services != oldWidget.services;
}
