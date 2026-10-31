#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ربات تدوین «مافیای قاب»
استفاده:   python tool/editor.py 5          -> قسمت ۵ رو می‌سازه
           python tool/editor.py 5 --new    -> فایل تنظیمات (spec.json) رو از اول می‌سازه
کلیپ‌ها:   episodes/05/01.mp4 ، 02.mp4 ، ...  (به ترتیب صحنه‌ها)
خروجی:     output/mafia-ghab-ep05.mp4
"""
import asyncio, base64, json, os, re, subprocess, sys, shutil

try:
    sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

TOOL = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOL)
EPS = os.path.join(ROOT, 'episodes')
OUT = os.path.join(ROOT, 'output')
FONTS = os.path.join(TOOL, 'fonts')

FA = lambda n: str(n).translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))


def log(*a):
    print('>>', *a, flush=True)


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        print(r.stderr.decode('utf-8', 'ignore')[-2000:])
        raise SystemExit('خطا در ffmpeg - پیام بالا رو ببین')
    return r.stdout


def duration(f):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())


def has_audio(f):
    return bool(run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f]).strip())


# ---------------------------------------------------------------- speech detection
def speech(f):
    """returns list of [start,end] seconds where someone talks"""
    import numpy as np
    if not has_audio(f):
        return []
    raw = run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'])
    x = np.frombuffer(raw, np.int16).astype(float)
    fr = 320
    n = len(x) // fr
    if n < 5:
        return []
    e = np.array([np.sqrt(np.mean(x[i * fr:(i + 1) * fr] ** 2)) + 1 for i in range(n)])
    db = 20 * np.log10(e)
    floor, peak = np.percentile(db, 15), np.percentile(db, 97)
    on = db > floor + 0.45 * (peak - floor)
    s, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            s.append([i * 0.02, j * 0.02]); i = j
        else:
            i += 1
    m = []
    for a, b in s:
        if m and a - m[-1][1] < 0.3:
            m[-1][1] = b
        else:
            m.append([a, b])
    return [x for x in m if x[1] - x[0] >= 0.2]


def split_text(t):
    parts = [p.strip() for p in re.findall(r'[^.!?؟…]+[.!?؟…]*', t) if p.strip()]
    out, carry = [], ''
    for p in parts:  # merge very short bits into the next one (or previous if last)
        p = (carry + ' ' + p).strip() if carry else p; carry = ''
        if len(p) < 9:
            carry = p
        else:
            out.append(p)
    if carry:
        if out:
            out[-1] += ' ' + carry
        else:
            out.append(carry)
    final = []
    for p in out:  # long line -> two halves
        if len(p) > 46:
            mid = len(p) // 2
            cut = min([i for i, ch in enumerate(p) if ch in '،, '], key=lambda i: abs(i - mid), default=mid)
            final += [p[:cut + 1].strip(), p[cut + 1:].strip()]
        else:
            final.append(p)
    return [f for f in final if f] or [t]


def timed_subs(f, text):
    d = duration(f)
    sg = speech(f)
    if sg:
        a, b = max(0, sg[0][0] - 0.1), min(d - 0.05, sg[-1][1] + 0.25)
    else:
        a, b = 0.5, d - 0.5
    lines = split_text(text)
    if len(lines) == 1:
        return [[round(a, 2), round(b, 2), lines[0]]]
    total = sum(len(l) for l in lines)
    res, t = [], a
    for k, l in enumerate(lines):
        e = b if k == len(lines) - 1 else t + (b - a) * len(l) / total
        if 0 < k and sg:  # snap start to nearest speech start if close
            near = min((s[0] for s in sg), key=lambda s0: abs(s0 - t))
            if abs(near - t) < 0.6 and near - res[-1][0] > 0.7 and e - near > 0.7:
                t = near; res[-1][1] = round(t - 0.05, 2)
        res.append([round(t, 2), round(e, 2), l]); t = e
    return res


# ---------------------------------------------------------------- prepare episode
def ep_dir(n):
    for name in (f'{n:02d}', str(n)):
        p = os.path.join(EPS, name)
        if os.path.isdir(p):
            return p
    return None


def scene_files(d):
    fs = sorted([f for f in os.listdir(d) if re.fullmatch(r'\d+\.(mp4|mov|MP4|MOV)', f)], key=lambda f: int(f.split('.')[0]))
    return {int(f.split('.')[0]): os.path.join(d, f) for f in fs}


def cut(src, dst, ss, t, gray=False):
    vf = 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24'
    if gray:
        vf += ',hue=s=0.25,eq=brightness=-0.03'
    cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', f'{ss:.2f}', '-t', f'{t:.2f}', '-i', src]
    if has_audio(src):
        cmd += ['-vf', vf, '-af', 'aresample=44100,aformat=channel_layouts=stereo']
    else:
        cmd += ['-f', 'lavfi', '-t', f'{t:.2f}', '-i', 'anullsrc=r=44100:cl=stereo', '-map', '0:v', '-map', '1:a', '-vf', vf]
    run(cmd + ['-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', '-ar', '44100', '-shortest', dst])


def make_spec(n, season):
    E = season['episodes'].get(str(n))
    if not E:
        raise SystemExit(f'اطلاعات قسمت {n} تو فایل فصل نیست')
    d = ep_dir(n)
    if not d:
        raise SystemExit(f'پوشه‌ی episodes/{n:02d} پیدا نشد')
    files = scene_files(d)
    need = len(E['clips'])
    miss = [i for i in range(1, need + 1) if i not in files]
    if miss:
        raise SystemExit('این کلیپ‌ها نیستن: ' + '، '.join(f'{i:02d}.mp4' for i in miss))
    W = os.path.join(d, 'work'); os.makedirs(W, exist_ok=True)
    clips, subs, labels = [], {}, {}

    # 1) cold open
    for k in E['cold']:
        src = files[k]; sg = speech(src); dd = duration(src)
        a = max(0, sg[0][0] - 0.3) if sg else 0
        b = min(dd, sg[-1][1] + 0.4) if sg else dd
        dst = os.path.join(W, f'cold_{k:02d}.mp4'); cut(src, dst, a, b - a)
        clips.append(dst)
        txt = E['clips'][k - 1]['sub']
        if txt:
            subs[str(len(clips))] = timed_subs(dst, txt)
        log(f'شروع تند: صحنه {k}')

    # 2) recap from previous episode
    P = season['episodes'].get(str(n - 1)); pd = ep_dir(n - 1)
    if P and pd:
        pf = scene_files(pd)
        speak = [i for i in range(1, len(P['clips']) + 1) if P['clips'][i - 1]['sub'] and i in pf]
        picks = speak[-2:] if len(speak) >= 2 else speak
        parts = []
        for j, i in enumerate(picks):
            src = pf[i]; sg = speech(src); dd = duration(src)
            a = max(0, sg[0][0] - 0.2) if sg else 0
            b = min(dd, sg[-1][1] + 0.4) if sg else dd
            if j < len(picks) - 1:
                b = min(b, a + 3.0)
            dst = os.path.join(W, f'recap_{j}.mp4'); cut(src, dst, a, b - a, gray=True); parts.append(dst)
        rec = os.path.join(W, 'recap.mp4')
        lst = os.path.join(W, 'recap.txt')
        with open(lst, 'w', encoding='utf-8') as fh:
            for p in parts:
                fh.write("file '" + p.replace('\\', '/') + "'\n")
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', rec])
        clips.append(rec)
        off = sum(duration(p) for p in parts[:-1])
        lastsub = timed_subs(parts[-1], P['clips'][picks[-1] - 1]['sub'])
        subs[str(len(clips))] = [[round(s + off, 2), round(e + off, 2), t] for s, e, t in lastsub]
        labels[str(len(clips))] = [0, min(5.0, duration(rec)), 'قسمت قبل...', 'مافیای قاب']
        log('خلاصه‌ی قسمت قبل ساخته شد')
    else:
        log(f'پوشه‌ی قسمت {n - 1} نبود؛ «قسمت قبل...» رد شد')

    # 3) scenes
    title_clip = len(clips) + 1
    for i in range(1, need + 1):
        clips.append(files[i])
        c = E['clips'][i - 1]
        if c['sub']:
            subs[str(len(clips))] = timed_subs(files[i], c['sub'])
        if str(i) in E['labels']:
            labels[str(len(clips))] = [0.2, 3.5, E['labels'][str(i)], '']
        print(f'   صحنه {i:02d} آماده', flush=True)

    first = 'پایان فصل اول' if E.get('final') else 'ادامه دارد...'
    return {"ep": n, "title": E['title'], "clips": clips, "title_clip": title_clip,
            "subs": subs, "labels": labels,
            "end_lines": [first, E['question'] + '<br>کامنت کن'],
            "out": os.path.join(OUT, f'mafia-ghab-ep{n:02d}.mp4')}


# ---------------------------------------------------------------- render + build
def css():
    V = base64.b64encode(open(os.path.join(FONTS, 'Vazirmatn[wght].ttf'), 'rb').read()).decode()
    L = base64.b64encode(open(os.path.join(FONTS, 'Lalezar-Regular.ttf'), 'rb').read()).decode()
    return f"""@font-face{{font-family:V;src:url(data:font/ttf;base64,{V})}}@font-face{{font-family:L;src:url(data:font/ttf;base64,{L})}}
