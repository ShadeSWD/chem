/* lab-ions.js — работа 3: качественные реакции на катионы и анионы.
 *
 * Главное отличие этой работы от «книжной» таблицы качественных реакций:
 * стенд НЕ хранит списка вида «BaCl₂ + сульфат = осадок». Каждый раз, когда
 * студент приливает реагент, стенд
 *   1) считает концентрации всех ионов после сливания (ChemCore.mix —
 *      объёмы складываются, концентрации падают пропорционально);
 *   2) для каждой малорастворимой соли из таблицы ПР считает произведение
 *      концентраций ПК = [Kt]^a·[An]^b и сравнивает его с ПР
 *      (ChemCore.willPrecipitate);
 *   3) осадок показывает только там, где ПК > ПР.
 * Поэтому один и тот же свинец с разбавленной соляной кислотой осадка не
 * даёт (ПК < ПР), а с концентрированной — даёт: результат зависит от того,
 * что студент реально взял.
 *
 * Табличным здесь остаётся только ВИД осадка (цвет и характер) — это
 * справочное свойство вещества, оно вынесено в константу OBS с подписью
 * «что именно наблюдается». Сам факт выпадения всегда считается по ПР.
 *
 * Объём газа считается: CO₂ — через ChemCore.gasFromMass по массе карбоната
 * в пробе, NH₃ — через ChemCore.gasVolume по количеству вещества.
 * Цвет влажной индикаторной бумажки над пробиркой с аммиаком берётся из
 * ChemCore.indicatorColor по pH раствора аммиака (ChemCore.pHWeakBase).
 */
