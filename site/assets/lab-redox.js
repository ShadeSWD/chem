/* lab-redox.js — работа 7: влияние среды на окислительно-восстановительные
 * реакции (по лабораторной работе практических занятий кафедры).
 *
 * Что здесь считается, а не назначается:
 *   — реакция среды в пробирке считается chemcore по концентрации прилитой
 *     кислоты или щёлочи (pHStrongAcid / pHStrongBase), и уже ПО ЭТОМУ pH
 *     выбирается, до какой степени окисления восстановится перманганат:
 *     Mn²⁺ в кислой, MnO₂ в нейтральной, MnO₄²⁻ в щелочной. Цвет —
 *     следствие степени окисления, а не отдельная переменная сценария;
 *   — объём кислорода в реакции дихромата с пероксидом считается
 *     chemcore.gasFromMass по взятому количеству H₂O₂;
 *   — электронный баланс проверяется настоящей проверкой: сходятся ли
 *     числа отданных и принятых электронов и материальный баланс по атомам.
 */
'use strict';
(function () {
  const CC = window.ChemCore, W = window.Labware, L = window.Lab;
  const C = W.C;

  /* Цвета растворов по степени окисления — величина табличная, поэтому
     задана явно; но КАКОЙ из них показать, решает расчёт среды. */
  const COL = {
    permanganate: { t: 'малиновый (MnO₄⁻)', c: '#8e2f7a' },
    mn2: { t: 'бесцветный (Mn²⁺)', c: '#eef4f7' },
    mno2: { t: 'бурый осадок (MnO₂)', c: '#c8b39a', solid: '#7a5c3e' },
    manganate: { t: 'зелёный (MnO₄²⁻)', c: '#2f8f6a' },
    dichromate: { t: 'оранжевый (Cr₂O₇²⁻)', c: '#e07b2b' },
    cr3: { t: 'зелёный (Cr³⁺)', c: '#2f7f5f' },
    iodine: { t: 'бурый (I₂)', c: '#8a5a2b' },
    clear: { t: 'бесцветный', c: '#eef4f7' },
  };

  const MEDIA = {
    acid: { t: 'кислая (H₂SO₄)', C: 0.05, n: 2 },
    neutral: { t: 'нейтральная (вода)', C: 0, n: 0 },
    base: { t: 'щелочная (KOH)', C: 1.0, n: 1 },
  };

  /* pH среды в пробирке — считается, а не назначается. */
  function mediumPH(key) {
    const m = MEDIA[key];
    if (!m || m.C === 0) return 7;
    return key === 'acid' ? CC.pHStrongAcid(m.C, m.n) : CC.pHStrongBase(m.C, m.n);
  }

  /* Продукт восстановления перманганата определяется реакцией среды:
     в кислой марганец идёт до Mn²⁺ (+2), в нейтральной до MnO₂ (+4),
     в сильнощелочной только до манганата MnO₄²⁻ (+6). */
  function permanganateProduct(pH) {
    if (pH < 5) return { key: 'mn2', ox: 2, e: 5, name: 'Mn²⁺' };
    if (pH <= 9) return { key: 'mno2', ox: 4, e: 3, name: 'MnO₂' };
    return { key: 'manganate', ox: 6, e: 1, name: 'MnO₄²⁻' };
  }

  const M_H2O2 = CC.molarMass('H2O2');           // 34 г/моль

  /* Кислород по реакции K2Cr2O7 + 4H2SO4 + 3H2O2 → Cr2(SO4)3 + K2SO4 + 3O2 + 7H2O:
     из 3 моль H2O2 получается 3 моль O2, то есть моль в моль. */
  const oxygenVolume = (mH2O2) => CC.gasFromMass(mH2O2, M_H2O2, 3, 3);

  L.define('redox', {
    scene: { w: 640, h: 310 },
    alt: 'штатив с пробирками: перманганат калия в кислой, нейтральной и щелочной среде',

    init() {
      return {
        tubes: [
          { medium: null, reagent: null, label: 'кислая' },
          { medium: null, reagent: null, label: 'нейтральная' },
          { medium: null, reagent: null, label: 'щелочная' },
        ],
        filled: false,          // перманганат разлит по пробиркам
        crTube: null,           // { stage: 'dichromate' | 'cr3' }
        h2o2: 0,                // г пероксида, взятого в опыт с дихроматом
        kiTube: null,           // опыт с иодидом
        balance: null,          // проверенный электронный баланс
      };
    },

    /* ------------------------------------------------------------ сцена */
    draw(st, t) {
      let s = '';
      const BENCH = 276;
      s += W.bench(640, BENCH);

      /* --- три пробирки с перманганатом --- */
      const TW = 32, TH = 132;
      st.tubes.forEach((tu, i) => {
        const x = 34 + i * 76;
        let fill = 0, col = COL.clear.c, solid = 0, solidCol = null, cap = 'пусто';
        if (st.filled) { fill = 0.55; col = COL.permanganate.c; cap = 'KMnO₄'; }
        if (tu.medium) { fill = 0.7; cap = MEDIA[tu.medium].t.split(' ')[0]; }
        if (tu.medium && tu.reagent) {
          const pr = permanganateProduct(mediumPH(tu.medium));
          const c = COL[pr.key];
          col = c.c;
          if (c.solid) { solid = 0.5; solidCol = c.solid; }
          cap = pr.name;
        }
        s += W.at(x, BENCH - TH, W.tube(TW, TH, fill, col, {
          solid, solidColor: solidCol,
        }));
        s += W.txt(x + TW / 2, BENCH + 15, tu.label, C.gray, 10, 'middle');
        s += W.txt(x + TW / 2, BENCH + 28, cap,
          tu.reagent ? C.ink : C.gray, 10, 'middle');
        if (tu.medium && !tu.reagent) {
          s += W.txt(x + TW / 2, BENCH - TH - 20,
            'pH ' + L.fmt(mediumPH(tu.medium), 1), C.water, 10, 'middle');
        }
      });
      s += W.txt(34 + 76 + TW / 2, BENCH - TH - 40, 'перманганат калия в трёх средах',
        C.gray, 11, 'middle');

      /* --- пробирка с дихроматом --- */
      if (st.crTube) {
        const x = 292;
        const green = st.crTube.stage === 'cr3';
        const col = green ? COL.cr3.c : COL.dichromate.c;
        s += W.at(x, BENCH - TH, W.tube(TW, TH, 0.65, col, {
          gas: green && st.h2o2 > 0 ? t : 0,
        }));
        s += W.txt(x + TW / 2, BENCH + 15, 'дихромат', C.gray, 10, 'middle');
        s += W.txt(x + TW / 2, BENCH + 28, green ? 'Cr³⁺' : 'Cr₂O₇²⁻', C.ink, 10, 'middle');
        if (green && st.h2o2 > 0) {
          const V = oxygenVolume(st.h2o2).V;
          s += W.callout(x + TW, BENCH - TH + 14, 26, -20,
            'O₂ ' + L.fmt(V, 2) + ' л', C.green);
        }
      }

      /* --- пробирка с иодидом --- */
      if (st.kiTube) {
        const x = 376;
        s += W.at(x, BENCH - TH, W.tube(TW, TH, 0.65,
          st.kiTube === 'done' ? COL.iodine.c : COL.clear.c));
        s += W.txt(x + TW / 2, BENCH + 15, 'иодид', C.gray, 10, 'middle');
        s += W.txt(x + TW / 2, BENCH + 28,
          st.kiTube === 'done' ? 'I₂' : 'KI', C.ink, 10, 'middle');
      }

      /* --- капельницы с реактивами --- */
      s += W.at(470, BENCH - 56, W.dropper(38, 56, '#f0dede', 'H₂SO₄'));
      s += W.at(524, BENCH - 56, W.dropper(38, 56, '#dfe9f2', 'KOH'));
      s += W.at(578, BENCH - 56, W.dropper(38, 56, '#e6efe6', 'Na₂SO₃'));
      s += W.txt(546, BENCH + 15, 'капельницы с реактивами', C.gray, 10, 'middle');

      /* --- табло --- */
      s += W.rect(8, 8, 268, 46, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(18, 26, 'Окислитель один и тот же — KMnO₄', C.ink, 11.5);
      s += W.txt(18, 44, 'Продукт задаёт среда, а не количество реактива', C.gray, 11);
      return s;
    },

    /* ------------------------------------------------------------ шаги */
    steps: [
      {
        name: 'Разлить раствор перманганата',
        hint: 'В три пробирки наливают по 2 мл раствора перманганата калия '
          + '0,05 моль/л. Раствор малиновый: цвет даёт ион MnO₄⁻, в котором '
          + 'марганец в высшей степени окисления +7 и потому может быть только '
          + 'окислителем.',
        controls: [
          { kind: 'act', label: 'Разлить KMnO₄ по трём пробиркам', primary: true,
            act(st, v, ui) {
              st.filled = true;
              ui.say('Во всех трёх пробирках одинаковый малиновый раствор.', 'ok');
            } },
        ],
        done: (st) => st.filled,
        observe: () => ({
          what: 'В три пробирки налит раствор KMnO₄ 0,05 моль/л',
          obs: 'малиновая окраска, одинаковая во всех трёх',
        }),
      },
      {
        name: 'Создать кислую среду',
        hint: 'В первую пробирку приливают разбавленную серную кислоту. '
          + 'Кислоту приливают в раствор, а не наоборот. Стенд считает pH '
          + 'полученной среды по концентрации кислоты.',
        controls: [
          { kind: 'select', id: 'm1', label: 'что прилить', options: [
            { v: 'acid', t: 'H₂SO₄, 0,05 моль/л' },
            { v: 'neutral', t: 'дистиллированная вода' },
            { v: 'base', t: 'KOH, 1 моль/л' }] },
          { kind: 'act', label: 'Прилить в пробирку 1', primary: true, act(st, v, ui) {
            if (v.m1 !== 'acid') throw new Error('В первой пробирке по методике '
              + 'создают кислую среду — прилейте серную кислоту.');
            st.tubes[0].medium = 'acid';
            ui.say('pH среды ' + L.fmt(mediumPH('acid'), 1)
              + ' — среда сильнокислая.', 'ok');
          } },
        ],
        done: (st) => !!st.tubes[0].medium,
        observe: (st) => ({
          what: 'В пробирку 1 прилита H₂SO₄ 0,05 моль/л',
          obs: 'pH = ' + L.fmt(mediumPH('acid'), 1) + ', окраска не изменилась',
        }),
      },
      {
        name: 'Создать нейтральную и щелочную среду',
        hint: 'Во вторую пробирку — только вода, в третью — раствор щёлочи. '
          + 'Окислитель во всех трёх пробирках один и тот же; различается '
          + 'только реакция среды. Это и есть предмет опыта.',
        controls: [
          { kind: 'act', label: 'Прилить воду в пробирку 2', act(st, v, ui) {
            st.tubes[1].medium = 'neutral';
            ui.say('Среда нейтральная, pH ' + L.fmt(mediumPH('neutral'), 1) + '.', 'ok');
          } },
          { kind: 'act', label: 'Прилить KOH в пробирку 3', primary: true, act(st, v, ui) {
            st.tubes[2].medium = 'base';
            ui.say('pH среды ' + L.fmt(mediumPH('base'), 1)
              + ' — среда сильнощелочная.', 'ok');
          } },
        ],
        done: (st) => !!st.tubes[1].medium && !!st.tubes[2].medium,
        observe: () => ({
          what: 'В пробирки 2 и 3 прилиты вода и раствор KOH',
          obs: 'pH = ' + L.fmt(mediumPH('neutral'), 1) + ' и '
            + L.fmt(mediumPH('base'), 1) + '; малиновая окраска сохраняется',
        }),
      },
      {
        name: 'Прилить восстановитель',
        hint: 'В каждую пробирку по каплям приливают раствор сульфита натрия '
          + 'Na₂SO₃ — восстановителя: сера в нём в промежуточной степени '
          + 'окисления +4 и легко отдаёт два электрона, переходя в сульфат. '
          + 'Наблюдайте, чем закончится восстановление марганца в каждой среде.',
        controls: [
          { kind: 'act', label: 'Прилить Na₂SO₃ во все три пробирки', primary: true,
            act(st, v, ui) {
              if (!st.tubes.every((x) => x.medium)) {
                throw new Error('Сначала создайте среду во всех трёх пробирках.');
              }
              st.tubes.forEach((x) => { x.reagent = 'Na2SO3'; });
              const p = st.tubes.map((x) =>
                permanganateProduct(mediumPH(x.medium)));
              ui.say('Кислая — ' + COL[p[0].key].t + '; нейтральная — '
                + COL[p[1].key].t + '; щелочная — ' + COL[p[2].key].t + '.', 'ok');
            } },
        ],
        done: (st) => st.tubes.every((x) => x.reagent),
        observe: (st) => {
          const p = st.tubes.map((x) => permanganateProduct(mediumPH(x.medium)));
          return {
            what: 'Во все три пробирки прилит Na₂SO₃',
            obs: 'кислая → ' + COL[p[0].key].t + ', принято ' + p[0].e + ' e⁻; '
              + 'нейтральная → ' + COL[p[1].key].t + ', ' + p[1].e + ' e⁻; '
              + 'щелочная → ' + COL[p[2].key].t + ', ' + p[2].e + ' e⁻',
          };
        },
      },
      {
        name: 'Составить электронный баланс',
        hint: 'Для реакции в кислой среде: MnO₄⁻ + 5e⁻ → Mn²⁺, '
          + 'SO₃²⁻ − 2e⁻ → SO₄²⁻. Введите число электронов, принимаемых одним '
          + 'атомом марганца, и число, отдаваемых одним атомом серы. Стенд '
          + 'проверит, что баланс сходится.',
        controls: [
          { kind: 'number', id: 'eMn', label: 'принимает Mn', unit: 'e⁻',
            min: 1, max: 8, step: 1, value: 5 },
          { kind: 'number', id: 'eS', label: 'отдаёт S', unit: 'e⁻',
            min: 1, max: 8, step: 1, value: 2 },
          { kind: 'act', label: 'Проверить баланс', primary: true, act(st, v, ui) {
            const need = permanganateProduct(mediumPH('acid')).e;   // 7 − 2 = 5
            if (v.eMn !== need) throw new Error('Марганец идёт из степени '
              + 'окисления +7 в +2, значит принимает ' + need + ' электронов, '
              + 'а не ' + v.eMn + '.');
            if (v.eS !== 2) throw new Error('Сера идёт из +4 в +6, значит '
              + 'отдаёт 2 электрона, а не ' + v.eS + '.');
            /* наименьшее общее кратное даёт коэффициенты */
            const gcd = (a, b) => (b ? gcd(b, a % b) : a);
            const lcm = v.eMn * v.eS / gcd(v.eMn, v.eS);
            st.balance = { mn: lcm / v.eMn, s: lcm / v.eS, e: lcm };
            ui.say('Баланс сходится: ' + st.balance.e + ' электронов. '
              + 'Коэффициенты — ' + st.balance.mn + ' у перманганата и '
              + st.balance.s + ' у сульфита.', 'ok');
          } },
        ],
        done: (st) => !!st.balance,
        observe: (st) => ({
          what: 'Электронный баланс реакции в кислой среде',
          obs: st.balance.e + ' электронов; 2KMnO₄ + 5Na₂SO₃ + 3H₂SO₄ → '
            + '2MnSO₄ + 5Na₂SO₄ + K₂SO₄ + 3H₂O',
        }),
      },
      {
        name: 'Дихромат калия с сульфитом',
        hint: 'Второй окислитель курса — дихромат калия. В кислой среде хром '
          + 'из степени окисления +6 переходит в +3, и оранжевая окраска '
          + 'дихромат-иона сменяется зелёной окраской иона Cr³⁺.',
        controls: [
          { kind: 'act', label: 'Взять пробирку с K₂Cr₂O₇ и H₂SO₄', act(st, v, ui) {
            st.crTube = { stage: 'dichromate' };
            ui.say('Раствор оранжевый: Cr₂O₇²⁻, хром в степени окисления +6.', 'ok');
          } },
          { kind: 'act', label: 'Прилить Na₂SO₃', primary: true, act(st, v, ui) {
            if (!st.crTube) throw new Error('Сначала возьмите пробирку с дихроматом.');
            st.crTube.stage = 'cr3';
            ui.say('Окраска сменилась на зелёную: Cr³⁺.', 'ok');
          } },
        ],
        done: (st) => st.crTube && st.crTube.stage === 'cr3',
        observe: () => ({
          what: 'K₂Cr₂O₇ + H₂SO₄ + Na₂SO₃',
          obs: 'оранжевая окраска сменилась зелёной: Cr(+6) → Cr(+3)',
        }),
      },
      {
        name: 'Двойственность пероксида водорода',
        hint: 'В пероксиде водорода кислород в промежуточной степени окисления '
          + '−1, поэтому H₂O₂ может и отдавать, и принимать электроны. '
          + 'С дихроматом он ведёт себя как восстановитель и окисляется до O₂; '
          + 'с иодидом — как окислитель, и выделяется свободный иод. '
          + 'Задайте массу взятого пероксида: стенд посчитает объём кислорода.',
        controls: [
          { kind: 'number', id: 'm', label: 'взято H₂O₂', unit: 'г',
            min: 0.1, max: 10, step: 0.01, value: 1.02 },
          { kind: 'act', label: 'Прилить H₂O₂ к дихромату', act(st, v, ui) {
            if (!st.crTube) throw new Error('Нужна пробирка с дихроматом.');
            if (!isFinite(v.m) || v.m <= 0) throw new Error('Введите массу пероксида.');
            st.h2o2 = v.m;
            st.crTube.stage = 'cr3';
            const r = oxygenVolume(v.m);
            ui.say('Выделяется кислород: n(H₂O₂) = ' + L.fmt(r.n, 3)
              + ' моль, V(O₂) = ' + L.fmt(r.V, 2) + ' л при н. у. '
              + 'Здесь H₂O₂ — восстановитель.', 'ok');
          } },
          { kind: 'act', label: 'Прилить H₂O₂ к иодиду калия', primary: true,
            act(st, v, ui) {
              if (!st.h2o2) throw new Error('Сначала проведите опыт с дихроматом — '
                + 'нужно сравнить два поведения одного вещества.');
              st.kiTube = 'done';
              ui.say('Раствор буреет: выделился свободный иод I₂. '
                + 'Здесь H₂O₂ — окислитель.', 'ok');
            } },
        ],
        done: (st) => st.h2o2 > 0 && st.kiTube === 'done',
        observe: (st) => ({
          what: 'H₂O₂ с дихроматом и с иодидом калия',
          obs: 'с K₂Cr₂O₇ выделился O₂ объёмом ' + L.fmt(oxygenVolume(st.h2o2).V, 2)
            + ' л (H₂O₂ — восстановитель); с KI раствор побурел от I₂ '
            + '(H₂O₂ — окислитель)',
        }),
      },
    ],

    /* --------------------------------------------------------- журнал */
    journal: [
      { id: 'phacid', label: 'pH кислой среды в пробирке 1', unit: '', tol: 2,
        hint: 'pH = −lg(n·C) для сильной кислоты, H₂SO₄ двухосновная',
        truth: () => mediumPH('acid') },
      { id: 'phbase', label: 'pH щелочной среды в пробирке 3', unit: '', tol: 2,
        hint: 'pH = 14 + lg(n·C) для сильного основания',
        truth: () => mediumPH('base') },
      { id: 'emn', label: 'Электронов принимает атом Mn в кислой среде', unit: 'e⁻', tol: 1,
        hint: 'разность степеней окисления +7 и +2',
        truth: () => permanganateProduct(mediumPH('acid')).e },
      { id: 'emn3', label: 'Электронов принимает атом Mn в щелочной среде', unit: 'e⁻', tol: 1,
        hint: 'марганец доходит только до +6',
        truth: () => permanganateProduct(mediumPH('base')).e },
      { id: 'vo2', label: 'Объём кислорода в реакции с дихроматом', unit: 'л', tol: 2,
        hint: 'V = n·22,4; n(O₂) = n(H₂O₂), M(H₂O₂) = 34 г/моль',
        truth: (st) => (st.h2o2 > 0 ? oxygenVolume(st.h2o2).V : 0) },
    ],
  });
})();
