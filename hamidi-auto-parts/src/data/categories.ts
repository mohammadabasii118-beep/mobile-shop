import type { LucideIcon } from "lucide-react";
import {
  Cog, Layers, CircleDot, Droplets, Settings2, Car, CarFront, ArrowDownUp,
  GitFork, Disc3, CircleSlash2, Zap, Radar, Shield, Armchair, Package,
} from "lucide-react";

export interface Category {
  id: string;
  nameFa: string;
  nameEn: string;
  description: string;
  icon: LucideIcon;
  image: string;
}

export const CATEGORIES: Category[] = [
  { id: "engine", nameFa: "قطعات موتوری", nameEn: "Engine Parts", description: "تسمه تایم، زنجیر، واشر و قطعات داخلی موتور", icon: Cog, image: "/images/parts/timing-belt.png" },
  { id: "cylinder-head", nameFa: "سرسیلندر و متعلقات", nameEn: "Cylinder Head", description: "سرسیلندر، واشر سرسیلندر، سوپاپ و میل‌سوپاپ", icon: Layers, image: "/images/parts/cylinder-head.png" },
  { id: "piston", nameFa: "پیستون و رینگ", nameEn: "Pistons & Rings", description: "پیستون استاندارد و اورسایز، رینگ و گژنپین", icon: CircleDot, image: "/images/parts/piston.png" },
  { id: "cooling", nameFa: "واترپمپ و سیستم خنک‌کننده", nameEn: "Cooling System", description: "واترپمپ، رادیاتور، ترموستات و فن", icon: Droplets, image: "/images/parts/water-pump.png" },
  { id: "gearbox", nameFa: "گیربکس", nameEn: "Transmission", description: "گیربکس CVT و اتومات، دیسک و صفحه کلاچ", icon: Settings2, image: "/images/parts/gearbox.png" },
  { id: "front-suspension", nameFa: "جلوبندی", nameEn: "Front Suspension", description: "طبق، سیبک، بلبرینگ و سگدست جلو", icon: CarFront, image: "/images/parts/control-arm.png" },
  { id: "rear-suspension", nameFa: "عقب‌بندی", nameEn: "Rear Suspension", description: "توپی چرخ، بلبرینگ و بوش‌های عقب", icon: Car, image: "/images/parts/hub-bearing.png" },
  { id: "shocks", nameFa: "کمک‌فنر", nameEn: "Shock Absorbers", description: "کمک‌فنر جلو و عقب، فنر لول و توپی", icon: ArrowDownUp, image: "/images/parts/shock-absorber.png" },
  { id: "control-arms", nameFa: "طبق و سیبک", nameEn: "Control Arms & Ball Joints", description: "طبق کامل، سیبک طبق و سیبک فرمان", icon: GitFork, image: "/images/parts/ball-joint.png" },
  { id: "brakes", nameFa: "سیستم ترمز", nameEn: "Brake System", description: "کالیپر، پمپ ترمز، شیلنگ و ABS", icon: CircleSlash2, image: "/images/parts/brake-disc.png" },
  { id: "discs-pads", nameFa: "دیسک و لنت", nameEn: "Discs & Pads", description: "دیسک ترمز و لنت سرامیکی و نیمه‌فلزی", icon: Disc3, image: "/images/parts/brake-pads.png" },
  { id: "electrical", nameFa: "قطعات برقی", nameEn: "Electrical", description: "دینام، استارت، کوئل و شمع", icon: Zap, image: "/images/parts/alternator.png" },
  { id: "sensors", nameFa: "سنسورها", nameEn: "Sensors", description: "سنسور اکسیژن، ABS، میل‌لنگ و دریچه گاز", icon: Radar, image: "/images/parts/sensor.png" },
  { id: "body", nameFa: "قطعات بدنه", nameEn: "Body Parts", description: "چراغ جلو و عقب، آینه بغل و سپر", icon: Shield, image: "/images/parts/headlight.png" },
  { id: "interior", nameFa: "قطعات داخلی", nameEn: "Interior", description: "غربیلک فرمان، کلید شیشه بالابر و تزئینات", icon: Armchair, image: "/images/parts/steering-wheel.png" },
  { id: "consumables", nameFa: "لوازم مصرفی", nameEn: "Consumables", description: "روغن موتور، فیلتر روغن، هوا و کابین", icon: Package, image: "/images/parts/engine-oil.png" },
];

export const getCategory = (id: string) => CATEGORIES.find((c) => c.id === id);
