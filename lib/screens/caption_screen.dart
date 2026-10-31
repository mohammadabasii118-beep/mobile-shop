import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_services.dart';
import '../models/season.dart';
import '../services/caption_service.dart';
import '../theme.dart';

/// تب کپشن: ساخت کپشن و کامنت پین‌شده از دادهٔ قسمت، با دکمه‌های کپی.
class CaptionScreen extends StatelessWidget {
  final SeasonData season;
  final EpisodeData episode;
  const CaptionScreen(
      {super.key, required this.season, required this.episode});

  @override
  Widget build(BuildContext context) {
    final services = ServicesScope.of(context);
    final result = services.captions.build(season, episode);
    return Scaffold(
      appBar: AppBar(title: Text('کپشن — قسمت ${_fa(episode.number)}')),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          _CopyBlock(
            title: 'کپشن پست',
            text: result.caption,
          ),
          const SizedBox(height: 14),
          _CopyBlock(
            title: 'کامنت پین‌شده (نظرسنجی)',
            text: result.pinnedComment,
          ),
          const SizedBox(height: 14),
          _CopyBlock(
            title: 'فقط هشتگ‌ها',
            text: CaptionService.hashtags.join(' '),
          ),
        ],
      ),
    );
  }
}

class _CopyBlock extends StatelessWidget {
  final String title;
  final String text;
  const _CopyBlock({required this.title, required this.text});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(title,
                    style: const TextStyle(
                        fontFamily: 'Lalezar', fontSize: 20, color: kGold)),
                const Spacer(),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      backgroundColor: kSurface2),
                  icon: const Icon(Icons.copy, size: 18),
                  label: const Text('کپی'),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: text));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('کپی شد ✅')),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 10),
            SelectableText(
              text,
              textDirection: TextDirection.rtl,
              style: const TextStyle(height: 1.7, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}

String _fa(int n) =>
    n.toString().split('').map((c) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(c)]).join();
