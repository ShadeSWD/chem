/* lab-solution.js — работа 1: приготовление раствора заданной молярной
 * концентрации из твёрдой навески.
 *
 * Что здесь считается, а не назначается:
 *   — навеска m = C·V·M считается chemcore.massForMolar;
 *   — фактическая концентрация берётся ИЗ ТОЙ МАССЫ, которую студент
 *     реально положил на весы, и из того объёма, до которого он довёл
 *     раствор: если перелил за метку — концентрация выйдет ниже, и стенд
 *     это покажет;
 *   — pH готового раствора считается по гидролизу карбоната
 *     (chemcore.pHSaltWeakAcid с Ka2 угольной кислоты), цвет фенолфталеина —
 *     по интервалу перехода индикатора.
 */
'use strict';
(function () {
  const CC = window.ChemCore, W = window.Labware, L = window.Lab;
  const C = W.C;

  const SALT = 'Na2CO3';
  const M = CC.molarMass(SALT);              // 106 г/моль
  const KA2 = CC.KA.H2CO3_2;                 // вторая ступень угольной кислоты
  const RHO = 1.010;                         // г/мл, плотность 0,1 М соды

  const target = (st) => CC.massForMolar(st.Ctarget, st.Vnom / 1000, M);

  /* Фактическая концентрация: из реально взятой массы и реального объёма. */
  const actualC = (st) => (st.mWeighed > 0 && st.Vactual > 0)
    ? CC.molarFromMass(st.mWeighed, M, st.Vactual / 1000) : 0;

  const actualPH = (st) => {
    const c = actualC(st);
    return c > 0 ? CC.pHSaltWeakAcid(c, KA2) : 7;
  };

  /* Раствор соды бесцветен — в мерной колбе он и остаётся бесцветным.
     Окраску даёт индикатор, и только в той посуде, куда его капнули: цвет
     берётся из интервала перехода по посчитанному pH, поэтому «малиновый»
     на картинке означает ровно то, что pH > 8,2. */
  const FLASK_COL = '#cfe7f0';   // бесцветный раствор: тон только чтобы был виден уровень
  function sampleColor(st) {
    if (!st.indicator) return FLASK_COL;
    return CC.indicatorColor(st.indicator, actualPH(st)).c;
  }

  L.define('solution', {
    scene: { w: 640, h: 320 },
    alt: 'лабораторный стол: весы, мерная колба с воронкой, промывалка, стакан',

    init() {
      return {
        Ctarget: 0.1,          // моль/л — задание
        Vnom: 250,             // мл — объём раствора по заданию
        Vflask: 0,             // мл — номинал колбы, которую реально взяли
        mWeighed: 0,           // г — что реально положили на весы
        inFlask: false,        // навеска перенесена в колбу
        funnel: false,
        water: 0,              // мл воды в колбе
        Vactual: 0,            // мл — итоговый объём раствора
        dissolved: false,
        mixed: false,
        indicator: null,
        sampled: false,
      };
    },

    /* ------------------------------------------------------------ сцена */
    draw(st, t) {
      let s = '';
      const BENCH = 286;
      s += W.bench(640, BENCH);

      /* --- весы --- */
      const reading = st.mWeighed > 0 ? st.mWeighed.toFixed(4).replace('.', ',') + ' г' : '0,0000 г';
      const onPan = st.mWeighed > 0 && !st.inFlask;
      s += W.at(28, BENCH - 62, W.balance(124, 62, reading, {
        label: 'весы аналитические, ±0,0001 г',
        sample: onPan,
        sampleColor: '#f2f4f6',
      }));
      s += W.txt(90, BENCH - 68,
        onPan ? 'навеска Na₂CO₃' : (st.inFlask ? 'навеска снята с чашки' : 'чашка пуста'),
        onPan ? C.ink : C.gray, 10.5, 'middle');

      /* --- мерная колба --- */
      const fx = 254, fh = 168, fy = BENCH - fh;
      if (!st.Vflask) {
        s += W.txt(fx + 44, BENCH - 70, 'мерная колба ещё не взята', C.gray, 11, 'middle');
        s += W.rect(fx + 4, BENCH - 58, 80, 56, 'none', '#d7dbe0', 1.2, 8);
        s += W.txt(fx + 44, BENCH - 26, 'место на столе', C.gray, 10, 'middle');
      } else {
        const fillFrac = st.Vactual > 0 ? 1
          : (st.water > 0 ? 0.10 + 0.72 * Math.min(1, st.water / st.Vflask) : 0);
        s += W.at(fx, fy, W.flaskVolumetric(88, fh, fillFrac, FLASK_COL, {
          markLabel: st.Vflask + ' мл',
        }));
      }
      /* твёрдая навеска на дне до растворения */
      if (st.inFlask && !st.dissolved) {
        s += `<ellipse cx="${fx + 44}" cy="${BENCH - 14}" rx="16" ry="5" fill="#e6e9eb" stroke="${C.gray}" stroke-width="1"/>`;
        s += W.txt(fx + 44, BENCH + 18, 'навеска ещё не растворилась', C.red, 10, 'middle');
      }
      /* воронка в горле — только пока переносят навеску */
      if (st.funnel) s += W.at(fx + 18, fy - 46, W.funnel(52, 54, {}));
      if (st.Vflask && !(st.inFlask && !st.dissolved)) {
        s += W.txt(fx + 44, BENCH + 18, 'мерная колба ' + st.Vflask + ' мл', C.gray, 10.5, 'middle');
      }

      /* перемешивание: раствор «качается» в шаре */
      if (st.mixed && st.Vactual > 0) {
        const a = Math.sin(t * 2 * Math.PI) * 4;
        s += `<ellipse cx="${fx + 44 + a}" cy="${fy + 116}" rx="30" ry="8"
              fill="none" stroke="rgba(21,94,117,.25)" stroke-width="1.2"/>`;
      }

      /* --- промывалка --- */
      const squirt = st.water > 0 && st.Vactual === 0;
      s += W.at(400, BENCH - 76, W.washBottle(54, 76, squirt));
      s += W.txt(427, BENCH + 18, 'промывалка', C.gray, 10.5, 'middle');
      if (squirt) {
        s += W.txt(427, BENCH - 88, 'дистиллированная вода', C.water, 10, 'middle');
      }

      /* --- стакан с пробой и индикатором --- */
      if (st.sampled) {
        s += W.at(516, BENCH - 58, W.beaker(62, 58, 0.55, sampleColor(st)));
        s += W.txt(547, BENCH + 18, 'проба 10 мл', C.gray, 10.5, 'middle');
        if (st.indicator) {
          const ind = CC.indicatorColor(st.indicator, actualPH(st));
          /* подпись в две строки и вправо по краю доски: одной строкой
             «фенолфталеин: малиновый» не помещается и уезжает за рамку */
          s += W.line(547, BENCH - 62, 547, BENCH - 84, C.gray, 1);
          s += W.txt(632, BENCH - 100, CC.INDICATORS[st.indicator].name, C.gray, 10.5, 'end');
          s += W.txt(632, BENCH - 86, ind.t, C.ink, 11, 'end');
        }
      } else {
        s += W.at(516, BENCH - 58, W.beaker(62, 58, 0, FLASK_COL));
        s += W.txt(547, BENCH + 18, 'стакан', C.gray, 10.5, 'middle');
      }

      /* --- табло состояния --- */
      s += W.rect(8, 8, 244, 62, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(18, 26, 'Задание: ' + String(st.Ctarget).replace('.', ',')
        + ' моль/л, ' + st.Vnom + ' мл', C.ink, 11.5);
      s += W.txt(18, 44, 'Расчётная навеска: ' + L.fmt(target(st), 2) + ' г', C.gray, 11);
      const cNow = actualC(st);
      s += W.txt(18, 62, cNow > 0
        ? 'Получено: C = ' + L.fmt(cNow, 4) + ' моль/л, pH = ' + L.fmt(actualPH(st), 2)
        : 'Получено: —', cNow > 0 ? C.green : C.gray, 11);
      return s;
    },

    /* ------------------------------------------------------------ шаги */
    steps: [
      {
        name: 'Выбрать мерную колбу',
        hint: 'Раствор точной концентрации готовят только в мерной колбе: '
          + 'у неё одна кольцевая метка, и объём отвечает ей с точностью до долей '
          + 'миллилитра. Стаканом или колбой Эрленмейера точный объём не отмерить. '
          + 'Возьмите колбу на 250 мл.',
        controls: [
          { kind: 'select', id: 'flask', label: 'колба', options: [
            { v: '100', t: '100 мл' }, { v: '250', t: '250 мл' }, { v: '500', t: '500 мл' }] },
          { kind: 'act', label: 'Взять колбу', primary: true, act(st, v, ui) {
            const V = parseInt(v.flask, 10);
            if (V !== 250) throw new Error('По заданию нужно 250 мл раствора — '
              + 'возьмите колбу того же номинала.');
            st.Vflask = V;
            ui.say('Колба на 250 мл на столе. Расчётная навеска — '
              + L.fmt(target(st), 2) + ' г.', 'ok');
          } },
        ],
        done: (st) => st.Vflask === 250,
        observe: (st) => ({
          what: 'Взята мерная колба ' + st.Vflask + ' мл',
          obs: 'расчётная навеска Na₂CO₃ ' + L.fmt(target(st), 2) + ' г',
        }),
      },
      {
        name: 'Взвесить навеску',
        hint: 'Навеску берут на аналитических весах (цена деления 0,0001 г) '
          + 'в бюксе или на часовом стекле, а не насыпают «на глаз». '
          + 'Введите массу, которую вы положили на чашку, и нажмите «Взвесить». '
          + 'Стенд посчитает концентрацию именно из этой массы.',
        controls: [
          { kind: 'number', id: 'm', label: 'масса навески', unit: 'г',
            min: 0, max: 20, step: 0.0001, value: 2.65 },
          { kind: 'act', label: 'Взвесить', primary: true, act(st, v, ui) {
            const m = v.m;
            if (!isFinite(m) || m <= 0) throw new Error('Введите положительную массу.');
            const need = target(st);
            const err = CC.relError(m, need);
            if (err > 5) throw new Error('Масса отличается от расчётной на '
              + L.fmt(err, 1) + ' %. Проверьте расчёт: m = C·V·M = '
              + String(st.Ctarget).replace('.', ',') + ' · 0,25 · ' + M + '.');
            st.mWeighed = m;
            ui.say('Взвешено ' + L.fmt(m, 4) + ' г (отклонение от расчёта '
              + L.fmt(err, 2) + ' %).', 'ok');
          } },
        ],
        done: (st) => st.mWeighed > 0,
        observe: (st) => ({
          what: 'Взвешена навеска Na₂CO₃',
          obs: L.fmt(st.mWeighed, 4) + ' г (расчёт ' + L.fmt(target(st), 2) + ' г)',
        }),
      },
      {
        name: 'Перенести навеску в колбу',
        hint: 'Навеску переносят в колбу через воронку и обязательно смывают '
          + 'остатки с воронки и стенок струёй воды из промывалки: то, что осталось '
          + 'на стекле, в раствор не попадёт, и концентрация будет занижена.',
        controls: [
          { kind: 'act', label: 'Вставить воронку', act(st, v, ui) {
            st.funnel = true; ui.say('Воронка в горле колбы.', 'ok');
          } },
          { kind: 'act', label: 'Пересыпать навеску', primary: true, act(st, v, ui) {
            if (!st.funnel) throw new Error('Без воронки навеска просыплется мимо горла — '
              + 'сначала вставьте воронку.');
            st.inFlask = true;
            ui.say('Навеска в колбе. Не забудьте смыть остатки с воронки.', 'ok');
          } },
          { kind: 'act', label: 'Смыть воронку и убрать', act(st, v, ui) {
            if (!st.inFlask) throw new Error('Сначала пересыпьте навеску.');
            st.funnel = false; st.water = 20;
            ui.say('Воронка обмыта, вода с остатками соли — в колбе.', 'ok');
          } },
        ],
        done: (st) => st.inFlask && !st.funnel && st.water > 0,
        observe: () => ({
          what: 'Навеска перенесена в колбу через воронку, воронка обмыта',
          obs: 'на дне колбы твёрдая соль и немного воды',
        }),
      },
      {
        name: 'Растворить навеску',
        hint: 'Сначала растворяют в небольшом объёме воды — примерно на треть '
          + 'колбы — и только потом доводят до метки. Если сразу налить до метки, '
          + 'нерастворившаяся соль останется на дне, а объём уже нельзя увеличить.',
        controls: [
          { kind: 'number', id: 'w', label: 'налить воды', unit: 'мл',
            min: 10, max: 260, step: 5, value: 80 },
          { kind: 'act', label: 'Налить и перемешать', primary: true, act(st, v, ui) {
            if (v.w > st.Vnom * 0.6) throw new Error('Столько воды сразу лить нельзя: '
              + 'до метки останется меньше, чем нужно на смыв и перемешивание. '
              + 'Налейте примерно треть объёма колбы.');
            st.water = v.w;
            st.dissolved = true;
            ui.say('Соль растворилась полностью, раствор прозрачный.', 'ok');
          } },
        ],
        done: (st) => st.dissolved,
        observe: (st) => ({
          what: 'Растворение в ' + st.water + ' мл воды',
          obs: 'соль растворилась, раствор бесцветный и прозрачный',
        }),
      },
      {
        name: 'Довести до метки',
        hint: 'Последние миллилитры добавляют по каплям, а нижний край мениска '
          + 'подводят точно к кольцевой метке на уровне глаз. Перелив за метку '
          + 'исправить нельзя: объём станет больше номинала, а концентрация — меньше. '
          + 'Стенд посчитает концентрацию по тому объёму, который получится.',
        controls: [
          { kind: 'number', id: 'v', label: 'итоговый объём', unit: 'мл',
            min: 240, max: 270, step: 0.5, value: 250 },
          { kind: 'act', label: 'Довести водой', primary: true, act(st, v, ui) {
            if (!isFinite(v.v) || v.v <= 0) throw new Error('Введите объём.');
            st.Vactual = v.v;
            const c = actualC(st);
            if (Math.abs(v.v - st.Vnom) > 0.6) {
              ui.say('Мениск не на метке: объём ' + L.fmt(v.v, 1) + ' мл вместо '
                + st.Vnom + '. Концентрация получилась ' + L.fmt(c, 4)
                + ' моль/л — это и пойдёт в расчёт.', 'bad');
            } else {
              ui.say('Мениск на метке. Концентрация ' + L.fmt(c, 4) + ' моль/л.', 'ok');
            }
          } },
        ],
        done: (st) => st.Vactual > 0,
        observe: (st) => ({
          what: 'Доведено до объёма ' + L.fmt(st.Vactual, 1) + ' мл',
          obs: 'C = ' + L.fmt(actualC(st), 4) + ' моль/л',
        }),
      },
      {
        name: 'Перемешать раствор',
        hint: 'Колбу закрывают пробкой и переворачивают 10–15 раз: без этого '
          + 'верхний слой окажется разбавленным, а нижний — концентрированным, '
          + 'и любая проба из колбы будет врать.',
        controls: [
          { kind: 'act', label: 'Закрыть пробкой и перевернуть 15 раз', primary: true,
            act(st, v, ui) {
              st.mixed = true;
              ui.say('Раствор однороден по всему объёму.', 'ok');
            } },
        ],
        done: (st) => st.mixed,
        observe: () => ({
          what: 'Перемешивание переворачиванием',
          obs: 'раствор однородный, полос и слоёв не видно',
        }),
      },
      {
        name: 'Проверить среду раствора',
        hint: 'Карбонат натрия — соль слабой кислоты и сильного основания, '
          + 'поэтому он гидролизуется и раствор должен быть щелочным. '
          + 'Отберите пипеткой Мора 10 мл в стакан и добавьте индикатор. '
          + 'pH стенд считает по формуле гидролиза из главы 5, цвет — по '
          + 'интервалу перехода индикатора.',
        controls: [
          { kind: 'act', label: 'Отобрать пипеткой 10 мл', act(st, v, ui) {
            if (!st.mixed) throw new Error('Сначала перемешайте раствор — '
              + 'иначе проба не отражает состав колбы.');
            st.sampled = true;
            ui.say('10 мл раствора в стакане.', 'ok');
          } },
          { kind: 'select', id: 'ind', label: 'индикатор', options: [
            { v: 'phenolphthalein', t: 'фенолфталеин' },
            { v: 'litmus', t: 'лакмус' },
            { v: 'methylOrange', t: 'метилоранж' }] },
          { kind: 'act', label: 'Добавить каплю индикатора', primary: true, act(st, v, ui) {
            if (!st.sampled) throw new Error('Сначала отберите пробу.');
            st.indicator = v.ind;
            const pH = actualPH(st);
            const c = CC.indicatorColor(v.ind, pH);
            ui.say('pH = ' + L.fmt(pH, 2) + '; ' + CC.INDICATORS[v.ind].name
              + ' — ' + c.t + '.', 'ok');
          } },
        ],
        done: (st) => !!st.indicator,
        observe: (st) => ({
          what: 'Проба 10 мл + ' + CC.INDICATORS[st.indicator].name,
          obs: 'окраска ' + CC.indicatorColor(st.indicator, actualPH(st)).t
            + ', pH = ' + L.fmt(actualPH(st), 2) + ' — среда щелочная (гидролиз)',
        }),
      },
    ],

    /* --------------------------------------------------------- журнал */
    journal: [
      { id: 'm', label: 'Расчётная навеска Na₂CO₃', unit: 'г', tol: 1,
        hint: 'm = C·V·M', truth: (st) => target(st) },
      { id: 'c', label: 'Фактическая молярная концентрация', unit: 'моль/л', tol: 1,
        hint: 'C = m/(M·V) по реально взятой навеске и полученному объёму',
        truth: (st) => actualC(st) },
      { id: 'w', label: 'Массовая доля соли в растворе', unit: '%', tol: 2,
        hint: 'ω = m(соли)/m(р-ра)·100, m(р-ра) = V·ρ, ρ = 1,010 г/мл',
        truth: (st) => CC.massFraction(st.mWeighed, st.Vactual * RHO) },
      { id: 'ph', label: 'pH приготовленного раствора', unit: '', tol: 2,
        hint: 'pH = 7 + ½(pKa₂ + lg C), Ka₂(H₂CO₃) = 4,8·10⁻¹¹',
        truth: (st) => actualPH(st) },
    ],
  });
})();
