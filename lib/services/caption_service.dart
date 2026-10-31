/// ساخت کپشن و کامنت پین‌شده از روی داده‌ی قسمت.
library;

import '../models/season.dart';

class CaptionResult {
  final String caption;
  final String pinnedComment;
  const CaptionResult(this.caption, this.pinnedComment);
}

class CaptionService {
  /// دقیقاً همین ۵ هشتگ (حداکثر اینستاگرام).
  static const List<String> hashtags = [
    '#مافیای_قاب',
    '#سریال_اینستاگرامی',
    '#انیمیشن',
    '#گنگستر',
    '#اکسپلور',
  ];

  static String _faNum(int n) => n
      .toString()
      .split('')
      .map((c) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(c)])
      .join();

  /// یک تیزر کوتاه از پانچ‌لاین‌های قسمت (اولین صحنه‌های شروع تند).
  static String _teaser(EpisodeData ep) {
    final lines = <String>[];
    for (final k in ep.cold) {
      if (k >= 1 && k <= ep.clips.length) {
        final s = ep.clips[k - 1].sub.trim();
        if (s.isNotEmpty) lines.add(s);
      }
      if (lines.length >= 2) break;
    }
    if (lines.isEmpty) {
      for (final c in ep.clips) {
        if (c.sub.trim().isNotEmpty) {
          lines.add(c.sub.trim());
          break;
        }
      }
    }
    return lines.take(2).join('\n');
  }

  CaptionResult build(SeasonData season, EpisodeData ep,
      {String nextTime = 'فردا شب ساعت ۲۱'}) {
    final epFa = _faNum(ep.number);
    final seasonFa = _faNum(season.season);
    final teaser = _teaser(ep);

    final caption = [
      'مافیای قاب | فصل $seasonFa – قسمت $epFa: ${ep.title}',
      '',
      if (teaser.isNotEmpty) teaser,
      if (teaser.isNotEmpty) '',
      ep.question,
      '',
      'قسمت بعد: $nextTime',
      'فالو کن که قسمت بعد رو از دست ندی 🦊',
      '',
      hashtags.join(' '),
    ].join('\n');

    final pinned = '📌 ${ep.question}\nجوابت رو همین‌جا کامنت کن 👇';

    return CaptionResult(caption, pinned);
  }
}
