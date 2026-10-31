import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:media_kit/media_kit.dart';

import 'app_services.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    MediaKit.ensureInitialized();
  } catch (_) {/* پیش‌نمایش در صورت نبود کتابخانه غیرفعال می‌شود */}
  final services = AppServices.create();
  runApp(MafiaGhabApp(services: services));
}

class MafiaGhabApp extends StatelessWidget {
  final AppServices services;
  const MafiaGhabApp({super.key, required this.services});

  @override
  Widget build(BuildContext context) {
    return ServicesScope(
      services: services,
      child: MaterialApp(
        title: 'استودیوی مافیای قاب',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        locale: const Locale('fa'),
        supportedLocales: const [Locale('fa'), Locale('en')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const HomeScreen(),
      ),
    );
  }
}
