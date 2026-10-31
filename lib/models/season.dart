/// مدل‌های داده‌ی فصل/قسمت — دقیقاً مطابق ساختار season1.json در editor.py.
library;

/// یک صحنه (کلیپ) در فایل فصل.
class SceneData {
  /// کد گوینده (M, MA, S, ...). رشته‌ی خالی یعنی بدون دیالوگ.
  final String who;

  /// عنوان صحنه (برای نمایش در لیست).
  final String title;

  /// متن زیرنویس (فحش‌ها با * سانسور شده‌اند). خالی یعنی بدون زیرنویس.
  final String sub;

  const SceneData({required this.who, required this.title, required this.sub});

  factory SceneData.fromJson(Map<String, dynamic> j) => SceneData(
        who: (j['who'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        sub: (j['sub'] ?? '') as String,
      );

  Map<String, dynamic> toJson() => {'who': who, 'title': title, 'sub': sub};
}

/// یک قسمت کامل از فصل.
class EpisodeData {
  final int number;
  final String title;

  /// شماره‌ی صحنه‌هایی که «شروع تند» را می‌سازند.
  final List<int> cold;

  /// برچسب مکان/زمان: شماره‌ی صحنه -> متن برچسب.
  final Map<int, String> labels;

  /// سؤال کارت پایانی.
  final String question;

  /// آیا این قسمت پایان فصل است؟
  final bool isFinal;

  final List<SceneData> clips;

  const EpisodeData({
    required this.number,
    required this.title,
    required this.cold,
    required this.labels,
    required this.question,
    required this.isFinal,
    required this.clips,
  });

  factory EpisodeData.fromJson(int number, Map<String, dynamic> j) {
    final labels = <int, String>{};
    final rawLabels = (j['labels'] ?? const {}) as Map<String, dynamic>;
    rawLabels.forEach((k, v) => labels[int.parse(k)] = v as String);
    return EpisodeData(
      number: number,
      title: (j['title'] ?? '') as String,
      cold: ((j['cold'] ?? const []) as List).map((e) => e as int).toList(),
      labels: labels,
      question: (j['question'] ?? '') as String,
      isFinal: (j['final'] ?? false) as bool,
      clips: ((j['clips'] ?? const []) as List)
          .map((e) => SceneData.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  int get sceneCount => clips.length;
}

/// یک فصل کامل (season1.json, season2.json, ...).
class SeasonData {
  final int season;
  final Map<int, EpisodeData> episodes;

  /// نام فایلی که این فصل از آن بارگذاری شده (برای نمایش/مدیریت).
  final String sourceName;

  const SeasonData({
    required this.season,
    required this.episodes,
    required this.sourceName,
  });

  factory SeasonData.fromJson(Map<String, dynamic> j, {String sourceName = ''}) {
    final eps = <int, EpisodeData>{};
    final raw = (j['episodes'] ?? const {}) as Map<String, dynamic>;
    raw.forEach((k, v) {
      final n = int.parse(k);
      eps[n] = EpisodeData.fromJson(n, v as Map<String, dynamic>);
    });
    return SeasonData(
      season: (j['season'] ?? 1) as int,
      episodes: eps,
      sourceName: sourceName,
    );
  }

  List<int> get sortedEpisodeNumbers => episodes.keys.toList()..sort();
}
