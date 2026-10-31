/// تم تیره با تأکید طلایی (#e2b04a)، فونت فارسی Vazirmatn، دکمه‌های بزرگ.
library;

import 'package:flutter/material.dart';

const Color kGold = Color(0xFFE2B04A);
const Color kBg = Color(0xFF14110E);
const Color kSurface = Color(0xFF1F1B16);
const Color kSurface2 = Color(0xFF2A241D);

ThemeData buildTheme() {
  final scheme = const ColorScheme.dark(
    primary: kGold,
    onPrimary: Color(0xFF1A1206),
    secondary: kGold,
    surface: kSurface,
    onSurface: Color(0xFFF2E9D8),
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    fontFamily: 'Vazirmatn',
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: kBg,
      foregroundColor: kGold,
      centerTitle: true,
      elevation: 0,
      titleTextStyle: TextStyle(
        fontFamily: 'Lalezar',
        fontSize: 26,
        color: kGold,
      ),
    ),
    cardTheme: CardThemeData(
      color: kSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      margin: const EdgeInsets.symmetric(vertical: 6),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kGold,
        foregroundColor: const Color(0xFF1A1206),
        minimumSize: const Size.fromHeight(56),
        textStyle: const TextStyle(
            fontFamily: 'Vazirmatn', fontSize: 18, fontWeight: FontWeight.w700),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: kGold,
        side: const BorderSide(color: kGold),
        minimumSize: const Size.fromHeight(52),
        textStyle: const TextStyle(
            fontFamily: 'Vazirmatn', fontSize: 16, fontWeight: FontWeight.w700),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kSurface2,
        foregroundColor: const Color(0xFFF2E9D8),
        minimumSize: const Size.fromHeight(52),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: kSurface2,
      contentTextStyle: TextStyle(fontFamily: 'Vazirmatn', color: Colors.white),
    ),
    dividerColor: const Color(0xFF3A3228),
  );
}
