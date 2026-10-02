import { useRef, useState } from 'react';
import { ImagePlus, Type, Smartphone, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShop } from '@/store';
import { products } from '@/data/products';

const MODELS = ['آیفون 16 پرو مکس', 'آیفون 16 پرو', 'آیفون 15 پرو مکس', 'سامسونگ S25 Ultra', 'سامسونگ S25'];
const COLORS = [['بنفش', '#8B5CF6'], ['سرخابی', '#EC4899'], ['آبی', '#38BDF8'], ['نارنجی', '#FB923C'], ['مشکی', '#1a1a1d'], ['سفید', '#f1f5f9']];

/** شخصی‌سازی قاب — UI و پیش‌نمایش دمو (بدون Backend). */
export function CaseCustomizer() {
  const [model, setModel] = useState(MODELS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [text, setText] = useState('CaseLine');
  const [img, setImg] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const addToCart = useShop((s) => s.addToCart);
  const base = products.find((p) => p.id === 'p2')!;
  const dark = ['#f1f5f9'].includes(color[1]);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="card grid place-items-center bg-gradient-to-b from-surface2 to-surface p-8">
        <motion.div key={model} initial={{ rotateY: -25, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} className="relative h-[420px] w-[210px] overflow-hidden rounded-[38px] border border-white/20 shadow-glow" style={{ background: `linear-gradient(145deg, ${color[1]}, #0c0c0c 130%)` }}>
          {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
          <div className="absolute right-3 top-3 h-20 w-20 rounded-3xl border border-white/20 bg-black/60"><div className="m-2.5 h-6 w-6 rounded-full bg-neutral-900 ring-1 ring-white/30" /><div className="absolute bottom-3 right-3 h-6 w-6 rounded-full bg-neutral-900 ring-1 ring-white/30" /><div className="absolute bottom-3 left-3 h-6 w-6 rounded-full bg-neutral-900 ring-1 ring-white/30" /></div>
          <p className={`absolute inset-x-0 bottom-14 px-3 text-center text-2xl font-black drop-shadow ${dark ? 'text-ink' : 'text-white'}`}>{text}</p>
          <span className="absolute inset-x-0 bottom-4 text-center text-[10px] text-white/60">{model}</span>
        </motion.div>
      </div>
      <div className="space-y-6">
        <div><h4 className="mb-3 flex items-center gap-2 font-black text-white"><Smartphone size={18} />مدل گوشی</h4>
          <div className="flex flex-wrap gap-2">{MODELS.map((m) => <button key={m} onClick={() => setModel(m)} className={`chip ${model === m ? 'chip-on' : 'text-mist/70'}`}>{m}</button>)}</div></div>
        <div><h4 className="mb-3 flex items-center gap-2 font-black text-white"><Palette size={18} />رنگ قاب: {color[0]}</h4>
          <div className="flex gap-3">{COLORS.map((c) => <button key={c[0]} aria-label={c[0]} onClick={() => setColor(c)} className={`h-9 w-9 rounded-full border-2 transition ${color[0] === c[0] ? 'scale-110 border-white' : 'border-transparent'}`} style={{ background: c[1] }} />)}</div></div>
        <div><h4 className="mb-3 flex items-center gap-2 font-black text-white"><ImagePlus size={18} />عکس شما</h4>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setImg(URL.createObjectURL(f)); }} />
          <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => file.current?.click()}>آپلود عکس</button>{img && <button className="btn btn-ghost" onClick={() => setImg(undefined)}>حذف</button>}</div></div>
        <div><h4 className="mb-3 flex items-center gap-2 font-black text-white"><Type size={18} />متن دلخواه</h4>
          <input className="input" maxLength={18} value={text} onChange={(e) => setText(e.target.value)} /></div>
        <button className="btn btn-primary w-full" onClick={() => addToCart(base.id, { model, color: color[0], custom: { text, image: img } })}>افزودن قاب شخصی‌سازی‌شده به سبد</button>
        <p className="text-xs text-mist/50">پیش‌نمایش نمایشی است؛ پردازش تصویر نهایی پس از اتصال Backend انجام می‌شود.</p>
      </div>
    </div>
  );
}