'use strict';
(function () {
  const CC = window.ChemCore, W = window.Labware, L = window.Lab;
  const C = W.C;

  /* ================= состав задачи и реактивы ================= */

  /* Задача № 4 — раствор трёх аммонийных солей. Концентрации ионов, моль/л.
     Студенту состав неизвестен: он получает только номер задачи. */
  const TASK = 4;
  const C0 = { 'NH4+': 0.25, 'CO3-2': 0.05, 'SO4-2': 0.05, 'I-': 0.05 };

  const M_CARB = CC.molarMass('(NH4)2CO3');    // 96 г/моль
  const M_BASO4 = CC.molarMass('BaSO4');       // 233 г/моль

  /* Контрольная проба: заведомо известный раствор нитрата свинца. */
  const C_PB = { 'Pb2+': 0.005, 'NO3-': 0.01 };

  const REAG = {
    HCl2: { t: 'HCl, 2 моль/л', ions: { 'H+': 2, 'Cl-': 2 } },
    HCl01: { t: 'HCl, 0,1 моль/л (разб.)', ions: { 'H+': 0.1, 'Cl-': 0.1 } },
    HNO3: { t: 'HNO₃, 2 моль/л', ions: { 'H+': 2, 'NO3-': 2 } },
    BaCl2: { t: 'BaCl₂, 0,1 моль/л', ions: { 'Ba2+': 0.1, 'Cl-': 0.2 } },
    AgNO3: { t: 'AgNO₃, 0,1 моль/л', ions: { 'Ag+': 0.1, 'NO3-': 0.1 } },
    NaOH: { t: 'NaOH, 2 моль/л', ions: { 'Na+': 2, 'OH-': 2 } },
    KI: { t: 'KI, 0,05 моль/л', ions: { 'K+': 0.05, 'I-': 0.05 } },
  };

  /* Малорастворимые соли, которые стенд проверяет каждый раз. Ключ — имя в
     таблице ПР chemcore. nc/na — стехиометрические индексы в формуле. */
  const SALTS = [
    { k: 'AgCl', cat: 'Ag+', an: 'Cl-', nc: 1, na: 1, f: 'AgCl' },
    { k: 'AgI', cat: 'Ag+', an: 'I-', nc: 1, na: 1, f: 'AgI' },
    { k: 'BaSO4', cat: 'Ba2+', an: 'SO4-2', nc: 1, na: 1, f: 'BaSO₄' },
    { k: 'CaCO3', cat: 'Ca2+', an: 'CO3-2', nc: 1, na: 1, f: 'CaCO₃' },
    { k: 'CaSO4', cat: 'Ca2+', an: 'SO4-2', nc: 1, na: 1, f: 'CaSO₄' },
    { k: 'Ca(OH)2', cat: 'Ca2+', an: 'OH-', nc: 1, na: 2, f: 'Ca(OH)₂' },
    { k: 'MgCO3', cat: 'Mg2+', an: 'CO3-2', nc: 1, na: 1, f: 'MgCO₃' },
    { k: 'Mg(OH)2', cat: 'Mg2+', an: 'OH-', nc: 1, na: 2, f: 'Mg(OH)₂' },
    { k: 'Cu(OH)2', cat: 'Cu2+', an: 'OH-', nc: 1, na: 2, f: 'Cu(OH)₂' },
    { k: 'Fe(OH)3', cat: 'Fe3+', an: 'OH-', nc: 1, na: 3, f: 'Fe(OH)₃' },
    { k: 'PbCl2', cat: 'Pb2+', an: 'Cl-', nc: 1, na: 2, f: 'PbCl₂' },
    { k: 'PbI2', cat: 'Pb2+', an: 'I-', nc: 1, na: 2, f: 'PbI₂' },
    { k: 'PbSO4', cat: 'Pb2+', an: 'SO4-2', nc: 1, na: 1, f: 'PbSO₄' },
  ];

  /* Вид осадка — справочное свойство вещества. Здесь только «что именно
     наблюдается»; выпадет ли осадок вообще, решает сравнение ПК с ПР. */
  /* Белые осадки на схеме показаны светло-серым: на бледном растворе чистый
     белый неразличим, а осадок должен быть виден. */
  const WHITE = '#c7d6de';
  const OBS = {
    AgCl: { c: WHITE, t: 'белый творожистый осадок, темнеющий на свету' },
    AgI: { c: '#e3cf6a', t: 'жёлтый творожистый осадок' },
    BaSO4: { c: WHITE, t: 'белый мелкокристаллический осадок' },
    CaCO3: { c: WHITE, t: 'белый осадок, растворимый в кислотах' },
    CaSO4: { c: WHITE, t: 'белый мелкий осадок' },
    'Ca(OH)2': { c: WHITE, t: 'белая муть' },
    MgCO3: { c: WHITE, t: 'белый осадок' },
    'Mg(OH)2': { c: WHITE, t: 'белый студенистый осадок' },
    'Cu(OH)2': { c: '#3fa3c9', t: 'голубой студенистый осадок' },
    'Fe(OH)3': { c: '#8a4a26', t: 'бурый хлопьевидный осадок' },
    PbCl2: { c: WHITE, t: 'белый игольчатый осадок' },
    PbI2: { c: '#e0bc31', t: 'жёлтый («золотой дождь») осадок' },
    PbSO4: { c: WHITE, t: 'белый осадок' },
  };

  const ION = {
    'NH4+': 'NH₄⁺', 'CO3-2': 'CO₃²⁻', 'SO4-2': 'SO₄²⁻', 'I-': 'I⁻',
    'Cl-': 'Cl⁻', 'Ag+': 'Ag⁺', 'Ba2+': 'Ba²⁺', 'Pb2+': 'Pb²⁺',
    'Ca2+': 'Ca²⁺', 'Mg2+': 'Mg²⁺', 'Cu2+': 'Cu²⁺', 'Fe3+': 'Fe³⁺',
    'OH-': 'OH⁻', 'H+': 'H⁺', 'NO3-': 'NO₃⁻', 'Na+': 'Na⁺', 'K+': 'K⁺',
  };

  const LIQ = '#e4eff3';                 // бесцветный раствор: тон для уровня

  /* ================= служебное ================= */

  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
    5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

  /* Число в виде 8,2·10⁻⁴ — как его пишут в тетради. */
  function sci(x, d) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const e = Math.floor(CC.lg(Math.abs(x)));
    const m = x / Math.pow(10, e);
    const ms = m.toFixed(d === undefined ? 1 : d).replace('.', ',');
    return ms + '·10' + String(e).split('').map((ch) => SUP[ch]).join('');
  }

  /* Сливание двух растворов: концентрация каждого иона падает пропорционально
     объёмам. Считается через ChemCore.mix — той же функцией, что в теории. */
  function blend(a, Va, b, Vb) {
    const out = {};
    const keys = {};
    Object.keys(a).forEach((k) => { keys[k] = 1; });
    Object.keys(b).forEach((k) => { keys[k] = 1; });
    Object.keys(keys).forEach((k) => {
      const m = CC.mix(a[k] || 0, Va, b[k] || 0, Vb);
      out[k] = m.c1 + m.c2;
    });
    return { c: out, V: Va + Vb };
  }

  /* Проверка всех малорастворимых солей: где ПК > ПР — там осадок. */
  function scan(c) {
    const hits = [], near = [];
    SALTS.forEach((s) => {
      const cc = c[s.cat] || 0, ca = c[s.an] || 0;
      const r = CC.willPrecipitate(s.k, cc, ca, s.nc, s.na);
      const row = { s, cc, ca, IP: r.IP, Ksp: r.Ksp, hit: r.precipitates };
      if (r.precipitates) hits.push(row);
      else if (cc > 0 && ca > 0) near.push(row);       // ионы есть, а осадка нет
    });
    return { hits: hits, near: near };
  }

  /* Строка отчёта по одной соли. */
  const rowText = (r) => r.s.f + ': ПК = ' + sci(r.IP) + (r.hit ? ' > ' : ' < ')
    + 'ПР = ' + sci(r.Ksp) + (r.hit ? ' → осадок' : ' → осадка нет');

  /* Проверить названные соли даже там, где нужного иона нет (ПК = 0):
     именно так доказывают ОТСУТСТВИЕ иона. */
  function probe(c, keys) {
    return keys.map((k) => {
      const s = SALTS.filter((x) => x.k === k)[0];
      const cc = c[s.cat] || 0, ca = c[s.an] || 0;
      const r = CC.willPrecipitate(s.k, cc, ca, s.nc, s.na);
      return { s: s, cc: cc, ca: ca, IP: r.IP, Ksp: r.Ksp, hit: r.precipitates };
    });
  }

  const nSub = (st, ion) => (C0[ion] || 0) * st.Vale / 1000;   // моль в пробе

  /* Объём CO₂ (мл, н.у.) — по массе карбоната аммония в пробе. */
  function vCO2(st) {
    const m = nSub(st, 'CO3-2') * M_CARB;                      // г
    return CC.gasFromMass(m, M_CARB, 1, 1).V * 1000;
  }
  /* Объём NH₃ (мл, н.у.) — по количеству ионов аммония в пробе. */
  const vNH3 = (st) => CC.gasVolume(nSub(st, 'NH4+')) * 1000;
  /* Масса сульфата бария из пробы. */
  const mBaSO4 = (st) => nSub(st, 'SO4-2') * M_BASO4;

  /* Ионы, которые к этому моменту доказаны опытом. */
  function found(st) {
    const f = [];
    if (st.co2) f.push('CO3-2');
    if (st.so4 && st.so4.hit) f.push('SO4-2');
    if (st.hal && st.hal.hit) f.push(st.hal.s.an);
    if (st.nh4) f.push('NH4+');
    return f;
  }
  const foundText = (st) => found(st).map((k) => ION[k]).join(', ');

  /* ================= определение работы ================= */

  L.define('ions', {
    scene: { w: 640, h: 344 },
    alt: 'штатив с четырьмя пробирками, контрольная пробирка со свинцом '
      + 'и подставка с капельницами реактивов',

    init() {
      const tube = (cap) => ({ c: {}, V: 0, solid: null, gas: 0, cap: cap, res: '' });
      return {
        task: TASK,
        Vale: 0,                 // мл пробы в каждой пробирке
        split: false,
        tubes: [tube('карбонат'), tube('сульфат'), tube('галогенид'),
          tube('аммоний'), tube('контроль Pb²⁺')],
        acid2: false,            // пробирка 2 подкислена
        acid3: false,            // пробирка 3 подкислена
        co2: null,               // объём CO₂, мл
        so4: null,               // строка отчёта по BaSO₄
        hal: null,               // строка отчёта по галогениду серебра
        nh3: null,               // объём NH₃, мл
        nh4: null,               // {pH, color} — бумажка над пробиркой 4
        pbCl: null,              // отчёт по PbCl₂ в контрольной пробе
        pbI: null,               // отчёт по PbI₂
        answer: null,
        last: null,              // что показывать на табло справа
      };
    },

    /* ------------------------------------------------------------ сцена */
    draw(st, t) {
      const BENCH = 298;
      let s = W.bench(640, BENCH);

      const TW = 32, TH = 126, TY = BENCH - 12 - TH;
      const SOLID = 0.30;                       // доля осадка на дне
      const fillOf = (tb) => (tb.V > 0 ? Math.min(0.78, tb.V / 5) : 0);

      /* Одна пробирка со всем, что в ней происходит: раствор, осадок,
         оседание хлопьев, пузырьки внутри и над горлом. */
      function drawTube(cxv, tb, num, ph0) {
        let g = '';
        const opt = {};
        if (tb.solid) { opt.solid = SOLID; opt.solidColor = OBS[tb.solid].c; }
        if (tb.gas) opt.gas = t + 0.01;
        g += W.at(cxv - TW / 2, TY, W.tube(TW, TH, fillOf(tb), LIQ, opt));
        g += W.txt(cxv, TY - 10, num, C.gray, 11, 'middle');
        if (st.split) g += W.txt(cxv, BENCH + 16, tb.cap, C.gray, 10, 'middle');
        if (tb.res) g += W.txt(cxv, BENCH + 30, tb.res, C.ink, 10.5, 'middle');
        if (tb.solid) {
          /* граница осадка: без неё белый осадок сливается с раствором */
          const sh = 4 + SOLID * (TW / 2 + 6);
          const ys = TY + TH - sh;
          g += W.line(cxv - TW / 2 + 3, ys, cxv + TW / 2 - 3, ys, C.gray, 1);
          /* оседание: хлопья медленно опускаются от поверхности ко дну */
          const yTop = TY + (TH - TW / 2 - 4) * (1 - fillOf(tb)) + 8;
          for (let k = 0; k < 5; k++) {
            const ph = (t + ph0 + k * 0.21) % 1;
            g += W.circle(cxv - 9 + (k * 4.6) % 18, yTop + ph * (ys - yTop),
              1.5, OBS[tb.solid].c, 'rgba(107,107,116,.35)', 0.6);
          }
        }
        /* пузырьки, уходящие из горла: сбоку, чтобы не задеть номер */
        if (tb.gas) {
          for (let k = 0; k < 3; k++) {
            const ph = (t + k * 0.33) % 1;
            g += W.circle(cxv - 13 + k, TY - 8 - ph * 22, 2.2 - ph,
              'rgba(21,94,117,.35)');
          }
        }
        return g;
      }

      /* --- штатив на четыре пробирки --- */
      s += W.rect(24, BENCH - 58, 288, 9, '#dfe7ec', C.gray, 1.3, 2);
      s += W.rect(24, BENCH - 12, 288, 12, '#e2e6e9', C.gray, 1.4, 3);
      s += W.rect(30, BENCH - 49, 6, 37, '#e2e6e9', C.gray, 1.2, 2);
      s += W.rect(300, BENCH - 49, 6, 37, '#e2e6e9', C.gray, 1.2, 2);

      const cx = (i) => 24 + (i + 0.5) * 72;
      for (let i = 0; i < 4; i++) s += drawTube(cx(i), st.tubes[i], String(i + 1), i * 0.13);

      /* влажная индикаторная бумажка над пробиркой 4 */
      if (st.nh4) {
        s += W.rect(cx(3) + 12, TY - 32, 9, 20, st.nh4.color, C.gray, 1, 1);
        s += W.txt(cx(3) + 16, TY - 38, 'лакмус', C.gray, 9.5, 'middle');
      }

      /* --- контрольная пробирка --- */
      const cxc = 366;
      s += W.rect(340, BENCH - 58, 52, 9, '#dfe7ec', C.gray, 1.3, 2);
      s += W.rect(340, BENCH - 12, 52, 12, '#e2e6e9', C.gray, 1.4, 3);
      s += drawTube(cxc, st.tubes[4], '5', 0.5);

      /* --- подставка с капельницами --- */
      s += W.rect(412, BENCH - 52, 220, 52, '#eef2f4', C.gray, 1.4, 4);
      ['HCl', 'HNO₃', 'BaCl₂', 'AgNO₃', 'NaOH', 'KI'].forEach((lab, i) => {
        s += W.at(422 + i * 35, BENCH - 92, W.dropper(30, 40, '#e8eef2', lab));
      });
      s += W.txt(522, BENCH + 16, 'капельницы с реактивами', C.gray, 10, 'middle');

      /* --- табло: задача и найденные ионы --- */
      s += W.rect(8, 8, 306, 74, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(18, 26, 'Задача № ' + st.task + ': какие ионы в растворе?', C.ink, 11.5);
      s += W.txt(18, 44, st.Vale > 0
        ? 'Проба: ' + L.fmt(st.Vale, 1) + ' мл в каждой из 4 пробирок'
        : 'Проба ещё не разлита', C.gray, 11);
      const f = foundText(st);
      s += W.txt(18, 62, f ? 'Обнаружено: ' + f : 'Обнаружено: —',
        f ? C.green : C.gray, 11);

      /* --- табло: последняя проверка ПК против ПР --- */
      s += W.rect(326, 8, 306, 74, '#f7fafb', '#d7dbe0', 1, 8);
      if (st.last) {
        s += W.txt(336, 26, st.last.title, C.ink, 11.5);
        s += W.txt(336, 44, st.last.line1, st.last.hit ? C.green : C.gray, 11);
        if (st.last.line2) s += W.txt(336, 62, st.last.line2, C.gray, 11);
      } else {
        s += W.txt(336, 26, 'Расчёт осаждения', C.ink, 11.5);
        s += W.txt(336, 44, 'осадок выпадает, если ПК > ПР', C.gray, 11);
        s += W.txt(336, 62, 'приливайте реагент — увидите числа', C.gray, 11);
      }
      return s;
    },

    /* ------------------------------------------------------------ шаги */
    steps: [
      {
        name: 'Получить задачу и разлить пробу',
        hint: 'Анализ ведут порциями: раствор задачи делят на несколько '
          + 'пробирок и в каждой проверяют свой ион. Из одной пробирки анализ '
          + 'не сделать — первый же реагент испортит раствор для остальных проб. '
          + 'Отберите пипеткой по 2 мл задачи в четыре пробирки; пятая, '
          + 'контрольная, уже содержит 2 мл известного раствора '
          + 'Pb(NO₃)₂ 0,005 моль/л — она понадобится в конце.',
        controls: [
          { kind: 'number', id: 'vale', label: 'проба в каждую пробирку', unit: 'мл',
            min: 1, max: 3, step: 0.5, value: 2 },
          { kind: 'act', label: 'Разлить пробу по пробиркам', primary: true,
            act(st, v, ui) {
              const V = v.vale;
              if (!isFinite(V) || V < 1) throw new Error('Меньше 1 мл брать нельзя: '
                + 'осадка будет так мало, что его не разглядеть.');
              if (V > 3) throw new Error('Больше 3 мл в пробирку не берут: '
                + 'после прибавления реагентов раствор пойдёт через край.');
              st.Vale = V;
              for (let i = 0; i < 4; i++) {
                st.tubes[i].c = Object.assign({}, C0);
                st.tubes[i].V = V;
              }
              st.tubes[4].c = Object.assign({}, C_PB);
              st.tubes[4].V = 2;
              st.split = true;
              st.last = { title: 'Проба разлита', hit: false,
                line1: 'растворы бесцветные, прозрачные',
                line2: 'осадка нет ни в одной пробирке' };
              ui.say('В каждой пробирке ' + L.fmt(V, 1) + ' мл задачи № '
                + st.task + '.', 'ok');
            } },
        ],
        done: (st) => st.split,
        observe: (st) => ({
          what: 'Задача № ' + st.task + ' разлита по ' + L.fmt(st.Vale, 1)
            + ' мл в пробирки 1—4; пробирка 5 — контрольная, Pb(NO₃)₂ 0,005 моль/л',
          obs: 'все растворы бесцветные и прозрачные, осадка нет',
        }),
      },

      {
        name: 'Проба на карбонат-ион',
        hint: 'Карбонат обнаруживают первым: он мешает всем остальным пробам, '
          + 'потому что даёт осадки почти со всеми катионами. Признак — '
          + 'выделение углекислого газа при подкислении: '
          + 'CO₃²⁻ + 2H⁺ = CO₂↑ + H₂O. Кислоту приливают по каплям в пробирку 1. '
          + 'Серная кислота здесь не годится — подумайте почему.',
        controls: [
          { kind: 'select', id: 'acid1', label: 'кислота', options: [
            { v: 'HCl', t: 'HCl, 2 моль/л' },
            { v: 'H2SO4', t: 'H₂SO₄, 2 моль/л' }] },
          { kind: 'number', id: 'vacid', label: 'прилить', unit: 'мл',
            min: 0.5, max: 3, step: 0.5, value: 1 },
          { kind: 'act', label: 'Прилить кислоту в пробирку 1', primary: true,
            act(st, v, ui) {
              if (v.acid1 === 'H2SO4') throw new Error('Серной кислотой '
                + 'подкислять нельзя: она вносит в раствор SO₄²⁻, и проба на '
                + 'сульфат после этого ничего не докажет. Возьмите соляную.');
              const Vb = v.vacid;
              if (!isFinite(Vb) || Vb <= 0) throw new Error('Введите объём кислоты.');
              const nCO3 = nSub(st, 'CO3-2');
              const nH = REAG.HCl2.ions['H+'] * Vb / 1000;
              if (nH < 2 * nCO3) throw new Error('Кислоты не хватит: на '
                + L.fmt(nCO3 * 1000, 2) + ' ммоль карбоната нужно вдвое больше '
                + 'ионов H⁺. Прилейте больше.');
              const tb = st.tubes[0];
              const r = blend(tb.c, tb.V, REAG.HCl2.ions, Vb);
              r.c['CO3-2'] = 0;                    // весь карбонат ушёл газом
              tb.c = r.c; tb.V = r.V; tb.gas = 1; tb.res = 'CO₂↑';
              st.co2 = vCO2(st);
              const sc = scan(tb.c);
              st.last = {
                title: 'Пробирка 1 + HCl',
                hit: true,
                line1: 'CO₂: V = n·22,4 = ' + L.fmt(st.co2, 2) + ' мл (н. у.)',
                line2: sc.hits.length ? rowText(sc.hits[0])
                  : (sc.near.length ? rowText(sc.near[0])
                    : 'осадка нет ни по одной соли из таблицы ПР'),
              };
              ui.say('Бурное выделение газа без цвета; известковая вода в '
                + 'газоотводной трубке мутнеет. V(CO₂) = ' + L.fmt(st.co2, 2)
                + ' мл при н. у.', 'ok');
            } },
        ],
        done: (st) => st.co2 !== null,
        observe: (st) => ({
          what: 'Пробирка 1: проба + HCl (2 моль/л) по каплям',
          obs: 'выделяется газ без цвета и запаха, известковая вода мутнеет: '
            + 'CO₃²⁻ обнаружен. Объём газа V = n·22,4 = ' + L.fmt(st.co2, 2)
            + ' мл (н. у.). Осадка нет: ни одна соль из таблицы ПР не имеет ПК > ПР',
        }),
      },

      {
        name: 'Проба на сульфат-ион',
        hint: 'Групповой реагент на сульфат — хлорид бария. Но сначала пробу '
          + 'подкисляют соляной кислотой: карбонат бария тоже белый, и без '
          + 'подкисления вывод будет ложным. BaSO₄ в кислотах не растворяется — '
          + 'именно это и делает пробу доказательной. Стенд посчитает '
          + 'ПК = [Ba²⁺]·[SO₄²⁻] после сливания и сравнит с ПР(BaSO₄) = 1,1·10⁻¹⁰.',
        controls: [
          { kind: 'act', label: 'Подкислить пробирку 2 (0,5 мл HCl)', act(st, v, ui) {
            const tb = st.tubes[1];
            const r = blend(tb.c, tb.V, REAG.HCl2.ions, 0.5);
            r.c['CO3-2'] = 0;
            tb.c = r.c; tb.V = r.V;
            st.acid2 = true;
            ui.say('Проба подкислена, карбонат разрушен — теперь белый осадок '
              + 'может дать только сульфат.', 'ok');
          } },
          { kind: 'act', label: 'Прилить BaCl₂ (1 мл)', primary: true,
            act(st, v, ui) {
              if (!st.acid2) throw new Error('Сначала подкислите пробу: без '
                + 'этого карбонат даст с барием такой же белый осадок, и '
                + 'сульфат окажется «обнаружен» там, где его нет.');
              const tb = st.tubes[1];
              const r = blend(tb.c, tb.V, REAG.BaCl2.ions, 1);
              tb.c = r.c; tb.V = r.V;
              const row = probe(tb.c, ['BaSO4'])[0];
              st.so4 = row;
              if (row.hit) { tb.solid = 'BaSO4'; tb.res = 'BaSO₄↓'; }
              st.last = { title: 'Пробирка 2 + BaCl₂', hit: row.hit,
                line1: rowText(row),
                line2: row.hit ? OBS.BaSO4.t : 'сульфат-ион не обнаружен' };
              ui.say(rowText(row) + (row.hit
                ? '. Наблюдается ' + OBS.BaSO4.t + ' — SO₄²⁻ обнаружен.'
                : '. Сульфат-ион не обнаружен.'), 'ok');
            } },
        ],
        done: (st) => st.so4 !== null,
        observe: (st) => ({
          what: 'Пробирка 2: подкисление HCl, затем BaCl₂ (0,1 моль/л)',
          obs: rowText(st.so4) + '; наблюдается ' + OBS.BaSO4.t
            + ' — SO₄²⁻ обнаружен. Масса осадка из пробы m = n·M = '
            + L.fmt(mBaSO4(st), 4) + ' г',
        }),
      },

      {
        name: 'Проба на галогенид-ионы',
        hint: 'Групповой реагент на галогениды — нитрат серебра. Пробу '
          + 'подкисляют азотной кислотой: соляной нельзя, она сама внесёт '
          + 'хлорид-ионы, и белый осадок появится в любом случае. Цвет осадка '
          + 'различает галогениды: AgCl белый, AgI жёлтый. Какой именно осадок '
          + 'выпадет, стенд решает по ПР: ПР(AgCl) = 1,8·10⁻¹⁰, '
          + 'ПР(AgI) = 8,3·10⁻¹⁷.',
        controls: [
          { kind: 'select', id: 'acid3', label: 'подкислить', options: [
            { v: 'HNO3', t: 'HNO₃, 2 моль/л' },
            { v: 'HCl', t: 'HCl, 2 моль/л' }] },
          { kind: 'act', label: 'Подкислить пробирку 3 (0,5 мл)', act(st, v, ui) {
            if (v.acid3 === 'HCl') throw new Error('Соляной кислотой подкислять '
              + 'нельзя: вы внесёте Cl⁻, и с AgNO₃ выпадет белый AgCl — '
              + 'независимо от того, есть хлорид в задаче или нет. Берут азотную.');
            const tb = st.tubes[2];
            const r = blend(tb.c, tb.V, REAG.HNO3.ions, 0.5);
            r.c['CO3-2'] = 0;
            tb.c = r.c; tb.V = r.V;
            st.acid3 = true;
            ui.say('Проба подкислена азотной кислотой: посторонних галогенидов '
              + 'не внесено, карбонат разрушен.', 'ok');
          } },
          { kind: 'act', label: 'Прилить AgNO₃ (1 мл)', primary: true,
            act(st, v, ui) {
              if (!st.acid3) throw new Error('Сначала подкислите пробу азотной '
                + 'кислотой: иначе серебро свяжет карбонат, и осадок ничего '
                + 'не докажет.');
              const tb = st.tubes[2];
              const r = blend(tb.c, tb.V, REAG.AgNO3.ions, 1);
              tb.c = r.c; tb.V = r.V;
              const rows = probe(tb.c, ['AgCl', 'AgI']);
              const hit = rows.filter((x) => x.hit)[0] || null;
              st.hal = hit || rows[0];
              if (hit) { tb.solid = hit.s.k; tb.res = hit.s.f + '↓'; }
              st.last = { title: 'Пробирка 3 + AgNO₃', hit: !!hit,
                line1: rowText(rows[1]), line2: rowText(rows[0]) };
              ui.say(hit
                ? 'Выпал ' + OBS[hit.s.k].t + ': ' + rowText(hit)
                : 'Осадка нет — галогенид-ионов в пробе нет.', 'ok');
            } },
        ],
        done: (st) => st.hal !== null,
        observe: (st) => ({
          what: 'Пробирка 3: подкисление HNO₃, затем AgNO₃ (0,1 моль/л)',
          obs: st.hal.hit
            ? rowText(st.hal) + '; наблюдается ' + OBS[st.hal.s.k].t + ' — '
              + ION[st.hal.s.an] + ' обнаружен. Для AgCl ПК = 0 < ПР: хлорид-ионов нет'
            : 'осадка нет: ' + rowText(st.hal),
        }),
      },

      {
        name: 'Проба на катионы: щёлочь',
        hint: 'Щёлочь — групповой реагент сразу на многие катионы: Cu²⁺ даёт '
          + 'голубой Cu(OH)₂, Fe³⁺ — бурый Fe(OH)₃, Mg²⁺ — белый Mg(OH)₂, а '
          + 'NH₄⁺ вместо осадка даёт газ: NH₄⁺ + OH⁻ = NH₃↑ + H₂O. '
          + 'Реагент выбираете вы: гидроксиды металлов осаждают и щёлочью, и '
          + 'раствором аммиака, но для аммония годится только одно из двух. '
          + 'Запах в этой работе не проверяют: достаточно увидеть газ и поднести '
          + 'к горлу пробирки влажную индикаторную бумажку. Если запах всё же '
          + 'определяют, то строго по правилам — движением ладони от горла '
          + 'сосуда к себе, не наклоняясь над пробиркой.',
        controls: [
          { kind: 'select', id: 'base', label: 'реагент', options: [
            { v: 'NaOH', t: 'NaOH, 2 моль/л' },
            { v: 'NH3', t: 'NH₃·H₂O, 2 моль/л' }] },
          { kind: 'act', label: 'Прилить реагент (1 мл) и осторожно нагреть',
            act(st, v, ui) {
              if (v.base === 'NH3') throw new Error('Раствором аммиака ион '
                + 'аммония не обнаружить: NH₃·H₂O — слабое основание, оно не '
                + 'вытесняет аммиак из его соли, а само им и является. '
                + 'Гидроксиды металлов аммиаком осаждают, а для NH₄⁺ нужна '
                + 'сильная щёлочь — NaOH.');
              const tb = st.tubes[3];
              const r = blend(tb.c, tb.V, REAG.NaOH.ions, 1);
              tb.c = r.c; tb.V = r.V; tb.gas = 1;
              st.nh3 = vNH3(st);
              const rows = probe(tb.c, ['Cu(OH)2', 'Fe(OH)3', 'Mg(OH)2']);
              const hit = rows.filter((x) => x.hit)[0] || null;
              if (hit) { tb.solid = hit.s.k; tb.res = hit.s.f + '↓'; }
              else tb.res = 'NH₃↑';
              st.last = { title: 'Пробирка 4 + NaOH, нагрев', hit: !!hit,
                line1: hit ? rowText(hit) : 'Cu(OH)₂, Fe(OH)₃, Mg(OH)₂: ПК = 0 < ПР',
                line2: hit ? OBS[hit.s.k].t
                  : 'осадка нет, выделяется газ V = ' + L.fmt(st.nh3, 2) + ' мл' };
              ui.say(hit ? 'Выпал осадок: ' + OBS[hit.s.k].t
                : 'Осадка нет — катионов металлов в пробе нет. Из пробирки '
                  + 'выделяется газ, V(NH₃) = ' + L.fmt(st.nh3, 2) + ' мл (н. у.).',
              'ok');
            } },
          { kind: 'act', label: 'Поднести влажную индикаторную бумажку',
            primary: true, act(st, v, ui) {
              if (st.nh3 === null) throw new Error('Сначала прилейте щёлочь и '
                + 'нагрейте пробирку — газа пока нет.');
              const tb = st.tubes[3];
              const cNH3 = tb.c['NH4+'] || 0;
              const pH = CC.pHWeakBase(cNH3, CC.KB.NH3);
              const col = CC.indicatorColor('litmus', pH);
              st.nh4 = { pH: pH, color: col.c, t: col.t };
              ui.say('Влажный лакмус у горла пробирки — ' + col.t
                + ' (pH раствора аммиака ' + L.fmt(pH, 2)
                + '): выделяется NH₃, значит в задаче есть NH₄⁺.', 'ok');
            } },
        ],
        done: (st) => st.nh4 !== null,
        observe: (st) => ({
          what: 'Пробирка 4: проба + NaOH (2 моль/л), лёгкое нагревание',
          obs: 'осадка гидроксида нет — для Cu(OH)₂, Fe(OH)₃, Mg(OH)₂ ПК = 0 < ПР, '
            + 'катионов металлов в задаче нет. Выделяется газ, влажный лакмус '
            + 'окрашивается в ' + st.nh4.t + ' цвет (pH = ' + L.fmt(st.nh4.pH, 2)
            + '): NH₄⁺ обнаружен, V(NH₃) = ' + L.fmt(st.nh3, 2) + ' мл (н. у.)',
        }),
      },

      {
        name: 'Контрольный опыт: свинец и соляная кислота',
        hint: 'В пробирках 1—3 осадка с хлорид-ионами не было. Значит ли это, '
          + 'что свинца в растворе точно нет? Проверьте на заведомо известном '
          + 'растворе Pb(NO₃)₂ в пробирке 5. ПР(PbCl₂) = 1,6·10⁻⁵ — это очень '
          + 'много, поэтому в разбавленном растворе ПК может не дотянуть до ПР. '
          + 'Попробуйте разбавленную кислоту, затем повторите с '
          + 'концентрированной и сравните числа. Подтверждающая реакция на '
          + 'свинец — иодид калия: ПР(PbI₂) = 1,1·10⁻⁹.',
        controls: [
          { kind: 'select', id: 'pbacid', label: 'кислота', options: [
            { v: 'dil', t: 'HCl, 0,1 моль/л (разб.)' },
            { v: 'conc', t: 'HCl, 2 моль/л' }] },
          { kind: 'number', id: 'vpb', label: 'прилить', unit: 'мл',
            min: 0.5, max: 3, step: 0.5, value: 1 },
          { kind: 'act', label: 'Прилить кислоту к контрольной пробе',
            act(st, v, ui) {
              const Vb = v.vpb;
              if (!isFinite(Vb) || Vb <= 0) throw new Error('Введите объём кислоты.');
              const reag = v.pbacid === 'conc' ? REAG.HCl2 : REAG.HCl01;
              /* каждый раз считаем от исходной контрольной пробы: опыт можно
                 повторить с другой кислотой и сравнить числа */
              const r = blend(C_PB, 2, reag.ions, Vb);
              const tb = st.tubes[4];
              tb.c = r.c; tb.V = r.V;
              const row = probe(tb.c, ['PbCl2'])[0];
              st.pbCl = row;
              st.pbI = null;
              tb.solid = row.hit ? 'PbCl2' : null;
              tb.res = row.hit ? 'PbCl₂↓' : 'осадка нет';
              st.last = { title: 'Пробирка 5 + ' + reag.t, hit: row.hit,
                line1: 'ПК = ' + L.fmt(row.cc, 4) + '·' + L.fmt(row.ca, 4)
                  + '² = ' + sci(row.IP, 2),
                line2: (row.hit ? 'ПК > ' : 'ПК < ') + 'ПР(PbCl₂) = 1,6·10⁻⁵ → '
                  + (row.hit ? 'осадок' : 'осадка нет') };
              ui.say(row.hit
                ? 'Выпал ' + OBS.PbCl2.t + ': ' + rowText(row)
                : 'Осадка нет, хотя свинец в пробирке есть: ' + rowText(row)
                  + '. Отсутствие осадка с разбавленной HCl не доказывает '
                  + 'отсутствия Pb²⁺.', 'ok');
            } },
          { kind: 'act', label: 'Прилить KI (1 мл)', primary: true,
            act(st, v, ui) {
              if (!st.pbCl) throw new Error('Сначала прилейте кислоту — '
                + 'контрольный опыт начинается с неё.');
              const tb = st.tubes[4];
              const r = blend(tb.c, tb.V, REAG.KI.ions, 1);
              tb.c = r.c; tb.V = r.V;
              const row = probe(tb.c, ['PbI2'])[0];
              st.pbI = row;
              if (row.hit) { tb.solid = 'PbI2'; tb.res = 'PbI₂↓'; }
              st.last = { title: 'Пробирка 5 + KI', hit: row.hit,
                line1: rowText(row),
                line2: row.hit ? OBS.PbI2.t : 'свинец в осадок не ушёл' };
              ui.say(row.hit
                ? 'Выпал ' + OBS.PbI2.t + ': ' + rowText(row)
                  + '. Вот это и доказывает присутствие Pb²⁺.'
                : 'Осадка нет: ' + rowText(row), 'ok');
            } },
        ],
        done: (st) => st.pbI !== null,
        observe: (st) => ({
          what: 'Пробирка 5 (контроль, Pb²⁺ 0,005 моль/л): HCl, затем KI',
          obs: 'с соляной кислотой ' + rowText(st.pbCl) + ' — '
            + (st.pbCl.hit ? 'осадок выпал' : 'осадка нет, хотя свинец в пробирке есть')
            + '; с иодидом ' + rowText(st.pbI) + ', наблюдается ' + OBS.PbI2.t,
        }),
      },

      {
        name: 'Заключение о составе раствора',
        hint: 'Соберите все наблюдения вместе и выберите состав задачи. '
          + 'Вывод делают только по тем ионам, на которые есть доказательная '
          + 'реакция: осадок с посчитанным ПК > ПР или выделение газа. '
          + 'Неверный ответ стенд не засчитает.',
        controls: [
          { kind: 'select', id: 'ans', label: 'в растворе задачи содержатся',
            options: [
              { v: 'a', t: 'NH₄⁺, CO₃²⁻, SO₄²⁻, I⁻' },
              { v: 'b', t: 'NH₄⁺, CO₃²⁻, SO₄²⁻, Cl⁻' },
              { v: 'c', t: 'Ba²⁺, CO₃²⁻, SO₄²⁻, I⁻' },
              { v: 'd', t: 'Cu²⁺, NH₄⁺, SO₄²⁻, I⁻' },
              { v: 'e', t: 'NH₄⁺, SO₄²⁻, I⁻' },
            ] },
          { kind: 'act', label: 'Записать вывод', primary: true, act(st, v, ui) {
            const SETS = {
              a: ['NH4+', 'CO3-2', 'SO4-2', 'I-'],
              b: ['NH4+', 'CO3-2', 'SO4-2', 'Cl-'],
              c: ['Ba2+', 'CO3-2', 'SO4-2', 'I-'],
              d: ['Cu2+', 'NH4+', 'SO4-2', 'I-'],
              e: ['NH4+', 'SO4-2', 'I-'],
            };
            const mine = SETS[v.ans].slice().sort().join('|');
            const real = found(st).slice().sort().join('|');
            if (mine !== real) {
              const extra = SETS[v.ans].filter((x) => found(st).indexOf(x) < 0);
              const miss = found(st).filter((x) => SETS[v.ans].indexOf(x) < 0);
              throw new Error('Не сходится с наблюдениями. '
                + (extra.length ? 'Ни одна проба не доказала присутствие '
                  + extra.map((x) => ION[x]).join(', ') + '. ' : '')
                + (miss.length ? 'Зато доказано присутствие '
                  + miss.map((x) => ION[x]).join(', ') + '. ' : '')
                + 'Перечитайте таблицу наблюдений.');
            }
            st.answer = v.ans;
            ui.say('Верно: в задаче № ' + st.task + ' обнаружены '
              + foundText(st) + '. Катионов металлов нет — щёлочь не дала '
              + 'осадка гидроксида.', 'ok');
          } },
        ],
        done: (st) => st.answer !== null,
        observe: (st) => ({
          what: 'Заключение по задаче № ' + st.task,
          obs: 'в растворе обнаружены ' + foundText(st)
            + '; катионы Cu²⁺, Fe³⁺, Mg²⁺, Ca²⁺, Ba²⁺, Pb²⁺ и анион Cl⁻ '
            + 'не обнаружены — для их солей ПК оказалось меньше ПР',
        }),
      },
    ],

    /* --------------------------------------------------------- журнал */
    journal: [
      { id: 'vco2', label: 'Объём CO₂ из пробы (н. у.)', unit: 'мл', tol: 5,
        hint: 'n(CO₃²⁻) = C·V, V(CO₂) = n·22,4 л/моль',
        truth: (st) => vCO2(st) },
      { id: 'vnh3', label: 'Объём NH₃ из пробы (н. у.)', unit: 'мл', tol: 5,
        hint: 'n(NH₄⁺) = C·V, V(NH₃) = n·22,4 л/моль',
        truth: (st) => vNH3(st) },
      { id: 'mba', label: 'Масса осадка BaSO₄ из пробы', unit: 'г', tol: 5,
        hint: 'm = n(SO₄²⁻)·M(BaSO₄), M = 233 г/моль',
        truth: (st) => mBaSO4(st) },
      { id: 'cso4', label: 'Концентрация SO₄²⁻ в задаче по массе осадка',
        unit: 'моль/л', tol: 5,
        hint: 'C = m/(M·V), V — объём взятой пробы',
        truth: (st) => CC.molarFromMass(mBaSO4(st), M_BASO4, st.Vale / 1000) },
      { id: 'ippb', label: 'ПК = [Pb²⁺]·[Cl⁻]² в контрольной пробирке',
        unit: '·10⁻⁶ (моль/л)³', tol: 10,
        hint: 'концентрации — после сливания; сравнить с ПР(PbCl₂) = 1,6·10⁻⁵',
        truth: (st) => (st.pbCl ? st.pbCl.IP * 1e6 : 0) },
    ],
  });
})();
