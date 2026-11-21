"""Shared helpers for the Funding Tier investor package (landscape Letter).

Design rules (Nov 21 revision):
  - landscape pages, more room per illustration
  - section titles use an inverted gradient (teal → navy, white text) so they
    read against the navy → teal page band
  - bullets, not paragraphs; one number column per line item, never numbers on
    both sides of a label
  - every money figure that comes from a formula shows its math on the next
    line in a smaller, coloured font
  - layman's terms; every term defined in the glossary
"""
import json, os, datetime
S = None
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/claude/ftdocs/'
logo = open(HERE + '/assets/logo.txt').read()
logo_full = open(HERE + '/assets/logo-full.txt').read()  # official Funding Tier logo (mark + wordmark, white)
DATA = json.load(open(HERE + '/launch-scenarios.json'))
CURVES = json.load(open(HERE + '/election-curves.json'))
SC = DATA['scenarios']; SLIDE = DATA['slide']; ASSUME = DATA['assumptions']
DATE = 'November 21, 2026'

def sc(id_, case, buyout=None):
    return next(o for o in SC if o['id'] == id_ and o['caseKey'] == case and o.get('buyout') == buyout)

M = lambda n: ('-' if n < 0 else '') + '$' + format(int(round(abs(n))), ',')
M2 = lambda n: ('-' if n < 0 else '') + '$' + format(abs(n), ',.2f')
N = lambda n: format(int(round(n)), ',')
P1 = lambda n: f'{n:.1f}%'
P0 = lambda n: f'{n:.0f}%'

