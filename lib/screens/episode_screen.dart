import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;

import '../app_services.dart';
import '../models/project.dart';
import '../models/season.dart';
import '../models/speakers.dart';
import '../services/app_paths.dart';
import '../services/export_service.dart';
import '../theme.dart';
import 'preview_screen.dart';

class EpisodeScreen extends StatefulWidget {
  final SeasonData season;
  final EpisodeData episode;
  const EpisodeScreen(
      {super.key, required this.season, required this.episode});

  @override
  State<EpisodeScreen> createState() => _EpisodeScreenState();
}

class _EpisodeScreenState extends State<EpisodeScreen> {
  EpisodeProject? _project;
  bool _loading = true;

  SeasonData get season => widget.season;
  EpisodeData get ep => widget.episode;
  AppServices get services => ServicesScope.of(context);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final proj = await services.projects
        .loadOrCreate(season.season, season.sourceName, ep.number);
    if (!mounted) return;
    setState(() {
      _project = proj;
      _loading = false;
    });
  }

  Future<void> _save() async {
    if (_project != null) await services.projects.save(_project!);
  }

  // ---------------------------------------------------------------- انتخاب ویدیو
  Future<void> _pickForScene(int scene) async {
    final picked =
        await FilePickerPlatform.instance.pickFiles(type: FileType.video);
    final path = picked.isNotEmpty ? picked.first.path : null;
    if (path == null) return;
    final assign = await services.projects
        .importClip(season.season, ep.number, scene, path);
    setState(() => _project!.clips[scene] = assign);
    await _save();
  }

  Future<void> _pickAll() async {
    final files =
        await FilePickerPlatform.instance.pickFiles(type: FileType.video);
    if (files.isEmpty) return;
    if (!mounted) return;
    final byNumber = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text('چطور تخصیص بدم؟'),
        content: const Text(
            'اگه اسم فایل‌ها شماره دارن (مثل 01.mp4، 02.mp4) بر اساس شماره وگرنه به ترتیب انتخاب.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('به ترتیب')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('بر اساس شماره')),
        ],
      ),
    );
    if (byNumber == null) return;

    // مرتب‌سازی بر اساس نام فایل.
    final sorted = [...files]..sort((a, b) => a.name.compareTo(b.name));
    var orderScene = 1;
    for (final f in sorted) {
      if (f.path == null) continue;
      int? scene;
      if (byNumber) {
        final m = RegExp(r'(\d+)').firstMatch(p.basename(f.name));
        if (m != null) scene = int.parse(m.group(1)!);
      }
      scene ??= orderScene++;
      if (scene < 1 || scene > ep.sceneCount) continue;
      final assign = await services.projects
          .importClip(season.season, ep.number, scene, f.path!);
      _project!.clips[scene] = assign;
      if (mounted) setState(() {});
    }
    await _save();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${_fa(_project!.assignedCount)} ویدیو تخصیص داده شد')),
      );
    }
  }

  Future<void> _removeScene(int scene) async {
    setState(() => _project!.clips.remove(scene));
    await _save();
  }

  Future<void> _editTrim(int scene) async {
    final assign = _project!.clips[scene]!;
    double dur;
    try {
      dur = await services.builder.probeDuration(assign.path);
    } catch (_) {
      dur = 0;
    }
    if (dur <= 0 || !mounted) return;
    var range = RangeValues(
      (assign.trimStart ?? 0).clamp(0, dur).toDouble(),
      (assign.trimEnd ?? dur).clamp(0, dur).toDouble(),
    );
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          backgroundColor: kSurface,
          title: const Text('برش کلیپ'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                  'از ${range.start.toStringAsFixed(1)} تا ${range.end.toStringAsFixed(1)} ثانیه'),
              RangeSlider(
                values: range,
                min: 0,
                max: dur,
                divisions: (dur * 10).round().clamp(1, 1000),
                activeColor: kGold,
                labels: RangeLabels(range.start.toStringAsFixed(1),
                    range.end.toStringAsFixed(1)),
                onChanged: (v) => setD(() => range = v),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                assign.trimStart = null;
                assign.trimEnd = null;
                Navigator.pop(ctx);
                setState(() {});
                _save();
              },
              child: const Text('حذف برش'),
            ),
            FilledButton(
              onPressed: () {
                assign.trimStart = range.start <= 0.05 ? null : range.start;
                assign.trimEnd =
                    (range.end >= dur - 0.05) ? null : range.end;
                Navigator.pop(ctx);
                setState(() {});
                _save();
              },
              child: const Text('ذخیره'),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- ساخت
  List<int> get _missing =>
      [for (var i = 1; i <= ep.sceneCount; i++) if (!_project!.clips.containsKey(i)) i];

  Future<void> _build() async {
    final missing = _missing;
    if (missing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
            'ویدیوی این صحنه‌ها انتخاب نشده: ${missing.map(_fa).join('، ')}'),
      ));
      return;
    }

    final progress = ValueNotifier<double>(0);
    final step = ValueNotifier<String>('آماده‌سازی...');
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PopScope(
        canPop: false,
        child: AlertDialog(
          backgroundColor: kSurface,
          title: const Text('در حال ساخت قسمت'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ValueListenableBuilder<double>(
                valueListenable: progress,
                builder: (_, v, _) => Column(
                  children: [
                    LinearProgressIndicator(
                        value: v == 0 ? null : v,
                        color: kGold,
                        backgroundColor: kSurface2),
                    const SizedBox(height: 10),
                    Text('${(v * 100).toStringAsFixed(0)}٪',
                        style: const TextStyle(
                            fontFamily: 'Lalezar', fontSize: 22, color: kGold)),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              ValueListenableBuilder<String>(
                valueListenable: step,
                builder: (_, s, _) => Text(s, textAlign: TextAlign.center),
              ),
            ],
          ),
        ),
      ),
    );

    String? outPath;
    try {
      final work = await AppPaths.workDir(season.season, ep.number);
      final outDir = await AppPaths.outputDir();
      outPath = p.join(outDir.path,
          'mafia-ghab-ep${ep.number.toString().padLeft(2, '0')}.mp4');

      // آماده‌سازی فایل‌ها (اعمال برش دلخواه).
      final files = <int, String>{};
      for (final e in _project!.clips.entries) {
        final a = e.value;
        if (a.hasTrim) {
          step.value = 'برش صحنه ${_fa(e.key)}...';
          final dst = p.join(work.path, 'trim_${e.key}.mp4');
          files[e.key] =
              await services.builder.trimClip(a.path, dst, a.trimStart, a.trimEnd);
        } else {
          files[e.key] = a.path;
        }
      }

      // قسمت قبل: کلیپ‌های قسمت قبلی (در صورت وجود پروژه‌ی آن).
      final prevNum = ep.number - 1;
      final prevEp = season.episodes[prevNum];
      var prevFiles = <int, String>{};
      if (prevEp != null) {
        final prevProj =
            await services.projects.load(season.season, prevNum);
        if (prevProj != null) {
          prevFiles = services.projects.filesFor(prevProj);
        }
      }

      step.value = 'زمان‌بندی زیرنویس‌ها...';
      final spec = await services.builder.prepareSpec(
        ep: ep,
        files: files,
        prevEp: prevEp,
        prevFiles: prevFiles,
        workDir: work.path,
        outPath: outPath,
        onProgress: (f, s) => step.value = s,
      );

      // اعمال زیرنویس‌های ویرایش‌شده (در صورت وجود).
      if (_project!.editedSubs != null) {
        _project!.editedSubs!.forEach((k, v) => spec.subs[k] = v);
      }

      await services.builder.runBuild(
        spec,
        fast720: _project!.fast720,
        onProgress: (f, s) {
          progress.value = f;
          step.value = s;
        },
      );

      _project!.lastOutputPath = outPath;
      await _save();
    } catch (e) {
      if (mounted) Navigator.of(context).pop();
      if (mounted) {
        showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: kSurface,
            title: const Text('خطا در ساخت'),
            content: SingleChildScrollView(child: Text('$e')),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('باشه'))
            ],
          ),
        );
      }
      return;
    }

    if (mounted) Navigator.of(context).pop(); // بستن دیالوگ پیشرفت
    if (mounted) _showExportSheet(outPath);
  }

  void _showExportSheet(String outPath) {
    final exporter = ExportService();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: kSurface,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('قسمت ساخته شد! 🎬',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: 'Lalezar', fontSize: 24, color: kGold)),
            const SizedBox(height: 4),
            Text(p.basename(outPath),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.play_circle_outline),
              label: const Text('پیش‌نمایش'),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => PreviewScreen(
                            path: outPath, title: 'ویدیوی نهایی')));
              },
            ),
            const SizedBox(height: 10),
            if (Platform.isAndroid) ...[
              OutlinedButton.icon(
                icon: const Icon(Icons.save_alt),
                label: const Text('ذخیره در گالری (Movies/MafiaGhab)'),
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  final r = await exporter.saveToMovies(outPath);
                  messenger.showSnackBar(SnackBar(content: Text(r.message)));
                },
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                icon: const Icon(Icons.share),
                label: const Text('اشتراک (اینستاگرام)'),
                onPressed: () => exporter.share(outPath),
              ),
            ] else
              OutlinedButton.icon(
                icon: const Icon(Icons.folder_open),
                label: const Text('ذخیره در پوشه...'),
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  final r = await exporter.saveToFolder(outPath);
                  messenger.showSnackBar(SnackBar(content: Text(r.message)));
                },
              ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- UI
  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
          body: Center(child: CircularProgressIndicator(color: kGold)));
    }
    final assigned = _project!.assignedCount;
    return Scaffold(
      appBar: AppBar(
        title: Text('قسمت ${_fa(ep.number)}: ${ep.title}'),
        actions: [
          IconButton(
            tooltip: 'انتخاب گروهی ویدیوها',
            icon: const Icon(Icons.library_add_outlined),
            onPressed: _pickAll,
          ),
        ],
      ),
      body: Column(
        children: [
          _TopBar(
            episode: ep,
            fast720: _project!.fast720,
            onFastChanged: (v) {
              setState(() => _project!.fast720 = v);
              _save();
            },
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(10, 4, 10, 120),
              itemCount: ep.sceneCount,
              itemBuilder: (context, i) {
                final scene = i + 1;
                return _SceneCard(
                  scene: scene,
                  data: ep.clips[scene - 1],
                  isCold: ep.cold.contains(scene),
                  label: ep.labels[scene],
                  assign: _project!.clips[scene],
                  onPick: () => _pickForScene(scene),
                  onRemove: () => _removeScene(scene),
                  onTrim: () => _editTrim(scene),
                  onPreview: () {
                    final a = _project!.clips[scene];
                    if (a != null) {
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => PreviewScreen(
                                  path: a.path,
                                  title: 'صحنه ${_fa(scene)}')));
                    }
                  },
                  thumbFor: (path) => services.thumbnails.thumbnail(path),
                );
              },
            ),
          ),
        ],
      ),
      bottomSheet: _BuildBar(
        assigned: assigned,
        total: ep.sceneCount,
        onBuild: _build,
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final EpisodeData episode;
  final bool fast720;
  final ValueChanged<bool> onFastChanged;
  const _TopBar(
      {required this.episode,
      required this.fast720,
      required this.onFastChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'سؤال پایانی: ${episode.question}',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ),
          const SizedBox(width: 8),
          const Text('۷۲۰p سریع', style: TextStyle(fontSize: 13)),
          Switch(
            value: fast720,
            activeThumbColor: kGold,
            onChanged: onFastChanged,
          ),
        ],
      ),
    );
  }
}

