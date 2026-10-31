import 'package:flutter/material.dart';

import '../app_services.dart';
import '../services/build_service.dart';
import '../services/subtitle/subtitle_timing.dart';
import '../theme.dart';
import 'preview_screen.dart';

/// ویرایشگر زیرنویس: بعد از زمان‌بندی خودکار، متن و زمان هر خط قابل ویرایش است
/// و می‌توان هر کلیپ را با زیرنویس پیش‌نمایش کرد. با «ساخت نهایی» با نتیجهٔ
/// true بسته می‌شود. تغییرها مستقیماً روی spec.subs اعمال می‌شوند.
class SubtitleEditorScreen extends StatefulWidget {
  final BuildSpec spec;
  const SubtitleEditorScreen({super.key, required this.spec});

  @override
  State<SubtitleEditorScreen> createState() => _SubtitleEditorScreenState();
}

class _SubtitleEditorScreenState extends State<SubtitleEditorScreen> {
  BuildSpec get spec => widget.spec;

  Future<void> _previewClip(int clipIndex) async {
    final services = ServicesScope.of(context);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: kGold)),
    );
    try {
      final out = await services.builder.previewClip(spec, clipIndex);
      if (!mounted) return;
      Navigator.of(context).pop(); // بستن لودینگ
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) =>
              PreviewScreen(path: out, title: 'پیش‌نمایش کلیپ ${_fa(clipIndex)}'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('خطا در پیش‌نمایش: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final clipKeys = spec.subs.keys.toList()..sort();
    return Scaffold(
      appBar: AppBar(title: const Text('ویرایش زیرنویس‌ها')),
      body: clipKeys.isEmpty
          ? const Center(child: Text('این قسمت زیرنویسی ندارد.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 110),
              children: [
                for (final ci in clipKeys) ...[
                  _ClipHeader(
                    clipIndex: ci,
                    isTitle: ci == spec.titleClip,
                    onPreview: () => _previewClip(ci),
                  ),
                  for (final line in spec.subs[ci]!)
                    _SubLineCard(line: line, onChanged: () => setState(() {})),
                ],
              ],
            ),
      bottomSheet: Container(
        color: kSurface,
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 16),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('ذخیره'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                icon: const Icon(Icons.movie_creation_outlined),
                label: const Text('ساخت نهایی'),
                onPressed: () => Navigator.pop(context, true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClipHeader extends StatelessWidget {
  final int clipIndex;
  final bool isTitle;
  final VoidCallback onPreview;
  const _ClipHeader(
      {required this.clipIndex,
      required this.isTitle,
      required this.onPreview});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
      child: Row(
        children: [
          Text('کلیپ ${_fa(clipIndex)}',
              style: const TextStyle(
                  fontFamily: 'Lalezar', fontSize: 20, color: kGold)),
          if (isTitle) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                  color: kGold.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(20)),
              child: const Text('تیتر', style: TextStyle(fontSize: 12)),
            ),
          ],
          const Spacer(),
          TextButton.icon(
            icon: const Icon(Icons.play_circle_outline, color: kGold),
            label: const Text('پیش‌نمایش'),
            onPressed: onPreview,
          ),
        ],
      ),
    );
  }
}

class _SubLineCard extends StatefulWidget {
  final SubLine line;
  final VoidCallback onChanged;
  const _SubLineCard({required this.line, required this.onChanged});

  @override
  State<_SubLineCard> createState() => _SubLineCardState();
}

class _SubLineCardState extends State<_SubLineCard> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.line.text);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _bump(bool isStart, double delta) {
    setState(() {
      if (isStart) {
        widget.line.start =
            SubtitleTiming.round2((widget.line.start + delta).clamp(0, 9999));
      } else {
        widget.line.end =
            SubtitleTiming.round2((widget.line.end + delta).clamp(0, 9999));
      }
    });
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final line = widget.line;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _controller,
              textDirection: TextDirection.rtl,
              maxLines: null,
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'متن زیرنویس',
                border: OutlineInputBorder(),
              ),
              onChanged: (v) {
                line.text = v;
                widget.onChanged();
              },
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _timeBox('شروع', line.start, (d) => _bump(true, d)),
                const SizedBox(width: 10),
                _timeBox('پایان', line.end, (d) => _bump(false, d)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _timeBox(String label, double value, ValueChanged<double> bump) {
    return Expanded(
      child: Row(
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.remove_circle_outline, color: Colors.white70),
            onPressed: () => bump(-0.1),
          ),
          Expanded(
            child: Column(
              children: [
                Text(label,
                    style: const TextStyle(fontSize: 11, color: Colors.white54)),
                Text('${value.toStringAsFixed(2)}s',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, color: kGold)),
              ],
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.add_circle_outline, color: Colors.white70),
            onPressed: () => bump(0.1),
          ),
        ],
      ),
    );
  }
}

String _fa(int n) =>
    n.toString().split('').map((c) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(c)]).join();