CSS = '''<style>
@page { size: Letter landscape; margin: 0; }
:root{--teal:#0f9b8e;--teal2:#0b6f66;--navy:#0b1622;--navy2:#122236;--ink:#0f172a;--mut:#5b6b7b;--mut2:#8a98a6;--line:#dfe6e3;--bg:#f3f7f6;--green:#15803d;--amber:#b45309;--red:#b91c1c;--blue:#1d4ed8;--purple:#6d28d9;--math:#0b6f66}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:var(--ink);font-family:"DM Sans",Arial,sans-serif;font-size:9.6pt;line-height:1.38;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:11in;height:8.5in;overflow:hidden;position:relative;page-break-after:always;background:#fff;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
h1,h2,h3{font-family:"Poppins",sans-serif}
.band{background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 55%,#0f3d3a 100%);color:#fff;padding:0.22in 0.5in 0.2in;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.band .eyebrow{display:flex;align-items:center;gap:8px;font-size:7.8pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#9fd9d1}
.band .eyebrow img{height:20px;width:auto}
.band .eyebrow .sep{color:#5f7a76;margin:0 2px}
.band h1{font-size:17pt;font-weight:900;margin-top:4px;line-height:1.12}
.band p{font-size:8.8pt;color:#c9d6d3;margin-top:4px;max-width:9.6in;line-height:1.35}
.band .where{font-size:7.4pt;color:#9fd9d1;text-align:right;white-space:nowrap;line-height:1.4;flex-shrink:0}
.band .where b{display:block;color:#fff;font-size:8pt}
.pad{padding:0.2in 0.5in 0.42in;flex:1;display:flex;flex-direction:column;gap:8px}
.foot{position:absolute;left:0.5in;right:0.5in;bottom:0.2in;display:flex;justify-content:space-between;font-size:7pt;color:var(--mut2);border-top:1px solid var(--line);padding-top:5px}
.foot b{color:var(--teal)}
/* inverted-gradient section title */
.st{display:flex;align-items:center;gap:10px;background:linear-gradient(90deg,var(--teal) 0%,var(--teal2) 45%,var(--navy2) 100%);color:#fff;border-radius:7px;padding:4px 11px;font-family:"Poppins";font-size:8.6pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin:4px 0 2px}
.st small{font-family:"DM Sans";font-weight:500;letter-spacing:0;text-transform:none;color:#cfece7;font-size:7.6pt;margin-left:auto}
.cols{display:grid;gap:12px}.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:1fr 1fr 1fr}.c4{grid-template-columns:repeat(4,1fr)}.c21{grid-template-columns:2fr 1fr}.c12{grid-template-columns:1fr 2fr}.c32{grid-template-columns:3fr 2fr}.c23{grid-template-columns:2fr 3fr}
ul.b{list-style:none}ul.b li{position:relative;padding:2.2px 0 2.2px 13px;font-size:8.9pt;line-height:1.36}
ul.b li::before{content:"";position:absolute;left:1px;top:8.5px;width:6px;height:6px;border-radius:50%;background:var(--teal)}
ul.b li b{color:var(--ink)}
ul.b.sm li{font-size:8.2pt;padding:1.6px 0 1.6px 12px}ul.b.sm li::before{top:7.5px;width:5px;height:5px}
ol.n{list-style:none;counter-reset:n}ol.n li{position:relative;padding:2.5px 0 2.5px 22px;font-size:8.9pt;line-height:1.36;counter-increment:n}
ol.n li::before{content:counter(n);position:absolute;left:0;top:3.5px;width:15px;height:15px;border-radius:50%;background:var(--teal);color:#fff;font-size:7pt;font-weight:900;display:flex;align-items:center;justify-content:center}
ul.ck{list-style:none}ul.ck li{position:relative;padding:2px 0 2px 16px;font-size:8.4pt;line-height:1.34}
ul.ck li::before{content:"✓";position:absolute;left:0;top:1.5px;color:var(--green);font-weight:900;font-size:9pt}
.math{display:block;font-family:"Inconsolata",monospace;font-size:7.2pt;color:var(--math);margin-top:1px;line-height:1.25;white-space:normal;font-weight:700}
.lede{font-size:9pt;color:var(--mut);line-height:1.4}
table.t{width:100%;border-collapse:collapse;font-size:8.4pt;table-layout:fixed}
table.t th{text-align:left;font-size:7pt;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);padding:4px 6px;border-bottom:2px solid var(--line);vertical-align:bottom;background:#fafcfb}
table.t td{padding:4px 6px;border-bottom:1px solid #edf1f0;vertical-align:top;line-height:1.32}
table.t td.n{text-align:right;white-space:nowrap}table.t th.n{text-align:right}
table.t td.n{font-family:"Inconsolata",monospace;font-weight:700}
table.t td.n .math{text-align:right}
table.t tr.tot td{border-top:2px solid var(--line);border-bottom:none;font-weight:700;background:#f7fbfa}
table.t tr.tot td.n{color:var(--teal2);font-size:9pt}
table.t.sm{font-size:7.7pt}table.t.sm td,table.t.sm th{padding:3px 5px}
table.t.xs{font-size:7pt}table.t.xs td,table.t.xs th{padding:2.2px 4px}
table.t td.g{color:var(--green)}table.t td.r{color:var(--red)}
.kv{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.kv div{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:7px 10px}
.kv .k{font-size:6.8pt;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.6px}
.kv .v{font-family:"Inconsolata",monospace;font-weight:700;font-size:14pt;margin-top:1px;line-height:1.15}
.kv .v.g{color:var(--green)}.kv .v.t{color:var(--teal)}.kv .d{font-size:7.4pt;color:var(--mut);margin-top:1px;line-height:1.3}
.card{background:#fff;border:1px solid var(--line);border-radius:9px;padding:8px 11px;border-left:4px solid var(--c,var(--teal))}
.card h3{font-size:9.4pt;font-weight:700;margin-bottom:2px}
.card .sub{font-size:7.6pt;color:var(--mut);margin-bottom:3px}
.callout{background:#f0fbf9;border:1px solid #bfe9e2;border-radius:9px;padding:7px 11px;font-size:8.4pt;line-height:1.38}
.callout b{color:var(--teal2)}
.where-note{font-size:7.4pt;color:var(--mut);border-left:3px solid var(--line);padding:2px 8px;line-height:1.35}
.where-note b{color:var(--teal2)}
.tag{display:inline-block;font-size:6.6pt;font-weight:900;padding:1px 6px;border-radius:999px;vertical-align:middle}
.tag.h{background:#dcfce7;color:#15803d}.tag.m{background:#f0fdfa;color:#0f766e}.tag.x{background:#fee2e2;color:#b91c1c}.tag.b{background:#f1f5f9;color:#475569}.tag.a{background:#fef3c7;color:#92400e}
.cover{background:linear-gradient(160deg,var(--navy) 0%,var(--navy2) 50%,#0f3d3a 100%);color:#fff;height:8.5in;display:flex;flex-direction:column;justify-content:space-between;padding:0.7in 0.85in}
.cover .eyebrow{display:flex;align-items:center;gap:10px;font-size:9pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#9fd9d1}
.cover .eyebrow img{height:68px;width:auto}
.cover h1{font-size:32pt;font-weight:900;line-height:1.08;margin-top:20px;max-width:7.6in}
.cover .sub{font-size:12pt;color:#c9d6d3;margin-top:12px;max-width:7.6in;line-height:1.45}
.cover .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 30px;font-size:9pt;color:#c9d6d3;border-top:1px solid rgba(255,255,255,.18);padding-top:14px}
.cover .meta b{display:block;color:#9fd9d1;font-size:7.2pt;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2px}
.cover .conf{font-size:7.6pt;color:#8fa3ad;line-height:1.45;max-width:9in;margin-top:12px}
.toc{list-style:none;columns:3;column-gap:20px;font-size:8.2pt}
.toc li{display:flex;justify-content:space-between;gap:8px;padding:2.4px 0;border-bottom:1px dotted var(--line);break-inside:avoid}
.toc li span:last-child{font-family:"Inconsolata",monospace;color:var(--mut)}
.ts{width:100%;border-collapse:collapse;font-size:8.3pt}
.ts th{text-align:left;width:1.75in;vertical-align:top;padding:5.5px 8px 5.5px 0;font-family:"Poppins";font-size:7.9pt;color:var(--teal2);border-bottom:1px solid var(--line)}
.ts td{vertical-align:top;padding:5.5px 0;border-bottom:1px solid var(--line);line-height:1.36}
.ts td ul.b li{font-size:8.3pt;padding:1.4px 0 1.4px 12px}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:16px}
.sig div{border-top:1px solid var(--ink);padding-top:5px;font-size:8.3pt;color:var(--mut)}
.bar{display:flex;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--line);font-size:7.6pt;font-weight:900;color:#fff}
.bar div{display:flex;align-items:center;justify-content:center;white-space:nowrap}
.wf{display:flex;align-items:stretch;gap:0}
.wf .nd{flex:1;background:var(--bg);border:1px solid var(--line);border-top:3px solid var(--c,var(--teal));border-radius:8px;padding:6px 8px}
.wf .nd .k{font-size:6.6pt;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.6px}
.wf .nd .t{font-family:"Poppins";font-weight:700;font-size:8.6pt;margin-top:1px;line-height:1.2}
.wf .nd .d{font-size:7.4pt;color:var(--mut);margin-top:2px;line-height:1.32}
.wf .a{display:flex;align-items:center;padding:0 3px;color:#9aa8b5;font-weight:900;font-size:12pt}
.swot{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.swot .q{border-radius:9px;padding:8px 11px;border:1px solid var(--line);border-top:4px solid var(--c)}
.swot .q h3{font-size:9.4pt;color:var(--c)}
.mini{font-size:7.3pt;color:var(--mut);line-height:1.35}
.hl{background:#fff7d6;border-radius:3px;padding:0 3px}
</style>'''

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;900&family=DM+Sans:wght@400;500;700&family=Inconsolata:wght@700&display=swap" rel="stylesheet"/>'

