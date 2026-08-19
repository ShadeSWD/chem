/* labware.js — посуда и оборудование лаборатории в SVG.
 *
 * Каждая функция возвращает строку разметки и рисует предмет так, как он
 * выглядит на столе: с делениями там, где они есть (бюретка, цилиндр,
 * мерная колба), с меткой уровня жидкости и с реальным цветом раствора,
 * который приходит снаружи — его считает chemcore по составу, а не
 * назначает рисовальщик.
 *
 * Система координат: у каждого предмета своя локальная, начало — левый
 * верхний угол габарита. Для размещения на столе есть at(x, y, markup).
 * Доска везде viewBox="0 0 640 H", как в остальном кластере.
 */
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Labware = api;
}(typeof self !== 'undefined' ? self : this, function () {

  const C = {
    ink: '#16161a',
    water: '#155e75',
    red: '#b3382e',
    green: '#1a7f37',
    gray: '#6b6b74',
    glass: '#cfe0e6',
    glassFill: 'rgba(21,94,117,.05)',
    metal: '#9aa4ab',
  };

  const n = (v) => Math.round(v * 10) / 10;
  const at = (x, y, s) => `<g transform="translate(${n(x)},${n(y)})">${s}</g>`;

  const txt = (x, y, s, fill, size, anchor) =>
    `<text x="${n(x)}" y="${n(y)}"${anchor ? ` text-anchor="${anchor}"` : ''}` +
    ` style="font:${size || 11}px system-ui;fill:${fill || C.gray}">${s}</text>`;

  const line = (x1, y1, x2, y2, stroke, w, extra) =>
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ` +
    `stroke="${stroke || C.ink}" stroke-width="${w || 1.4}" stroke-linecap="round"${extra || ''}/>`;

  const path = (d, stroke, w, fill, extra) =>
    `<path d="${d}" fill="${fill || 'none'}" stroke="${stroke || C.ink}" ` +
    `stroke-width="${w || 1.4}" stroke-linejoin="round" stroke-linecap="round"${extra || ''}/>`;

  const circle = (cx, cy, r, fill, stroke, w) =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill || 'none'}"` +
    `${stroke ? ` stroke="${stroke}" stroke-width="${w || 1.4}"` : ''}/>`;

  const rect = (x, y, w, h, fill, stroke, sw, rx) =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"` +
    `${rx ? ` rx="${rx}"` : ''} fill="${fill || 'none'}"` +
    `${stroke ? ` stroke="${stroke}" stroke-width="${sw || 1.4}"` : ''}/>`;

  /* Уровень жидкости: доля от 0 до 1, отсчёт снизу. */
  const lvl = (f) => Math.max(0, Math.min(1, f || 0));

  /* Сквозной счётчик для id внутри разметки (clipPath). Два предмета одного
     вида на одной доске не должны делить один id: второй перебил бы обрезку
     первого. */
  let uid = 0;
  const nextId = (p) => p + '-' + (++uid);

  /* ================= пробирка ================= */

  /* Пробирка: h — высота, w — ширина, fill — доля заполнения, color — цвет
     раствора, opt.solid — доля осадка на дне, opt.gas — пузырьки. */
  function tube(w, h, fill, color, opt) {
    const o = opt || {};
    const r = w / 2;
    const inner = h - r - 4;                      // высота цилиндрической части
    const lq = lvl(fill) * inner;
    const top = h - r - lq;
    let s = '';
    /* жидкость: прямоугольник + полукруглое дно */
    if (lq > 0.5) {
      s += `<path d="M 2 ${n(top)} L ${n(w - 2)} ${n(top)} L ${n(w - 2)} ${n(h - r)} ` +
        `A ${n(r - 2)} ${n(r - 2)} 0 0 1 2 ${n(h - r)} Z" fill="${color || '#dff0f5'}" opacity=".85"/>`;
      s += line(2, top, w - 2, top, C.water, 1);
    }
    /* осадок на дне */
    if (o.solid > 0) {
      const sh = 4 + lvl(o.solid) * (r + 6);
      s += `<path d="M 3 ${n(h - sh)} L ${n(w - 3)} ${n(h - sh)} L ${n(w - 3)} ${n(h - r)} ` +
        `A ${n(r - 3)} ${n(r - 3)} 0 0 1 3 ${n(h - r)} Z" fill="${o.solidColor || '#b9c2c8'}"/>`;
    }
    /* пузырьки газа */
    if (o.gas > 0) {
      for (let i = 0; i < 7; i++) {
        const t = ((o.gas * 1.3 + i * 0.17) % 1);
        const by = h - r - t * lq;
        if (by > top + 2) s += circle(6 + (i * 5) % (w - 12), by, 1.4 + (i % 3) * 0.6, 'rgba(21,94,117,.45)');
      }
    }
    /* стекло */
    s += path(`M 2 0 L 2 ${n(h - r)} A ${n(r - 2)} ${n(r - 2)} 0 0 0 ${n(w - 2)} ${n(h - r)} L ${n(w - 2)} 0`,
      C.glass, 2.2);
    s += line(0, 0, w, 0, C.glass, 2.6);
    return s;
  }

  /* ================= коническая колба (Эрленмейера) ================= */

  function flaskConical(w, h, fill, color, opt) {
    const o = opt || {};
    const neckW = 18, neckH = 26;
    const bodyTop = neckH;
    const bodyH = h - neckH;
    const cx = w / 2;
    const lq = lvl(fill) * (bodyH - 6);
    const top = h - lq;
    /* границы конуса на высоте y: линейно от neckW/2 до w/2 */
    const half = (y) => {
      const t = (y - bodyTop) / bodyH;
      return neckW / 2 + (w / 2 - neckW / 2) * Math.max(0, Math.min(1, t));
    };
    let s = '';
    if (lq > 0.5) {
      const hw = half(top);
      s += `<path d="M ${n(cx - hw)} ${n(top)} L ${n(cx + hw)} ${n(top)} ` +
        `L ${n(cx + w / 2 - 2)} ${n(h - 3)} L ${n(cx - w / 2 + 2)} ${n(h - 3)} Z" ` +
        `fill="${color || '#dff0f5'}" opacity=".85"/>`;
      s += line(cx - hw, top, cx + hw, top, C.water, 1);
    }
    if (o.solid > 0) {
      const sh = 4 + lvl(o.solid) * 14;
      s += `<path d="M ${n(cx - w / 2 + 3 + sh * 0.4)} ${n(h - 3 - sh)} ` +
        `L ${n(cx + w / 2 - 3 - sh * 0.4)} ${n(h - 3 - sh)} ` +
        `L ${n(cx + w / 2 - 3)} ${n(h - 3)} L ${n(cx - w / 2 + 3)} ${n(h - 3)} Z" ` +
        `fill="${o.solidColor || '#b9c2c8'}"/>`;
    }
    if (o.gas > 0) {
      for (let i = 0; i < 8; i++) {
        const t = ((o.gas * 1.1 + i * 0.13) % 1);
        const by = h - 6 - t * lq;
        if (by > top + 2) s += circle(cx - 12 + (i * 7) % 24, by, 1.3 + (i % 3) * 0.6, 'rgba(21,94,117,.4)');
      }
    }
    s += path(`M ${n(cx - neckW / 2)} 0 L ${n(cx - neckW / 2)} ${n(bodyTop)} ` +
      `L ${n(cx - w / 2 + 2)} ${n(h - 3)} L ${n(cx + w / 2 - 2)} ${n(h - 3)} ` +
      `L ${n(cx + neckW / 2)} ${n(bodyTop)} L ${n(cx + neckW / 2)} 0`, C.glass, 2.2);
    s += line(cx - w / 2 + 2, h - 3, cx + w / 2 - 2, h - 3, C.glass, 2.4);
    s += line(cx - neckW / 2 - 3, 0, cx + neckW / 2 + 3, 0, C.glass, 2.6);
    return s;
  }

  /* ================= мерная колба ================= */

  /* Главное отличие от конической — узкое горло с КОЛЬЦЕВОЙ МЕТКОЙ: именно
     до неё доводят раствор, и именно поэтому мерной колбой можно приготовить
     раствор точной концентрации, а стаканом нельзя. */
  function flaskVolumetric(w, h, fill, color, opt) {
    const o = opt || {};
    const neckW = 16, neckH = 40, markY = 16;
    const cx = w / 2;
    const bulbTop = neckH;
    const bulbH = h - neckH;
    const rx = w / 2 - 2, ry = bulbH / 2;
    const bulbCy = neckH + ry;
    let s = '';
    /* уровень: 0…0,88 — в шаре, 0,88…1 — в горле до метки */
    const f = lvl(fill);
    if (f > 0) {
      if (f <= 0.88) {
        const top = h - (f / 0.88) * (bulbH - 4);
        const cid = nextId('cl-vf');
        s += `<clipPath id="${cid}"><ellipse cx="${n(cx)}" cy="${n(bulbCy)}" rx="${n(rx)}" ry="${n(ry)}"/></clipPath>`;
        s += `<rect x="0" y="${n(top)}" width="${n(w)}" height="${n(h - top)}" ` +
          `fill="${color || '#dff0f5'}" opacity=".85" clip-path="url(#${cid})"/>`;
      } else {
        s += `<ellipse cx="${n(cx)}" cy="${n(bulbCy)}" rx="${n(rx)}" ry="${n(ry)}" ` +
          `fill="${color || '#dff0f5'}" opacity=".85"/>`;
        const t = (f - 0.88) / 0.12;
        const top = bulbTop - t * (bulbTop - markY);
        s += rect(cx - neckW / 2 + 1, top, neckW - 2, bulbTop - top + 2, color || '#dff0f5');
      }
    }
    s += `<ellipse cx="${n(cx)}" cy="${n(bulbCy)}" rx="${n(rx)}" ry="${n(ry)}" ` +
      `fill="none" stroke="${C.glass}" stroke-width="2.2"/>`;
    s += rect(cx - neckW / 2, 0, neckW, bulbTop + 2, 'none', C.glass, 2.2);
    /* кольцевая метка */
    s += line(cx - neckW / 2 - 4, markY, cx + neckW / 2 + 4, markY, C.red, 1.6);
    if (o.markLabel !== '') s += txt(cx + neckW / 2 + 7, markY + 4, o.markLabel || 'метка', C.red, 10);
    return s;
  }

  /* ================= мерный цилиндр ================= */

  function cylinder(w, h, fill, color, opt) {
    const o = opt || {};
    const base = 6;
    const inner = h - base - 6;
    const lq = lvl(fill) * inner;
    const top = h - base - lq;
    let s = '';
    if (lq > 0.5) s += rect(2, top, w - 4, lq, color || '#dff0f5') + line(2, top, w - 2, top, C.water, 1);
    s += rect(2, 4, w - 4, h - base - 4, 'none', C.glass, 2.2);
    /* делений ровно столько, сколько просят — иначе шкала врёт */
    const div = o.divisions || 10;
    for (let i = 1; i < div; i++) {
      const y = h - base - inner * i / div;
      const long = i % 5 === 0;
      s += line(2, y, 2 + (long ? 12 : 7), y, C.gray, 0.9);
      if (long && o.scale) s += txt(2 + 15, y + 3.5, String(Math.round(o.scale * i / div)), C.gray, 9);
    }
    /* подставка */
    s += path(`M ${n(w / 2 - w * 0.55)} ${n(h)} L ${n(w / 2 + w * 0.55)} ${n(h)}`, C.glass, 3);
    s += path(`M 2 ${n(h - base)} L ${n(w / 2 - w * 0.5)} ${n(h)} M ${n(w - 2)} ${n(h - base)} L ${n(w / 2 + w * 0.5)} ${n(h)}`, C.glass, 2);
    return s;
  }

  /* ================= стакан ================= */

  function beaker(w, h, fill, color, opt) {
    const o = opt || {};
    const inner = h - 8;
    const lq = lvl(fill) * inner;
    const top = h - lq - 2;
    let s = '';
    if (lq > 0.5) s += rect(3, top, w - 6, lq, color || '#dff0f5') + line(3, top, w - 3, top, C.water, 1);
    if (o.solid > 0) {
      const sh = 3 + lvl(o.solid) * 16;
      s += rect(4, h - 2 - sh, w - 8, sh, o.solidColor || '#b9c2c8');
    }
    s += path(`M 2 2 L 2 ${n(h - 2)} L ${n(w - 2)} ${n(h - 2)} L ${n(w - 2)} 2`, C.glass, 2.2);
    s += path(`M 2 2 L -3 -1`, C.glass, 2.2);            // носик
    for (let i = 1; i <= 3; i++) {
      const y = h - 2 - inner * i / 4;
      s += line(w - 14, y, w - 4, y, C.gray, 0.9);
    }
    return s;
  }

  /* ================= бюретка ================= */

  /* Бюретка с краном: шкала СВЕРХУ ВНИЗ (0 наверху) — так она и
     градуирована, потому что отсчитывают израсходованный объём. */
  function burette(h, filled, color, opt) {
    const o = opt || {};
    const w = 16;
    const tubeH = h - 34;
    const lq = lvl(filled) * (tubeH - 6);
    const top = 4 + (tubeH - 6 - lq);
    let s = '';
    if (lq > 0.5) s += rect(2, top, w - 4, lq, color || '#dff0f5') + line(2, top, w - 2, top, C.water, 1);
    s += rect(2, 4, w - 4, tubeH, 'none', C.glass, 2.2);
    const div = o.divisions || 10;
    for (let i = 0; i <= div; i++) {
      const y = 4 + (tubeH - 6) * i / div;
      const long = i % 5 === 0;
      s += line(2, y, 2 + (long ? 11 : 6), y, C.gray, 0.9);
      if (long && o.scale !== undefined) s += txt(w + 2, y + 3.5, String(Math.round(o.scale * i / div)), C.gray, 9);
    }
    /* кран */
    const ky = 4 + tubeH + 6;
    s += circle(w / 2, ky, 6, '#fff', C.ink, 1.6);
    s += line(w / 2 - 9, ky, w / 2 + 9, ky, C.ink, 2.4);
    s += rect(w / 2 - 2, ky + 6, 4, 10, 'none', C.glass, 1.8);
    if (o.tapLabel !== '') s += txt(w + 12, ky + 4, o.tapLabel || 'кран', C.gray, 10);
    /* капля */
    if (o.drop !== undefined && o.drop !== null) {
      const dy = ky + 18 + o.drop * 26;
      s += `<path d="M ${n(w / 2)} ${n(dy - 4)} q 4 5 0 8 q -4 -3 0 -8 Z" fill="${color || '#9ec9d8'}"/>`;
    }
    return s;
  }

  /* ================= пипетка Мора ================= */

  /* Пипетка Мора — с ОДНОЙ кольцевой меткой и расширением посередине:
     она отмеряет один-единственный объём, и это её принципиальное отличие
     от градуированной пипетки. */
  function pipetteMohr(h, fill, color) {
    const w = 20;
    const bulbCy = h * 0.45, ry = h * 0.16, rx = 8;
    let s = '';
    if (fill > 0) {
      s += `<ellipse cx="${n(w / 2)} " cy="${n(bulbCy)}" rx="${n(rx - 1.5)}" ry="${n(ry - 1.5)}" fill="${color || '#dff0f5'}" opacity=".85"/>`;
      s += rect(w / 2 - 2, bulbCy + ry - 2, 4, h - bulbCy - ry - 4, color || '#dff0f5');
    }
    s += path(`M ${n(w / 2 - 3)} 0 L ${n(w / 2 - 3)} ${n(bulbCy - ry)}`, C.glass, 2);
    s += path(`M ${n(w / 2 + 3)} 0 L ${n(w / 2 + 3)} ${n(bulbCy - ry)}`, C.glass, 2);
    s += `<ellipse cx="${n(w / 2)}" cy="${n(bulbCy)}" rx="${n(rx)}" ry="${n(ry)}" fill="none" stroke="${C.glass}" stroke-width="2"/>`;
    s += path(`M ${n(w / 2 - 3)} ${n(bulbCy + ry)} L ${n(w / 2 - 1.5)} ${n(h)}`, C.glass, 2);
    s += path(`M ${n(w / 2 + 3)} ${n(bulbCy + ry)} L ${n(w / 2 + 1.5)} ${n(h)}`, C.glass, 2);
    s += line(w / 2 - 7, bulbCy - ry - 10, w / 2 + 7, bulbCy - ry - 10, C.red, 1.6);
    return s;
  }

  /* ================= капельница ================= */

  function dropper(w, h, color, label) {
    let s = rect(2, 10, w - 4, h - 12, color || '#e8eef2', C.glass, 2, 3);
    s += rect(w / 2 - 4, 0, 8, 12, '#dfe7ec', C.ink, 1.2, 2);
    s += line(w / 2, h, w / 2, h + 6, C.glass, 2);
    if (label) s += txt(w / 2, h / 2 + 8, label, C.ink, 9.5, 'middle');
    return s;
  }

  /* ================= воронка с фильтром ================= */

  function funnel(w, h, opt) {
    const o = opt || {};
    const coneH = h * 0.55;
    let s = '';
    if (o.liquid > 0) {
      s += `<path d="M ${n(w * 0.12)} ${n(coneH * 0.35)} L ${n(w * 0.88)} ${n(coneH * 0.35)} ` +
        `L ${n(w / 2 + 3)} ${n(coneH)} L ${n(w / 2 - 3)} ${n(coneH)} Z" fill="${o.color || '#dff0f5'}" opacity=".8"/>`;
    }
    /* бумажный фильтр — складчатый конус внутри воронки */
    s += path(`M ${n(w * 0.1)} 2 L ${n(w / 2)} ${n(coneH - 2)} L ${n(w * 0.9)} 2`, '#c9b99a', 1.6, '#f3ecdd');
    for (let i = 1; i < 4; i++) {
      s += line(w * 0.1 + (w * 0.8) * i / 4, 2, w / 2, coneH - 2, '#d9cbb0', 0.8);
    }
    if (o.solid > 0) {
      s += `<path d="M ${n(w / 2 - 12)} ${n(coneH - 16)} L ${n(w / 2 + 12)} ${n(coneH - 16)} ` +
        `L ${n(w / 2)} ${n(coneH - 3)} Z" fill="${o.solidColor || '#b9c2c8'}"/>`;
    }
    s += path(`M ${n(w * 0.05)} 0 L ${n(w / 2 - 4)} ${n(coneH)} L ${n(w / 2 - 4)} ${n(h)} ` +
      `M ${n(w * 0.95)} 0 L ${n(w / 2 + 4)} ${n(coneH)} L ${n(w / 2 + 4)} ${n(h)}`, C.glass, 2.2);
    return s;
  }

  /* ================= штатив ================= */

  function stand(h, opt) {
    const o = opt || {};
    let s = rect(0, h - 8, 78, 8, '#e2e6e9', C.gray, 1.4, 2);
    s += rect(10, 0, 7, h - 8, '#e2e6e9', C.gray, 1.4, 2);
    (o.clamps || []).forEach((cy) => {
      s += rect(6, cy - 5, 16, 10, '#dfe7ec', C.gray, 1.3, 2);
      s += line(22, cy, 22 + (o.reach || 26), cy, C.gray, 3);
    });
    return s;
  }

  /* ================= спиртовка и плитка ================= */

  function burner(w, h, on) {
    let s = '';
    if (on) {
      s += `<path d="M ${n(w / 2)} ${n(-22)} q 9 12 5 20 q -2 5 -5 6 q -3 -1 -5 -6 q -4 -8 5 -20 Z" ` +
        `fill="#f0a02c" opacity=".9"/>`;
      s += `<path d="M ${n(w / 2)} ${n(-12)} q 5 7 3 12 q -1 3 -3 3 q -2 0 -3 -3 q -2 -5 3 -12 Z" fill="#f5d95e"/>`;
    }
    let g = path(`M ${n(w * 0.18)} ${n(h)} L ${n(w * 0.22)} ${n(h * 0.35)} ` +
      `L ${n(w * 0.78)} ${n(h * 0.35)} L ${n(w * 0.82)} ${n(h)} Z`, C.ink, 1.6, '#e8eef2');
    g += rect(w / 2 - 5, h * 0.35 - 8, 10, 8, '#dfe7ec', C.ink, 1.3);
    g += line(w / 2, h * 0.35 - 8, w / 2, h * 0.35 - 14, '#8a6a3a', 2.6);
    return s + g;
  }

  function hotplate(w, h, on) {
    let s = rect(0, 8, w, h - 8, '#dfe4e8', C.ink, 1.5, 4);
    s += rect(4, 0, w - 8, 10, on ? '#e08a2e' : '#c9d1d6', C.ink, 1.4, 3);
    s += circle(w - 12, h - 8, 4, on ? C.red : '#b9c2c8', C.ink, 1);
    return s;
  }

  /* ================= весы ================= */

  /* Аналитические весы отличаются от технических не видом, а ценой деления:
     0,0001 г против 0,01 г — поэтому цифра на табло приходит извне. */
  function balance(w, h, reading, opt) {
    const o = opt || {};
    let s = rect(0, h - 26, w, 26, '#e2e6e9', C.ink, 1.5, 4);
    s += rect(w * 0.22, h - 40, w * 0.56, 16, '#f6f8f9', C.ink, 1.3, 2);
    s += txt(w * 0.5, h - 28, reading === null || reading === undefined ? '—' : reading,
      C.ink, 12, 'middle');
    s += rect(w * 0.25, h - 48, w * 0.5, 8, '#cfd6db', C.ink, 1.2, 2);   // чашка
    if (o.sample) {
      s += `<ellipse cx="${n(w * 0.5)}" cy="${n(h - 51)}" rx="14" ry="5" fill="${o.sampleColor || '#e8eef2'}" stroke="${C.gray}" stroke-width="1"/>`;
    }
    /* Подпись — внутри габарита прибора: снаружи она вылезала за левый край
       доски и наезжала на линию стола. */
    s += txt(w * 0.5, h - 8, o.label || 'весы', C.gray, 9.5, 'middle');
    return s;
  }

  /* ================= промывалка ================= */

  function washBottle(w, h, squeeze) {
    let s = path(`M ${n(w * 0.2)} ${n(h)} L ${n(w * 0.2)} ${n(h * 0.35)} ` +
      `Q ${n(w * 0.2)} ${n(h * 0.22)} ${n(w * 0.4)} ${n(h * 0.2)} L ${n(w * 0.4)} ${n(h * 0.1)} ` +
      `L ${n(w * 0.6)} ${n(h * 0.1)} L ${n(w * 0.6)} ${n(h * 0.2)} ` +
      `Q ${n(w * 0.8)} ${n(h * 0.22)} ${n(w * 0.8)} ${n(h * 0.35)} L ${n(w * 0.8)} ${n(h)} Z`,
      C.ink, 1.5, '#eef4f7');
    s += path(`M ${n(w * 0.55)} ${n(h * 0.14)} L ${n(w * 1.05)} ${n(h * 0.05)}`, C.ink, 2);
    if (squeeze) {
      s += path(`M ${n(w * 1.06)} ${n(h * 0.06)} q 12 4 20 12`, C.water, 1.6, 'none', ' stroke-dasharray="3 3"');
    }
    s += txt(w * 0.5, h * 0.65, 'H₂O', C.water, 10, 'middle');
    return s;
  }

  /* ================= подписи и стол ================= */

  /* Стол: горизонтальная линия, ниже которой ничего не рисуют. */
  const bench = (w, y) => line(0, y, w, y, '#c7ced3', 3)
    + rect(0, y, w, 6, 'rgba(21,94,117,.05)');

  /* Выноска к предмету: короткая линия и подпись, всегда наружу от предмета. */
  function callout(x, y, dx, dy, s, color) {
    const c = color || C.gray;
    return line(x, y, x + dx, y + dy, c, 1)
      + txt(x + dx + (dx < 0 ? -3 : 3), y + dy + 3.5, s, c, 10.5, dx < 0 ? 'end' : 'start');
  }

  return {
    C, at, txt, line, path, circle, rect, bench, callout,
    tube, flaskConical, flaskVolumetric, cylinder, beaker,
    burette, pipetteMohr, dropper, funnel, stand, burner, hotplate,
    balance, washBottle,
  };
}));
