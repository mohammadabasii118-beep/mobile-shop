/// پیش‌نمایش ساده‌ی ویدیو با media_kit (ویندوز + اندروید).
library;

import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../theme.dart';

class PreviewScreen extends StatefulWidget {
  final String path;
  final String title;
  const PreviewScreen({super.key, required this.path, this.title = 'پیش‌نمایش'});

  @override
  State<PreviewScreen> createState() => _PreviewScreenState();
}

class _PreviewScreenState extends State<PreviewScreen> {
  late final Player _player;
  late final VideoController _controller;

  @override
  void initState() {
    super.initState();
    _player = Player();
    _controller = VideoController(_player);
    _player.open(Media('file://${widget.path}'));
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(title: Text(widget.title)),
      body: Center(
        child: AspectRatio(
          aspectRatio: 9 / 16,
          child: Video(controller: _controller, fit: BoxFit.contain),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: kGold,
        foregroundColor: const Color(0xFF1A1206),
        onPressed: () => _player.playOrPause(),
        child: const Icon(Icons.play_arrow),
      ),
    );
  }
}