def head(title):
    return f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>{title}</title>{FONTS}{CSS}</head><body>'

def foot(doc, n, total):
    return f'<div class="foot"><span><img src="{logo}" alt="" style="height:11px;width:auto;vertical-align:-2px;margin-right:4px"/><b>Funding Tier LLC</b> · {doc} · Confidential · {DATE}</span><span>Page {n} of {total}</span></div>'

def page(section, h1, lede, body, doc, n, total, where=None):
    w = f'<div class="where"><b>Also illustrated in</b>{where}</div>' if where else ''
    return f'''<div class="page"><div class="band"><div><div class="eyebrow"><img src="{logo_full}" alt="Funding Tier"/><span class="sep">|</span> {section}</div><h1>{h1}</h1><p>{lede}</p></div>{w}</div><div class="pad">{body}</div>{foot(doc, n, total)}</div>'''

def cover(title, sub, meta, conf=None):
    m = ''.join(f'<div><b>{k}</b>{v}</div>' for k, v in meta)
    conf = conf or 'This document is confidential and is provided to the named recipient solely to evaluate a proposed investment in Funding Tier LLC. It is not an offer to sell securities and is not binding on either party. Any investment will be made only under definitive agreements prepared by counsel. Financial figures are outputs of the company\'s operating model on stated assumptions and are illustrations, not forecasts or guarantees.'
    return f'''<div class="page"><div class="cover"><div><div class="eyebrow"><img src="{logo_full}" alt="Funding Tier"/></div><h1>{title}</h1><div class="sub">{sub}</div></div><div><div class="meta">{m}</div><div class="conf">{conf}</div></div></div></div>'''