class _SceneCard extends StatelessWidget {
  final int scene;
  final SceneData data;
  final bool isCold;
  final String? label;
  final ClipAssignment? assign;
  final VoidCallback onPick;
  final VoidCallback onRemove;
  final VoidCallback onTrim;
  final VoidCallback onPreview;
  final Future<String?> Function(String path) thumbFor;

  const _SceneCard({
    required this.scene,
    required this.data,
    required this.isCold,
    required this.label,
    required this.assign,
    required this.onPick,
    required this.onRemove,
    required this.onTrim,
    required this.onPreview,
    required this.thumbFor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: kSurface2,
                  child: Text(_fa(scene),
                      style: const TextStyle(
                          fontFamily: 'Lalezar', color: kGold, fontSize: 18)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(data.title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(height: 2),
                      Wrap(
                        spacing: 6,
                        children: [
                          _chip(speakerName(data.who), kGold.withValues(alpha: 0.18)),
                          if (isCold)
                            _chip('شروع تند', Colors.orange.withValues(alpha: 0.2)),
                          if (label != null)
                            _chip('برچسب: $label',
                                Colors.blue.withValues(alpha: 0.2)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (data.sub.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(data.sub,
                    style: const TextStyle(color: Colors.white, height: 1.4)),
              ),
            ],
            const SizedBox(height: 10),
            if (assign == null)
              OutlinedButton.icon(
                icon: const Icon(Icons.video_file_outlined),
                label: const Text('انتخاب ویدیو'),
                onPressed: onPick,
              )
            else
              Row(
                children: [
                  _ThumbBox(path: assign!.path, thumbFor: thumbFor),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.basename(assign!.path),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12)),
                        if (assign!.hasTrim)
                          const Text('برش‌خورده',
                              style: TextStyle(color: kGold, fontSize: 12)),
                        Row(
                          children: [
                            IconButton(
                                icon: const Icon(Icons.play_arrow,
                                    color: kGold),
                                onPressed: onPreview),
                            IconButton(
                                icon: const Icon(Icons.content_cut,
                                    color: Colors.white70),
                                onPressed: onTrim),
                            IconButton(
                                icon: const Icon(Icons.refresh,
                                    color: Colors.white70),
                                onPressed: onPick),
                            IconButton(
                                icon: const Icon(Icons.delete_outline,
                                    color: Colors.redAccent),
                                onPressed: onRemove),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String text, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: Text(text, style: const TextStyle(fontSize: 12)),
      );
}

class _ThumbBox extends StatelessWidget {
  final String path;
  final Future<String?> Function(String path) thumbFor;
  const _ThumbBox({required this.path, required this.thumbFor});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: 64,
        height: 100,
        child: FutureBuilder<String?>(
          future: thumbFor(path),
          builder: (_, snap) {
            if (snap.hasData && snap.data != null) {
              return Image.file(File(snap.data!), fit: BoxFit.cover);
            }
            return Container(
              color: kSurface2,
              child: const Icon(Icons.movie, color: Colors.white24),
            );
          },
        ),
      ),
    );
  }
}

class _BuildBar extends StatelessWidget {
  final int assigned;
  final int total;
  final VoidCallback onBuild;
  const _BuildBar(
      {required this.assigned, required this.total, required this.onBuild});

  @override
  Widget build(BuildContext context) {
    final ready = assigned >= total;
    return Container(
      color: kSurface,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('${_fa(assigned)} از ${_fa(total)} صحنه آماده',
              style: TextStyle(color: ready ? kGold : Colors.white70)),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            icon: const Icon(Icons.movie_creation_outlined),
            label: const Text('ساخت قسمت'),
            onPressed: onBuild,
          ),
        ],
      ),
    );
  }
}

String _fa(int n) =>
    n.toString().split('').map((c) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(c)]).join();