html,body{{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}}
.c{{position:absolute;left:60px;right:60px;text-align:center;direction:rtl}}
.sub{{position:absolute;left:90px;width:780px;top:1180px;display:flex;justify-content:center}}
.sub div{{direction:rtl;text-align:center;font-family:V;font-weight:800;font-size:54px;line-height:1.5;color:#fff;background:rgba(0,0,0,.55);padding:10px 26px;border-radius:14px;text-shadow:0 2px 6px rgba(0,0,0,.8)}}
.hook{{top:330px;font-family:L;font-size:92px;line-height:1.25;color:#fff;text-shadow:0 0 30px rgba(0,0,0,.9),0 4px 0 #000,0 8px 24px rgba(0,0,0,.9)}} .hook b{{color:#e2b04a;font-weight:400}}
.tt{{top:300px}} .tt .a{{font-family:L;font-size:150px;color:#e2b04a;line-height:1.1;text-shadow:0 0 40px rgba(226,140,40,.5),0 6px 0 #4a2f06,0 10px 30px rgba(0,0,0,.95)}}
.tt .b{{font-family:L;font-size:70px;color:#fff;text-shadow:0 4px 20px rgba(0,0,0,.95)}}
.lab{{top:620px}} .lab .a{{font-family:L;font-size:96px;color:#e2b04a;text-shadow:0 4px 18px rgba(0,0,0,.9)}} .lab .b{{font-family:V;font-weight:700;font-size:46px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.9)}}
.full{{position:absolute;inset:0;background:radial-gradient(ellipse 70% 45% at 50% 52%,rgba(150,70,20,.45),rgba(60,20,10,.15) 55%,transparent 75%),#0b0908;display:flex;flex-direction:column;align-items:center;justify-content:center;direction:rtl}}
.full .t{{font-family:L;color:#e2b04a;font-size:170px;text-shadow:0 0 40px rgba(226,140,40,.45),0 6px 0 #5a3a0a}}
.full .k{{font-family:V;font-weight:700;color:#cfc3ae;font-size:52px}} .full .line{{width:360px;height:4px;background:linear-gradient(90deg,transparent,#e2b04a,transparent);margin:36px 0}}
.full .br{{position:absolute;bottom:170px;font-family:V;font-weight:800;color:#8d8577;font-size:40px;letter-spacing:10px}}"""


async def render(jobs, CSS, opaque=False):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1920})
        for name, html in jobs:
            await pg.set_content(f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{html}</body></html>')
            await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(80)
            await pg.screenshot(path=name, omit_background=not opaque)
        await b.close()


def build(S, W):
    os.makedirs(W, exist_ok=True); os.makedirs(os.path.dirname(S['out']), exist_ok=True)
    CSS = css(); ov = {}; jobs = []

    def add(ci, s, e, html):
        nm = os.path.join(W, f'ov_{ci}_{len(ov.get(ci, []))}.png'); jobs.append((nm, html)); ov.setdefault(ci, []).append((s, e, nm))
    if S.get('hook'):
        h = S['hook'].replace('[[', '<b>').replace(']]', '</b>'); add(1, 0, 3.0, f'<div class="c hook">{h}</div>')
    add(S['title_clip'], 0, 2.6, f'<div class="c tt"><div class="a">مافیای قاب</div><div class="b">قسمت {FA(S["ep"])} · {S["title"]}</div></div>')
    for ci, (s, e, a, b2) in S.get('labels', {}).items():
        add(int(ci), s, e, f'<div class="c lab"><div class="a">{a}</div><div class="b">{b2}</div></div>')
    for ci, lst in S.get('subs', {}).items():
        for s, e, t in lst:
            add(int(ci), s, e, f'<div class="sub"><div>{t}</div></div>')
    t1, t2 = S['end_lines']
    endpng = os.path.join(W, 'end.png')
    log('ساخت زیرنویس‌ها و تیترها...')
    asyncio.run(render(jobs, CSS))
    asyncio.run(render([(endpng, f'<div class="full"><div class="t">{t1}</div><div class="line"></div><div class="k" style="max-width:900px;text-align:center;line-height:1.6">{t2}</div><div class="br">CASE LINE</div></div>')], CSS, opaque=True))
    segs = []
    for i, clip in enumerate(S['clips'], 1):
        print(f'   کلیپ {i}/{len(S["clips"])}', flush=True)
        lst = ov.get(i, []); args = ['ffmpeg', '-v', 'error', '-y', '-i', clip]
        for _, _, nm in lst:
            args += ['-i', nm]
        aud = has_audio(clip)
        if not aud:
            args += ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']
        fc = '[0:v]crop=iw/1.04:ih/1.04,scale=1080:1920:flags=lanczos,unsharp=5:5:0.6,eq=contrast=1.06:saturation=1.08:brightness=0.01,fps=30,setsar=1[v0]'; last = 'v0'
        for k, (s, e, _) in enumerate(lst):
            fc += f";[{last}][{k + 1}:v]overlay=0:0:enable='between(t,{s},{e})'[v{k + 1}]"; last = f'v{k + 1}'
        fc += f';[{last}]format=yuv420p[vo]'
        ain = '0:a' if aud else f'{len(lst) + 1}:a'
        fc += f';[{ain}]aresample=44100,aformat=channel_layouts=stereo[ao]'
        o = os.path.join(W, f'seg{i:02d}.mp4')
        run(args + ['-filter_complex', fc, '-map', '[vo]', '-map', '[ao]', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', o]); segs.append(o)
    e = os.path.join(W, 'end.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-t', '2.5', '-i', endpng, '-f', 'lavfi', '-t', '2.5', '-i', "aevalsrc=0.9*sin(2*PI*(55-20*t)*t)*exp(-3.5*t):s=44100:c=stereo",
         '-filter_complex', "[0]scale=1188:2112,zoompan=z='1+0.04*on/75':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,fade=in:0:8,format=yuv420p[v]",
         '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-ar', '44100', '-shortest', e]); segs.append(e)
    log('چسبوندن همه‌ی کلیپ‌ها (چند دقیقه طول می‌کشه)...')
    X = 0.2; durs = [duration(s) for s in segs]
    args = ['ffmpeg', '-v', 'error', '-y']
    for s in segs:
        args += ['-i', s]
    fc = ''; lv = '0:v'; la = '0:a'; off = 0
    for k in range(1, len(segs)):
        off += durs[k - 1] - X
        fc += f'[{lv}][{k}:v]xfade=transition=fade:duration={X}:offset={off:.3f}[xv{k}];[{la}][{k}:a]acrossfade=d={X}[xa{k}];'
        lv = f'xv{k}'; la = f'xa{k}'
    fc += f'[{la}]loudnorm=I=-14:TP=-1.5:LRA=11[aout]'
    script = os.path.join(W, 'join.txt')
    with open(script, 'w', encoding='utf-8') as fh:
        fh.write(fc)
    run(args + ['-filter_complex_script', script, '-map', f'[{lv}]', '-map', '[aout]', '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart', S['out']])


def main():
    if len(sys.argv) < 2:
        n = input('شماره‌ی قسمت رو بنویس: ').strip()
    else:
        n = sys.argv[1]
    n = int(n.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')))
    seasons = sorted(f for f in os.listdir(TOOL) if re.fullmatch(r'season\d+\.json', f))
    season = None
    for f in seasons:
        s = json.load(open(os.path.join(TOOL, f), encoding='utf-8'))
        if str(n) in s['episodes']:
            season = s
    if not season:
        raise SystemExit(f'قسمت {n} تو هیچ فایل فصلی نیست (پوشه‌ی tool)')
    d = ep_dir(n)
    if not d:
        raise SystemExit(f'اول کلیپ‌ها رو بریز تو پوشه‌ی episodes\\{n:02d}')
    specf = os.path.join(d, 'spec.json')
    if os.path.exists(specf) and '--new' not in sys.argv:
        log('از spec.json قبلی استفاده می‌کنم (برای ساخت از اول: --new)')
        S = json.load(open(specf, encoding='utf-8'))
    else:
        log(f'آماده‌سازی قسمت {n}: {season["episodes"][str(n)]["title"]}')
        S = make_spec(n, season)
        json.dump(S, open(specf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    W = os.path.join(d, 'work', 'build')
    if os.path.isdir(W):
        shutil.rmtree(W)
    build(S, W)
    log('تموم شد!  ->  ' + S['out'])


if __name__ == '__main__':
    main()
