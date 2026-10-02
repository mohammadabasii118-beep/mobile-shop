import { Smartphone, BatteryCharging, Shield, Zap, Sparkles, Headphones, Cable, Gem } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Tile {
  label: string;
  icon: LucideIcon;
  from: string;
  to: string;
}

export const marqueeTiles: Tile[] = [
  { label: 'Phone Cases', icon: Smartphone, from: '#18011F', to: '#B600A8' },
  { label: 'Fast Chargers', icon: Zap, from: '#0b1d3a', to: '#2f7bff' },
  { label: 'Power Banks', icon: BatteryCharging, from: '#06241c', to: '#10b981' },
  { label: 'Tempered Glass', icon: Shield, from: '#1f1235', to: '#7621B0' },
  { label: 'Phone Charms', icon: Gem, from: '#2a0a12', to: '#ff4d6d' },
  { label: 'Cables', icon: Cable, from: '#2b1600', to: '#BE4C00' },
  { label: 'Earbuds', icon: Headphones, from: '#0d2530', to: '#22d3ee' },
  { label: 'Magsafe', icon: Sparkles, from: '#241a00', to: '#facc15' },
  { label: 'Phone Cases', icon: Smartphone, from: '#12122b', to: '#6366f1' },
  { label: 'Fast Chargers', icon: Zap, from: '#2a0a2a', to: '#d946ef' },
  { label: 'Power Banks', icon: BatteryCharging, from: '#2b1000', to: '#f97316' },
  { label: 'Tempered Glass', icon: Shield, from: '#06202a', to: '#06b6d4' },
  { label: 'Phone Charms', icon: Gem, from: '#1b0a2b', to: '#a855f7' },
  { label: 'Cables', icon: Cable, from: '#0a2018', to: '#34d399' },
  { label: 'Earbuds', icon: Headphones, from: '#2a1010', to: '#f43f5e' },
  { label: 'Magsafe', icon: Sparkles, from: '#101a2b', to: '#60a5fa' },
  { label: 'Phone Cases', icon: Smartphone, from: '#24102a', to: '#e879f9' },
  { label: 'Fast Chargers', icon: Zap, from: '#0f2a10', to: '#4ade80' },
  { label: 'Power Banks', icon: BatteryCharging, from: '#2a2410', to: '#eab308' },
  { label: 'Tempered Glass', icon: Shield, from: '#101a2a', to: '#38bdf8' },
  { label: 'Phone Charms', icon: Gem, from: '#2a1020', to: '#ec4899' },
];

export const categories = [
  { name: 'Phone Cases', text: 'Slim, rugged, clear and MagSafe-ready cases for iPhone, Samsung, Xiaomi and more, built to protect without the bulk.' },
  { name: 'Chargers & Cables', text: 'Fast-charging wall adapters, car chargers and braided cables, certified safe for all your devices.' },
  { name: 'Power Banks', text: 'Pocket-size and high-capacity power banks with PD fast charging, so your phone never dies on the go.' },
  { name: 'Screen Glass', text: 'Tempered glass protectors with 9H hardness, anti-fingerprint and privacy options, with an easy install kit included.' },
  { name: 'Charms & Pendants', text: 'Phone straps, pendants and charms that add personality and style to your phone, from minimal to playful.' },
];

export interface Product {
  name: string;
  category: string;
  price: string;
  tiles: [Tile, Tile, Tile];
}

export const products: Product[] = [
  {
    name: 'Aero MagSafe Case',
    category: 'Phone Cases',
    price: '$24',
    tiles: [
      { label: 'Clear', icon: Smartphone, from: '#18011F', to: '#B600A8' },
      { label: 'Shockproof', icon: Shield, from: '#1f1235', to: '#7621B0' },
      { label: 'MagSafe', icon: Sparkles, from: '#2b1600', to: '#BE4C00' },
    ],
  },
  {
    name: 'Volt 20000 Power Bank',
    category: 'Power Banks',
    price: '$39',
    tiles: [
      { label: '65W PD', icon: Zap, from: '#0b1d3a', to: '#2f7bff' },
      { label: '20,000 mAh', icon: BatteryCharging, from: '#06241c', to: '#10b981' },
      { label: 'Fast Charge', icon: BatteryCharging, from: '#2a0a2a', to: '#d946ef' },
    ],
  },
  {
    name: 'Crystal 9H Glass Pack',
    category: 'Screen Glass',
    price: '$12',
    tiles: [
      { label: '9H Hard', icon: Shield, from: '#06202a', to: '#06b6d4' },
      { label: 'Privacy', icon: Shield, from: '#101a2a', to: '#38bdf8' },
      { label: 'Easy Install', icon: Gem, from: '#2a1020', to: '#ec4899' },
    ],
  },
];
