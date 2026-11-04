import type { BrandId } from "./vehicles";
import { getModel } from "./vehicles";

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export interface Fitment {
  model: string;
  from: number;
  to: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  sku: string;
  oem: string;
  brand: BrandId;
  category: string;
  fitments: Fitment[];
  price: number;
  oldPrice?: number;
  stock: StockStatus;
  stockQty: number;
  image: string;
  manufacturer: string;
  origin: string;
  quality: "اصلی (Genuine)" | "OEM" | "افترمارکت درجه یک";
  warranty: string;
  rating: number;
  reviews: number;
  sold: number;
  badges: ("bestseller" | "new" | "special")[];
  addedAt: string;
  description: string;
  specs: { label: string; value: string }[];
}

type Raw = [
  sku: string, oem: string, name: string, nameEn: string, brand: BrandId, category: string,
  fitments: [string, number, number][], price: number, oldPrice: number | null, stock: StockStatus, qty: number,
  image: string, manufacturer: string, origin: string, quality: Product["quality"], badges: Product["badges"], sold: number,
];

const RAW: Raw[] = [
  // Nissan — brakes / discs
  ["HAP-NS-1021", "40206-JA00A", "دیسک ترمز چرخ جلو تیانا", "Front Brake Disc Teana", "nissan", "discs-pads", [["teana", 2008, 2017], ["maxima", 2009, 2015]], 4_850_000, 5_400_000, "in-stock", 24, "brake-disc", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", ["bestseller", "special"], 412],
  ["HAP-NS-1022", "D1060-JA00J", "لنت ترمز جلو سرامیکی تیانا و ماکسیما", "Ceramic Front Brake Pads", "nissan", "discs-pads", [["teana", 2008, 2017], ["maxima", 2009, 2017], ["murano", 2009, 2014]], 2_380_000, 2_790_000, "in-stock", 58, "brake-pads", "Akebono", "ژاپن", "OEM", ["bestseller"], 689],
  ["HAP-NS-1023", "41011-1AA0A", "کالیپر ترمز جلو راست مورانو", "Front Right Brake Caliper Murano", "nissan", "brakes", [["murano", 2009, 2014]], 9_200_000, null, "low-stock", 3, "brake-disc", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", ["new"], 37],
  ["HAP-NS-1024", "D4060-JG01A", "لنت ترمز عقب ایکس‌تریل", "Rear Brake Pads X-Trail", "nissan", "discs-pads", [["x-trail", 2007, 2017]], 1_690_000, null, "in-stock", 40, "brake-pads", "Brembo", "ایتالیا", "افترمارکت درجه یک", [], 233],
  ["HAP-NS-1025", "43206-JD00A", "دیسک ترمز عقب جوک", "Rear Brake Disc Juke", "nissan", "discs-pads", [["juke", 2010, 2017]], 3_250_000, 3_600_000, "in-stock", 15, "brake-disc", "TRW", "آلمان", "افترمارکت درجه یک", ["special"], 96],
  // Nissan — suspension
  ["HAP-NS-2031", "54501-JN00A", "طبق جلو راست تیانا", "Front Right Control Arm Teana", "nissan", "control-arms", [["teana", 2008, 2013]], 6_400_000, null, "in-stock", 11, "control-arm", "555 (Sankei)", "ژاپن", "OEM", ["bestseller"], 205],
  ["HAP-NS-2032", "40160-JA00A", "سیبک طبق پایین ماکسیما", "Lower Ball Joint Maxima", "nissan", "control-arms", [["maxima", 2004, 2017], ["teana", 2004, 2013]], 1_150_000, 1_350_000, "in-stock", 66, "ball-joint", "CTR", "کره جنوبی", "OEM", ["special"], 341],
  ["HAP-NS-2033", "E4302-1AA0A", "کمک‌فنر جلو چپ مورانو", "Front Left Strut Murano", "nissan", "shocks", [["murano", 2009, 2014]], 8_900_000, 9_800_000, "in-stock", 8, "shock-absorber", "KYB", "ژاپن", "OEM", ["bestseller", "special"], 177],
  ["HAP-NS-2034", "56210-4BA1A", "کمک‌فنر عقب ایکس‌تریل", "Rear Shock Absorber X-Trail", "nissan", "shocks", [["x-trail", 2014, 2017]], 5_300_000, null, "low-stock", 4, "shock-absorber", "Tokico", "ژاپن", "OEM", ["new"], 52],
  ["HAP-NS-2035", "40202-JA01A", "بلبرینگ و توپی چرخ جلو تیانا", "Front Wheel Hub Bearing", "nissan", "front-suspension", [["teana", 2008, 2017], ["maxima", 2009, 2015], ["murano", 2009, 2014]], 4_100_000, null, "in-stock", 19, "hub-bearing", "NSK", "ژاپن", "OEM", [], 158],
  ["HAP-NS-2036", "43202-JD00A", "توپی چرخ عقب جوک", "Rear Wheel Hub Juke", "nissan", "rear-suspension", [["juke", 2010, 2017]], 3_700_000, null, "in-stock", 12, "hub-bearing", "SKF", "سوئد", "افترمارکت درجه یک", ["new"], 41],
  ["HAP-NS-2037", "55501-JA00A", "طبق عقب اکسل", "Rear Control Arm Excel", "nissan", "rear-suspension", [["excel", 2005, 2016]], 2_950_000, null, "out-of-stock", 0, "control-arm", "555 (Sankei)", "ژاپن", "OEM", [], 64],
  // Nissan — engine
  ["HAP-NS-3041", "13028-JA00A", "زنجیر تایم موتور VQ35 مورانو و ماکسیما", "Timing Chain Kit VQ35DE", "nissan", "engine", [["murano", 2003, 2014], ["maxima", 2004, 2015], ["teana", 2004, 2013]], 12_500_000, 13_900_000, "in-stock", 6, "timing-belt", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", ["bestseller", "special"], 128],
  ["HAP-NS-3042", "11044-JA01A", "واشر سرسیلندر تیانا ۲.۵", "Cylinder Head Gasket QR25", "nissan", "cylinder-head", [["teana", 2008, 2013], ["x-trail", 2007, 2013]], 2_200_000, null, "in-stock", 31, "gasket", "Stone", "ژاپن", "OEM", [], 87],
  ["HAP-NS-3043", "11040-JK20A", "سرسیلندر کامل موتور VQ35", "Complete Cylinder Head VQ35", "nissan", "cylinder-head", [["murano", 2009, 2014], ["maxima", 2009, 2015]], 68_000_000, 74_000_000, "low-stock", 2, "cylinder-head", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", ["special"], 14],
  ["HAP-NS-3044", "12010-JA00A", "پیستون و رینگ استاندارد موتور QR25", "Piston & Ring Set STD QR25", "nissan", "piston", [["x-trail", 2007, 2013], ["teana", 2008, 2013]], 16_800_000, null, "in-stock", 9, "piston", "Art (ART Metal)", "ژاپن", "OEM", ["new"], 33],
  ["HAP-NS-3045", "21010-JA00A", "واترپمپ موتور VQ35", "Water Pump VQ35", "nissan", "cooling", [["murano", 2003, 2014], ["maxima", 2004, 2015], ["teana", 2004, 2013]], 5_800_000, 6_300_000, "in-stock", 21, "water-pump", "Aisin", "ژاپن", "OEM", ["bestseller"], 264],
  ["HAP-NS-3046", "21410-JA00A", "رادیاتور آب تیانا اتومات", "Radiator Teana AT", "nissan", "cooling", [["teana", 2008, 2013], ["maxima", 2009, 2014]], 11_200_000, null, "in-stock", 7, "radiator", "Koyorad", "ژاپن", "OEM", [], 49],
  ["HAP-NS-3047", "21410-1KA0A", "رادیاتور جوک", "Radiator Juke", "nissan", "cooling", [["juke", 2010, 2017]], 9_400_000, null, "out-of-stock", 0, "radiator", "Denso", "ژاپن", "OEM", [], 22],
  // Nissan — gearbox
  ["HAP-NS-4051", "31020-1XF2D", "گیربکس CVT کامل مورانو", "CVT Transmission Assembly Murano", "nissan", "gearbox", [["murano", 2009, 2014]], 245_000_000, null, "low-stock", 1, "gearbox", "Jatco", "ژاپن", "اصلی (Genuine)", ["new"], 6],
  ["HAP-NS-4052", "30100-JA00A", "دیسک و صفحه کلاچ اکسل", "Clutch Kit Excel", "nissan", "gearbox", [["excel", 2005, 2016]], 7_600_000, 8_200_000, "in-stock", 10, "clutch", "Exedy", "ژاپن", "OEM", ["special"], 73],
  // Nissan — electrical / sensors
  ["HAP-NS-5061", "23100-JA02A", "دینام ماکسیما و تیانا", "Alternator 130A", "nissan", "electrical", [["maxima", 2009, 2015], ["teana", 2008, 2013], ["murano", 2009, 2014]], 14_900_000, null, "in-stock", 5, "alternator", "Hitachi", "ژاپن", "OEM", [], 58],
  ["HAP-NS-5062", "22448-JA00C", "کوئل جرقه ایکس‌تریل و تیانا", "Ignition Coil QR25", "nissan", "electrical", [["x-trail", 2007, 2017], ["teana", 2008, 2013], ["juke", 2010, 2017]], 2_450_000, 2_750_000, "in-stock", 44, "ignition-coil", "Hitachi", "ژاپن", "OEM", ["bestseller"], 512],
  ["HAP-NS-5063", "22401-JA01B", "شمع ایریدیوم موتور VQ (۶ عددی)", "Iridium Spark Plug Set", "nissan", "electrical", [["murano", 2003, 2017], ["maxima", 2004, 2017], ["teana", 2004, 2017]], 3_900_000, null, "in-stock", 70, "spark-plug", "NGK", "ژاپن", "OEM", ["bestseller"], 820],
  ["HAP-NS-5064", "22693-JA00A", "سنسور اکسیژن بالا ماکسیما", "Upstream O2 Sensor", "nissan", "sensors", [["maxima", 2009, 2015], ["murano", 2009, 2014]], 6_700_000, null, "in-stock", 13, "sensor", "Denso", "ژاپن", "OEM", [], 77],
  ["HAP-NS-5065", "47910-1AA0A", "سنسور ABS چرخ جلو مورانو", "Front ABS Sensor Murano", "nissan", "sensors", [["murano", 2009, 2014]], 2_850_000, null, "low-stock", 4, "sensor", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", ["new"], 19],
  ["HAP-NS-5066", "23731-JA10B", "سنسور میل‌لنگ جوک", "Crankshaft Position Sensor Juke", "nissan", "sensors", [["juke", 2010, 2017], ["x-trail", 2014, 2017]], 1_950_000, null, "in-stock", 28, "sensor", "Hitachi", "ژاپن", "OEM", [], 61],
  // Nissan — body / interior
  ["HAP-NS-6071", "26060-9N00A", "چراغ جلو زنون تیانا راست", "Xenon Headlight Right Teana", "nissan", "body", [["teana", 2013, 2017]], 38_500_000, 41_000_000, "in-stock", 3, "headlight", "Ichikoh", "ژاپن", "اصلی (Genuine)", ["new", "special"], 11],
  ["HAP-NS-6072", "96301-1AA0A", "آینه بغل برقی مورانو چپ", "Power Side Mirror Left Murano", "nissan", "body", [["murano", 2009, 2014]], 13_700_000, null, "in-stock", 6, "mirror", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", [], 25],
  ["HAP-NS-6073", "26555-JG01A", "چراغ خطر عقب ایکس‌تریل", "Tail Lamp X-Trail", "nissan", "body", [["x-trail", 2007, 2013]], 7_900_000, null, "in-stock", 5, "taillight", "Depo", "تایوان", "افترمارکت درجه یک", [], 30],
  ["HAP-NS-6074", "48430-JA00A", "غربیلک فرمان چرمی ماکسیما", "Leather Steering Wheel Maxima", "nissan", "interior", [["maxima", 2009, 2015]], 18_200_000, null, "low-stock", 2, "steering-wheel", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", [], 8],
  // Nissan — consumables
  ["HAP-NS-7081", "15208-65F0E", "فیلتر روغن نیسان (اصلی)", "Oil Filter Genuine", "nissan", "consumables", [["murano", 2003, 2017], ["maxima", 1995, 2017], ["teana", 2003, 2017], ["x-trail", 2001, 2017], ["juke", 2010, 2017], ["excel", 2005, 2016]], 390_000, 450_000, "in-stock", 300, "oil-filter", "Nissan Genuine", "ژاپن", "اصلی (Genuine)", ["bestseller", "special"], 2140],
  ["HAP-NS-7082", "16546-JA00A", "فیلتر هوای تیانا و ماکسیما", "Air Filter", "nissan", "consumables", [["teana", 2008, 2017], ["maxima", 2009, 2017]], 690_000, null, "in-stock", 120, "air-filter", "Sakura", "ژاپن", "OEM", [], 870],
  ["HAP-NS-7083", "KE900-90042", "روغن موتور نیسان ۵W-30 (چهار لیتری)", "Nissan Engine Oil 5W-30 4L", "nissan", "consumables", [["murano", 2003, 2017], ["maxima", 1995, 2017], ["teana", 2003, 2017], ["x-trail", 2001, 2017], ["juke", 2010, 2017], ["excel", 2005, 2016]], 3_450_000, 3_800_000, "in-stock", 150, "engine-oil", "Nissan Genuine", "امارات", "اصلی (Genuine)", ["bestseller"], 1630],

  // Honda — brakes
  ["HAP-HN-1121", "45251-TA0-A00", "دیسک ترمز جلو آکورد", "Front Brake Disc Accord", "honda", "discs-pads", [["accord", 2008, 2017], ["crosstour", 2010, 2015]], 4_450_000, 4_900_000, "in-stock", 26, "brake-disc", "Honda Genuine", "ژاپن", "اصلی (Genuine)", ["bestseller"], 388],
  ["HAP-HN-1122", "45022-T2A-A01", "لنت ترمز جلو سرامیکی آکورد", "Ceramic Front Pads Accord", "honda", "discs-pads", [["accord", 2013, 2017]], 2_290_000, 2_650_000, "in-stock", 60, "brake-pads", "Nissin", "ژاپن", "OEM", ["bestseller", "special"], 744],
  ["HAP-HN-1123", "45022-SNA-A01", "لنت ترمز جلو سیویک", "Front Brake Pads Civic", "honda", "discs-pads", [["civic", 2006, 2015]], 1_790_000, null, "in-stock", 80, "brake-pads", "Akebono", "ژاپن", "OEM", ["bestseller"], 931],
  ["HAP-HN-1124", "43022-T0A-A01", "لنت ترمز عقب سی‌آر‌وی", "Rear Brake Pads CR-V", "honda", "discs-pads", [["cr-v", 2012, 2017]], 1_590_000, null, "in-stock", 45, "brake-pads", "Brembo", "ایتالیا", "افترمارکت درجه یک", ["new"], 120],
  ["HAP-HN-1125", "45018-SDA-A01", "کالیپر ترمز جلو چپ آکورد", "Front Left Caliper Accord", "honda", "brakes", [["accord", 2003, 2007]], 7_800_000, null, "out-of-stock", 0, "brake-disc", "Honda Genuine", "ژاپن", "اصلی (Genuine)", [], 29],
  // Honda — suspension
  ["HAP-HN-2131", "51350-TA0-A01", "طبق جلو چپ آکورد", "Front Left Control Arm Accord", "honda", "control-arms", [["accord", 2008, 2012]], 5_900_000, 6_500_000, "in-stock", 14, "control-arm", "555 (Sankei)", "ژاپن", "OEM", ["special"], 187],
  ["HAP-HN-2132", "51220-SNA-A02", "سیبک طبق سیویک", "Ball Joint Civic", "honda", "control-arms", [["civic", 2006, 2015], ["cr-v", 2007, 2011]], 980_000, null, "in-stock", 90, "ball-joint", "CTR", "کره جنوبی", "OEM", ["bestseller"], 602],
  ["HAP-HN-2133", "51611-T0A-A03", "کمک‌فنر جلو راست سی‌آر‌وی", "Front Right Strut CR-V", "honda", "shocks", [["cr-v", 2012, 2017]], 7_400_000, 8_100_000, "in-stock", 9, "shock-absorber", "KYB", "ژاپن", "OEM", ["bestseller", "special"], 214],
  ["HAP-HN-2134", "52610-SNA-A03", "کمک‌فنر عقب سیویک", "Rear Shock Absorber Civic", "honda", "shocks", [["civic", 2006, 2011]], 3_900_000, null, "in-stock", 18, "shock-absorber", "Showa", "ژاپن", "OEM", [], 139],
  ["HAP-HN-2135", "44300-T2A-A51", "بلبرینگ چرخ جلو آکورد", "Front Wheel Bearing Accord", "honda", "front-suspension", [["accord", 2013, 2017]], 3_600_000, null, "in-stock", 22, "hub-bearing", "NSK", "ژاپن", "OEM", ["new"], 48],
  ["HAP-HN-2136", "42200-TR0-A51", "توپی چرخ عقب سیویک", "Rear Hub Assembly Civic", "honda", "rear-suspension", [["civic", 2012, 2015]], 3_250_000, null, "low-stock", 3, "hub-bearing", "Koyo", "ژاپن", "OEM", [], 57],
  ["HAP-HN-2137", "52390-SWA-A01", "طبق عقب پایین سی‌آر‌وی", "Rear Lower Arm CR-V", "honda", "rear-suspension", [["cr-v", 2007, 2011]], 2_600_000, null, "in-stock", 16, "control-arm", "555 (Sankei)", "ژاپن", "OEM", [], 44],
  // Honda — engine
  ["HAP-HN-3141", "14400-P8A-A02", "کیت تسمه تایم آکورد V6", "Timing Belt Kit J35 V6", "honda", "engine", [["accord", 1998, 2017], ["odyssey", 1999, 2017], ["pilot", 2003, 2017], ["legend", 1996, 2012]], 8_900_000, 9_600_000, "in-stock", 12, "timing-belt", "Gates", "آمریکا", "افترمارکت درجه یک", ["bestseller", "special"], 296],
  ["HAP-HN-3142", "12251-R40-A01", "واشر سرسیلندر آکورد ۲.۴", "Head Gasket K24", "honda", "cylinder-head", [["accord", 2008, 2017], ["cr-v", 2007, 2017], ["element", 2003, 2011]], 1_950_000, null, "in-stock", 37, "gasket", "Honda Genuine", "ژاپن", "اصلی (Genuine)", [], 103],
  ["HAP-HN-3143", "12200-RNA-A00", "سرسیلندر کامل سیویک R18", "Cylinder Head Assembly R18", "honda", "cylinder-head", [["civic", 2006, 2015]], 54_000_000, null, "low-stock", 1, "cylinder-head", "Honda Genuine", "ژاپن", "اصلی (Genuine)", ["new"], 7],
  ["HAP-HN-3144", "13010-R40-A01", "پیستون و رینگ موتور K24", "Piston & Rings K24", "honda", "piston", [["accord", 2008, 2017], ["cr-v", 2007, 2017]], 15_600_000, 16_900_000, "in-stock", 8, "piston", "NPR", "ژاپن", "OEM", ["special"], 41],
  ["HAP-HN-3145", "13011-P2A-003", "رینگ موتور سیویک ۱.۶ (D16)", "Piston Ring Set D16", "honda", "piston", [["civic", 1992, 2000], ["integra", 1990, 2001]], 2_350_000, null, "in-stock", 20, "piston", "Riken", "ژاپن", "OEM", [], 66],
  ["HAP-HN-3146", "19200-RAA-A01", "واترپمپ آکورد و سی‌آر‌وی", "Water Pump K-Series", "honda", "cooling", [["accord", 2003, 2017], ["cr-v", 2002, 2017], ["element", 2003, 2011]], 4_700_000, null, "in-stock", 17, "water-pump", "Aisin", "ژاپن", "OEM", ["bestseller"], 312],
  ["HAP-HN-3147", "19010-RZA-A51", "رادیاتور سی‌آر‌وی", "Radiator CR-V", "honda", "cooling", [["cr-v", 2007, 2011]], 9_800_000, 10_500_000, "in-stock", 6, "radiator", "Denso", "ژاپن", "OEM", ["special"], 55],
  ["HAP-HN-3148", "19010-P8C-A01", "رادیاتور آب اودیسه و پایلوت", "Radiator Odyssey / Pilot", "honda", "cooling", [["odyssey", 1999, 2004], ["pilot", 2003, 2008]], 10_400_000, null, "low-stock", 2, "radiator", "Koyorad", "ژاپن", "OEM", [], 18],
  // Honda — gearbox
  ["HAP-HN-4151", "20021-RFH-000", "گیربکس اتومات کامل آکورد", "Automatic Transmission Accord", "honda", "gearbox", [["accord", 2008, 2012]], 198_000_000, null, "low-stock", 1, "gearbox", "Honda Genuine", "ژاپن", "اصلی (Genuine)", [], 4],
  ["HAP-HN-4152", "22200-RSR-E01", "کیت کلاچ سیویک دنده‌ای", "Clutch Kit Civic MT", "honda", "gearbox", [["civic", 2006, 2015], ["jazz", 2008, 2014]], 6_900_000, 7_500_000, "in-stock", 11, "clutch", "Exedy", "ژاپن", "OEM", ["new", "special"], 39],
  // Honda — electrical / sensors
  ["HAP-HN-5161", "31100-R40-A01", "دینام آکورد ۲.۴", "Alternator Accord 2.4", "honda", "electrical", [["accord", 2008, 2012], ["cr-v", 2010, 2011]], 13_200_000, null, "in-stock", 4, "alternator", "Mitsuba", "ژاپن", "OEM", [], 33],
  ["HAP-HN-5162", "30520-RNA-A01", "کوئل جرقه سیویک و سیتی", "Ignition Coil Civic", "honda", "electrical", [["civic", 2006, 2015], ["city", 2008, 2017], ["jazz", 2008, 2017], ["hr-v", 2015, 2017]], 1_980_000, 2_250_000, "in-stock", 52, "ignition-coil", "Diamond", "ژاپن", "OEM", ["bestseller"], 704],
  ["HAP-HN-5163", "12290-R40-A01", "شمع ایریدیوم هوندا (۴ عددی)", "Iridium Spark Plugs x4", "honda", "electrical", [["accord", 2003, 2017], ["civic", 2001, 2017], ["cr-v", 2002, 2017], ["city", 2002, 2017]], 2_600_000, null, "in-stock", 110, "spark-plug", "NGK", "ژاپن", "OEM", ["bestseller"], 1260],
  ["HAP-HN-5164", "36531-R40-A01", "سنسور اکسیژن آکورد", "Air/Fuel Ratio Sensor Accord", "honda", "sensors", [["accord", 2008, 2012], ["cr-v", 2007, 2011]], 5_900_000, null, "in-stock", 10, "sensor", "Denso", "ژاپن", "OEM", [], 71],
  ["HAP-HN-5165", "57455-SNA-003", "سنسور ABS جلو سیویک", "Front ABS Sensor Civic", "honda", "sensors", [["civic", 2006, 2011]], 2_150_000, null, "in-stock", 19, "sensor", "Honda Genuine", "ژاپن", "اصلی (Genuine)", ["new"], 26],
  ["HAP-HN-5166", "37500-PNB-003", "سنسور میل‌لنگ هوندا", "Crankshaft Sensor", "honda", "sensors", [["accord", 2003, 2007], ["cr-v", 2002, 2006], ["civic", 2002, 2005], ["element", 2003, 2011]], 1_650_000, 1_850_000, "out-of-stock", 0, "sensor", "Hitachi", "ژاپن", "OEM", [], 88],
  // Honda — body / interior
  ["HAP-HN-6171", "33100-T2A-A01", "چراغ جلو LED آکورد راست", "LED Headlight Right Accord", "honda", "body", [["accord", 2016, 2017]], 42_000_000, null, "low-stock", 2, "headlight", "Stanley", "ژاپن", "اصلی (Genuine)", ["new"], 9],
  ["HAP-HN-6172", "76250-TR0-A11", "آینه بغل سیویک راست", "Side Mirror Right Civic", "honda", "body", [["civic", 2012, 2015]], 8_400_000, null, "in-stock", 7, "mirror", "Murakami", "ژاپن", "OEM", [], 21],
  ["HAP-HN-6173", "33500-T0A-A01", "چراغ عقب سی‌آر‌وی چپ", "Tail Lamp Left CR-V", "honda", "body", [["cr-v", 2012, 2016]], 9_100_000, 9_900_000, "in-stock", 4, "taillight", "Stanley", "ژاپن", "اصلی (Genuine)", ["special"], 34],
  ["HAP-HN-6174", "78501-SNA-A81", "غربیلک فرمان سیویک", "Steering Wheel Civic", "honda", "interior", [["civic", 2006, 2011]], 12_600_000, null, "in-stock", 3, "steering-wheel", "Honda Genuine", "ژاپن", "اصلی (Genuine)", [], 12],
  // Honda — consumables
  ["HAP-HN-7181", "15400-PLM-A02", "فیلتر روغن هوندا (اصلی)", "Oil Filter Genuine Honda", "honda", "consumables", [["accord", 1990, 2017], ["civic", 1990, 2017], ["cr-v", 1995, 2017], ["city", 1996, 2017], ["jazz", 2001, 2017], ["odyssey", 1994, 2017], ["pilot", 2002, 2017], ["hr-v", 1998, 2017], ["element", 2003, 2011], ["insight", 1999, 2014], ["prelude", 1990, 2001], ["integra", 1990, 2006], ["s2000", 1999, 2009]], 350_000, 420_000, "in-stock", 400, "oil-filter", "Honda Genuine", "ژاپن", "اصلی (Genuine)", ["bestseller", "special"], 2580],
  ["HAP-HN-7182", "17220-R5A-A00", "فیلتر هوای سی‌آر‌وی", "Air Filter CR-V", "honda", "consumables", [["cr-v", 2012, 2017]], 620_000, null, "in-stock", 130, "air-filter", "Sakura", "ژاپن", "OEM", [], 640],
  ["HAP-HN-7183", "08232-P99-K1LHE", "روغن موتور هوندا ۵W-30 (چهار لیتری)", "Honda Engine Oil 5W-30 4L", "honda", "consumables", [["accord", 1990, 2017], ["civic", 1990, 2017], ["cr-v", 1995, 2017], ["city", 1996, 2017], ["jazz", 2001, 2017], ["pilot", 2002, 2017], ["odyssey", 1994, 2017]], 3_250_000, null, "in-stock", 180, "engine-oil", "Honda Genuine", "ژاپن", "اصلی (Genuine)", ["new", "bestseller"], 1410],
  ["HAP-HN-7184", "14400-PR3-004", "تسمه تایم پرلود و اینتگرا", "Timing Belt Prelude / Integra", "honda", "engine", [["prelude", 1992, 2001], ["integra", 1994, 2001]], 2_400_000, null, "in-stock", 14, "timing-belt", "Mitsuboshi", "ژاپن", "OEM", [], 52],
  ["HAP-HN-7185", "19200-PCX-003", "واترپمپ اس ۲۰۰۰", "Water Pump S2000", "honda", "cooling", [["s2000", 1999, 2009]], 6_200_000, null, "low-stock", 2, "water-pump", "Aisin", "ژاپن", "OEM", ["new"], 10],
  ["HAP-HN-7186", "45251-SR3-A00", "دیسک ترمز جلو سیویک کلاسیک", "Front Disc Civic EG/EK", "honda", "discs-pads", [["civic", 1992, 2000], ["integra", 1990, 2001], ["cr-v", 1995, 2001]], 2_700_000, null, "in-stock", 13, "brake-disc", "Brembo", "ایتالیا", "افترمارکت درجه یک", [], 92],
];

function describe(name: string, manufacturer: string, quality: string, models: string) {
  return `${name} ساخت ${manufacturer} با کیفیت ${quality}، دقیقاً مطابق استاندارد کارخانه و قابل نصب روی ${models}. این قطعه پیش از ارسال توسط کارشناسان فروشگاه حمیدی از نظر اصالت، کد فنی و سلامت بسته‌بندی بررسی می‌شود و با ضمانت اصالت کالا عرضه می‌گردد.`;
}

export const PRODUCTS: Product[] = RAW.map((r, i) => {
  const [sku, oem, name, nameEn, brand, category, fit, price, oldPrice, stock, qty, image, manufacturer, origin, quality, badges, sold] = r;
  const fitments = fit.map(([model, from, to]) => ({ model, from, to }));
  const modelNames = fitments.map((f) => getModel(f.model)?.nameFa ?? f.model).join("، ");
  const day = String(1 + ((i * 7) % 28)).padStart(2, "0");
  const month = String(1 + ((i * 5) % 10)).padStart(2, "0");
  return {
    id: sku,
    slug: sku.toLowerCase(),
    name,
    nameEn,
    sku,
    oem,
    brand,
    category,
    fitments,
    price,
    oldPrice: oldPrice ?? undefined,
    stock,
    stockQty: qty,
    image: `/parts/${image}.svg`,
    manufacturer,
    origin,
    quality,
    warranty: quality === "اصلی (Genuine)" ? "۱۲ ماه ضمانت اصالت و سلامت" : "۶ ماه ضمانت سلامت فیزیکی",
    rating: 4 + ((i * 37) % 10) / 10,
    reviews: 6 + ((i * 13) % 90),
    sold,
    badges,
    addedAt: `2026-${badges.includes("new") ? "10" : month}-${day}`,
    description: describe(name, manufacturer, quality, modelNames),
    specs: [
      { label: "کد فنی", value: sku },
      { label: "شماره OEM", value: oem },
      { label: "سازنده", value: manufacturer },
      { label: "کشور سازنده", value: origin },
      { label: "کیفیت", value: quality },
      { label: "نام لاتین", value: nameEn },
    ],
  };
});

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);

export function fitsVehicle(p: Product, model?: string, year?: number) {
  if (!model) return true;
  return p.fitments.some((f) => f.model === model && (!year || (year >= f.from && year <= f.to)));
}

export const discountPercent = (p: Product) =>
  p.oldPrice ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