def st(title, note=None):
    return f'<div class="st">{title}{f"<small>{note}</small>" if note else ""}</div>'

def ul(items, cls='b'):
    return f'<ul class="{cls}">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'

def ol(items):
    return '<ol class="n">' + ''.join(f'<li>{i}</li>' for i in items) + '</ol>'

def math(s):
    return f'<span class="math">{s}</span>'

def kv(items):
    out = ''
    for k, v, d, *cls in items:
        c = cls[0] if cls else ''
        out += f'<div><div class="k">{k}</div><div class="v {c}">{v}</div><div class="d">{d}</div></div>'
    return f'<div class="kv">{out}</div>'

def where(text):
    return f'<div class="where-note"><b>Where to see it:</b> {text}</div>'

def table(headers, rows, cls='', widths=None, tot=None):
    """headers: list of (label, 'n' | '') ; rows: list of lists of cells (str) — a cell may be a tuple (text, 'n'|'g'|'r')."""
    cg = ''
    if widths:
        if all(str(w).endswith('in') for w in widths):
            tot_w = sum(float(str(w)[:-2]) for w in widths)
            widths = [f'{100 * float(str(w)[:-2]) / tot_w:.1f}%' for w in widths]
        cg = '<colgroup>' + ''.join(f'<col style="width:{w}"/>' for w in widths) + '</colgroup>'
    th = ''.join(f'<th class="{a}">{h}</th>' for h, a in headers)
    body = ''
    for r in rows:
        tds = ''
        for i, c in enumerate(r):
            if isinstance(c, tuple):
                tds += f'<td class="{c[1]}">{c[0]}</td>'
            else:
                tds += f'<td class="{headers[i][1] if i < len(headers) else ""}">{c}</td>'
        body += f'<tr>{tds}</tr>'
    if tot:
        tds = ''
        for i, c in enumerate(tot):
            if isinstance(c, tuple): tds += f'<td class="{c[1]}">{c[0]}</td>'
            else: tds += f'<td class="{headers[i][1] if i < len(headers) else ""}">{c}</td>'
        body += f'<tr class="tot">{tds}</tr>'
    return f'<table class="t {cls}">{cg}<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'

def write(name, title, pages):
    open(OUT + name, 'w').write(head(title) + ''.join(pages) + '</body></html>')
