/// نگاشت کد گوینده -> نام فارسی (برای نمایش در لیست صحنه‌ها).
library;

const Map<String, String> kSpeakerNames = {
  'M': 'میلاد',
  'MA': 'مادر',
  'S': 'سلطان',
  'K': 'ممد کوچیکه',
  'G': 'ممد گنده',
  'J': 'شغال',
  'N': 'نازنین',
  'O': 'سمور',
  'A': 'عمو اکبر',
  'E': 'فیل گمرک',
  'F': 'بابای نازنین',
  'KA': 'کامی',
  'B': 'پلیس',
  'DR': 'دکتر',
  'narrator': 'راوی',
  '': '—',
};

String speakerName(String code) => kSpeakerNames[code] ?? code;
