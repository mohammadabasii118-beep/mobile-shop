import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../app_services.dart';
import '../models/season.dart';
import '../theme.dart';
import 'episode_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<SeasonData>> _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future = ServicesScope.of(context).seasons.loadAll();
  }

  void _reload() {
    setState(() {
      _future = ServicesScope.of(context).seasons.loadAll();
    });
  }

  Future<void> _importSeason() async {
    final services = ServicesScope.of(context);
    final picked = await FilePickerPlatform.instance.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
      dialogTitle: 'فایل فصل (مثلاً season2.json) را انتخاب کن',
    );
    final path = picked.isNotEmpty ? picked.first.path : null;
    if (path == null) return;
    try {
      final s = await services.seasons.importSeasonFile(path);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('فصل ${s.season} اضافه شد ✅')),
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('فایل فصل خراب است: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('استودیوی مافیای قاب')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _importSeason,
        backgroundColor: kGold,
        foregroundColor: const Color(0xFF1A1206),
        icon: const Icon(Icons.file_upload_outlined),
        label: const Text('وارد کردن فصل',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: FutureBuilder<List<SeasonData>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: kGold));
          }
          if (snap.hasError) {
            return Center(child: Text('خطا: ${snap.error}'));
          }
          final seasons = snap.data ?? const [];
          return ListView(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
            children: [
              for (final season in seasons) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(6, 16, 6, 6),
                  child: Text(
                    'فصل ${_fa(season.season)} — ${season.sourceName}',
                    style: const TextStyle(
                        fontFamily: 'Lalezar', fontSize: 22, color: kGold),
                  ),
                ),
                for (final n in season.sortedEpisodeNumbers)
                  _EpisodeTile(season: season, episode: season.episodes[n]!),
              ],
              if (seasons.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(40),
                  child: Text('هیچ فصلی پیدا نشد.',
                      textAlign: TextAlign.center),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _EpisodeTile extends StatelessWidget {
  final SeasonData season;
  final EpisodeData episode;
  const _EpisodeTile({required this.season, required this.episode});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: kSurface2,
          child: Text(_fa(episode.number),
              style: const TextStyle(
                  fontFamily: 'Lalezar', color: kGold, fontSize: 20)),
        ),
        title: Text(episode.title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        subtitle: Text(
            '${_fa(episode.sceneCount)} صحنه'
            '${episode.isFinal ? ' • پایان فصل' : ''}'),
        trailing: const Icon(Icons.chevron_left, color: kGold),
        onTap: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => EpisodeScreen(season: season, episode: episode),
          ));
        },
      ),
    );
  }
}

String _fa(int n) =>
    n.toString().split('').map((c) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(c)]).join();
