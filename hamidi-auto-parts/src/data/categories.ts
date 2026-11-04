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
  { id: "engine", nameFa: "قطعات موتوری", nameEn: "Engine Parts", description: "تسمه تایم، زنجیر، واشر و قطعات داخلی موتور", icon: Cog, image: "/parts/timing-belt.svg" },
  { id: "cylinder-head", nameFa: "سرسیلندر و متعلقات", nameEn: "Cylinder Head", description: "سرسیلندر، واشر سرسیلندر، سوپاپ و میل‌سوپاپ", icon: Layers, image: "/parts/cylinder-head.svg" },
  { id: "piston", nameFa: "پیستون و رینگ", nameEn: "Pistons & Rings", description: "پیستون استاندارد و اورسایز، رینگ و گژنپین", icon: CircleDot, image: "/parts/piston.svg" },
  { id: "cooling", nameFa: "واترپمپ و سیستم خنک‌کننده", nameEn: "Cooling System", description: "واترپمپ، رادیاتور، ترموستات و فن", icon: Droplets, image: "/parts/water-pump.svg" },
  { id: "gearbox", nameFa: "گیربکس", nameEn: "Transmission", description: "گیربکس CVT و اتومات، دیسک و صفحه کلاچ", icon: Settings2, image: "/parts/gearbox.svg" },
  { id: "front-suspension", nameFa: "جلوبندی", nameEn: "Front Suspension", description: "طبق، سیبک، بلبرینگ و سگدست جلو", icon: CarFront, image: "/parts/control-arm.svg" },
  { id: "rear-suspension", nameFa: "عقب‌بندی", nameEn: "Rear Suspension", description: "توپی چرخ، بلبرینگ و بوش‌های عقب", icon: Car, image: "/parts/hub-bearing.svg" },
  { id: "shocks", nameFa: "کمک‌فنر", nameEn: "Shock Absorbers", description: "کمک‌فنر جلو و عقب، فنر لول و توپی", icon: ArrowDownUp, image: "/parts/shock-absorber.svg" },
  { id: "control-arms", nameFa: "طبق و سیبک", nameEn: "Control Arms & Ball Joints", description: "طبق کامل، سیبک طبق و سیبک فرمان", icon: GitFork, image: "/parts/ball-joint.svg" },
  { id: "brakes", nameFa: "سیستم ترمز", nameEn: "Brake System", description: "کالیپر، پمپ ترمز، شیلنگ و ABS", icon: CircleSlash2, image: "/parts/brake-disc.svg" },
  { id: "discs-pads", nameFa: "دیسک و لنت", nameEn: "Discs & Pads", description: "دیسک ترمز و لنت سرامیکی و نیمه‌فلزی", icon: Disc3, image: "/parts/brake-pads.svg" },
  { id: "electrical", nameFa: "قطعات برقی", nameEn: "Electrical", description: "دینام، استارت، کوئل و شمع", icon: Zap, image: "/parts/alternator.svg" },
  { id: "sensors", nameFa: "سنسورها", nameEn: "Sensors", description: "سنسور اکسیژن، ABS، میل‌لنگ و دریچه گاز", icon: Radar, image: "/parts/sensor.svg" },
  { id: "body", nameFa: "قطعات بدنه", nameEn: "Body Parts", description: "چراغ جلو و عقب، آینه بغل و سپر", icon: Shield, image: "/parts/headlight.svg" },
  { id: "interior", nameFa: "قطعات داخلی", nameEn: "Interior", description: "غربیلک فرمان، کلید شیشه بالابر و تزئینات", icon: Armchair, image: "/parts/steering-wheel.svg" },
  { id: "consumables", nameFa: "لوازم مصرفی", nameEn: "Consumables", description: "روغن موتور، فیلتر روغن، هوا و کابین", icon: Package, image: "/parts/engine-oil.svg" },
];

export const getCategory = (id: string) => CATEGORIES.find((c) => c.id === id);
