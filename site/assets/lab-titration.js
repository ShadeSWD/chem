/* lab-titration.js — работа 2: кислотно-основное титрование.
 *
 * Что здесь считается, а не назначается:
 *   — pH в колбе на каждом шаге считает chemcore.titrationPH по тому объёму
 *     титранта, который студент реально прилил, с учётом разбавления;
 *   — окраска раствора и момент конца титрования берутся из
 *     chemcore.indicatorColor: индикатор меняет цвет тогда, когда посчитанный
 *     pH выходит из его интервала перехода, а не «на шаге 5»;
 *   — кривая титрования рисуется по точкам chemcore.titrationCurve,
 *     точка эквивалентности ищется по максимуму центральной разности
 *     (середина скачка), скачок — chemcore.titrationJump;
 *   — найденная концентрация кислоты — chemcore.concFromTitration по
 *     отсчёту бюретки: перетитровал — концентрация завышена, и стенд это
 *     показывает.
 *
 * Истинная концентрация кислоты (CA) зашита в модуль и студенту не
 * показывается до конца работы: её и требуется найти. Значение фиксировано,
 * чтобы журнал был воспроизводим от запуска к запуску.
 */
'use strict';
(function () {
  const CC = window.ChemCore, W = window.Labware, L = window.Lab;
  const C = W.C;

  const VA = 10.00;                 // мл — аликвота кислоты (пипетка Мора)
  const CB = 0.1000;                // моль/л — стандартный раствор NaOH
  const CA = 0.0850;                // моль/л — «неизвестная» концентрация HCl
  const KAC = CC.KA.CH3COOH;        // 1,8·10⁻⁵ — уксусная кислота (второй сюжет)
  const DROP = 0.05;                // мл — объём капли из бюретки (20 капель в 1 мл)
  const VBUR = 25;                  // мл — вместимость бюретки
  const VMAX = 15;                  // мл — предел оси V на врезке
  const VEQ = CC.equivalenceVolume(CA, VA, 1, CB, 1);   // 8,50 мл

  const r2 = (x) => Math.round(x * 100) / 100;
  const pHat = (Vb, Ka) => CC.titrationPH(VA, CA, Vb, CB, Ka || null);
  const pHnow = (st) => pHat(st.Vb, null);
  const concFrom = (V) => CC.concFromTitration(CB, V, 1, VA, 1);
  const zoneAt = (ind, Vb, Ka) => CC.indicatorColor(ind, pHat(Vb, Ka)).zone;
  const nameOf = (ind) => CC.INDICATORS[ind].name;

  /* Числа объёмов и концентраций показываем с постоянным числом знаков:
     отсчёт по бюретке — 8,50, а не 8,5, как и записывают в журнале. */
  const f = (x, d) => (isFinite(x)
    ? Number(x).toFixed(d === undefined ? 2 : d).replace('.', ',') : '—');

  /* Объём титранта, при котором выбранный индикатор меняет окраску.
     full = false — первое заметное изменение (по нему и останавливают
     титрование), full = true — конец перехода, полная окраска. */
  const EPC = {};
  function endpointV(ind, weak, full) {
    const key = ind + (weak ? 'w' : 's') + (full ? 'f' : 'b');
    if (EPC[key] !== undefined) return EPC[key];
    let v = null;
    for (let i = 0; i <= Math.round(VMAX / DROP); i++) {
      const V = r2(i * DROP);
      const z = zoneAt(ind, V, weak ? KAC : null);
      if (full ? z === 'base' : z !== 'acid') { v = V; break; }
    }
    EPC[key] = v;
    return v;
  }

  /* Кривые считаются один раз: параметры титрования постоянны. */
  let CURVE_S = null, CURVE_W = null;
  const curveS = () => (CURVE_S || (CURVE_S = CC.titrationCurve(VA, CA, CB, null, VMAX, DROP)));
  const curveW = () => (CURVE_W || (CURVE_W = CC.titrationCurve(VA, CA, CB, KAC, VMAX, DROP)));

  /* Точка эквивалентности по кривой: середина скачка — точка, где
     центральная разность pH(V+h) − pH(V−h) максимальна. */
  function veqFromCurve(pts) {
    let best = 1, dmax = -Infinity;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = pts[i + 1].pH - pts[i - 1].pH;
      if (d > dmax) { dmax = d; best = i; }
    }
    return { V: r2(pts[best].V), pH: pts[best].pH };
  }

  const PALE = '#e6f0f4';                  // раствор без индикатора
  function flaskColor(st) {
    if (!st.aliquot) return PALE;
    if (!st.ind) return PALE;
    return CC.indicatorColor(st.ind, pHnow(st)).c;
  }
  const colorWord = (st) => (st.ind && st.aliquot
    ? CC.indicatorColor(st.ind, pHnow(st)).t : 'без индикатора');

  /* ------------------------------------------------------------ врезка */

  const X0 = 372, X1 = 618, Y0 = 268, Y1 = 56;
  const px = (V) => X0 + (V / VMAX) * (X1 - X0);
  const py = (p) => Y0 - (p / 14) * (Y0 - Y1);

  function curvePath(pts) {
    return pts.map((p, i) => (i ? 'L ' : 'M ')
      + (Math.round(px(p.V) * 10) / 10) + ' ' + (Math.round(py(p.pH) * 10) / 10)).join(' ');
  }

  function inset(st) {
    let s = W.rect(322, 8, 310, 292, '#fbfcfd', '#d7dbe0', 1, 8);
    s += W.txt(477, 26, 'Кривая титрования', C.ink, 11.5, 'middle');

    /* интервалы перехода индикаторов — фон, по которому и выбирают индикатор */
    const band = (lo, hi, fill) =>
      W.rect(X0, py(hi), X1 - X0, py(lo) - py(hi), fill);
    s += band(3.1, 4.4, 'rgba(224,138,46,.16)');
    s += band(8.2, 10.0, 'rgba(194,24,91,.12)');
    s += W.txt(X1 - 6, py(3.75) + 3, 'метилоранж', '#a8641f', 8.5, 'end');
    s += W.txt(X1 - 6, py(9.1) + 3, 'фенолфталеин', '#a3346a', 8.5, 'end');

    /* оси */
    s += W.line(X0, Y1 - 6, X0, Y0, C.gray, 1.2);
    s += W.line(X0, Y0, X1 + 6, Y0, C.gray, 1.2);
    s += W.txt(X0, 44, 'pH', C.gray, 9.5, 'middle');
    s += W.txt(495, 295, 'V(NaOH), мл', C.gray, 9.5, 'middle');
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((p) => {
      s += W.line(X0 - 3, py(p), X0, py(p), C.gray, 0.9);
    });
    [0, 4, 7, 10, 14].forEach((p) => {
      s += W.txt(366, py(p) + 3.5, String(p), C.gray, 9, 'end');
    });
    [0, 5, 10, 15].forEach((v) => {
      s += W.line(px(v), Y0, px(v), Y0 + 3, C.gray, 0.9);
      s += W.txt(px(v), 282, String(v), C.gray, 9, 'middle');
    });

    /* теоретические кривые — только по точкам ChemCore.titrationCurve */
    if (st.curveDrawn) {
      s += W.path(curvePath(curveS()), C.water, 1.7);
      s += W.txt(618, 248, 'HCl + NaOH', C.water, 9, 'end');
    }
    if (st.compare) {
      s += W.path(curvePath(curveW()), C.green, 1.5, 'none', ' stroke-dasharray="5 3"');
      s += W.txt(618, 262, 'CH₃COOH + NaOH', C.green, 9, 'end');
    }

    /* точки, снятые по ходу титрования */
    if (st.pts.length) {
      if (st.pts.length > 1) {
        s += W.path(curvePath(st.pts), 'rgba(179,56,46,.55)', 1.2);
      }
      st.pts.forEach((p) => { s += W.circle(px(p.V), py(p.pH), 2.2, C.red); });
    } else {
      s += W.txt(495, 162, 'точки появятся по ходу титрования', C.gray, 9.5, 'middle');
    }

    /* точка эквивалентности, найденная по кривой */
    if (st.veqFound) {
      s += W.line(px(st.veqFound), Y0, px(st.veqFound), py(7), C.red, 1,
        ' stroke-dasharray="3 3"');
      s += W.circle(px(st.veqFound), py(7), 4, 'none', C.red, 1.8);
      s += W.txt(520, 158, 'т.э. ' + f(st.veqFound, 2) + ' мл; pH 7,00', C.red, 9);
    }
    if (st.compare) {
      s += W.circle(px(VEQ), py(CC.titrationJump(VA, CA, CB, KAC).pHeq), 4, 'none', C.green, 1.6);
    }

    /* надписи о скачке */
    if (st.jump) {
      s += W.txt(477, 40, 'скачок HCl: pH ' + f(st.jump.pH99, 1)
        + ' → ' + f(st.jump.pH101, 1), C.water, 9.5, 'middle');
    }
    if (st.compare) {
      const jw = CC.titrationJump(VA, CA, CB, KAC);
      s += W.txt(477, 53, 'скачок CH₃COOH: pH ' + f(jw.pH99, 1)
        + ' → ' + f(jw.pH101, 1), C.green, 9.5, 'middle');
    }
    return s;
  }

  /* ------------------------------------------------------------------- */

  L.define('titration', {
    scene: { w: 640, h: 340 },
    alt: 'штатив с бюреткой над конической колбой, пипетка Мора и капельница '
      + 'с индикатором, справа — врезка с кривой титрования',

    init() {
      return {
        rinsed: false,        // бюретка ополоснута титрантом
        filled: false,        // бюретка заполнена
        zeroed: false,        // пузырёк вытеснен, уровень на нуле
        pipRinsed: false,     // пипетка ополоснута кислотой
        aliquot: false,       // аликвота в колбе
        Va: 0,                // мл — объём аликвоты
        ind: null,            // выбранный индикатор
        Vb: 0,                // мл — прилито титранта
        pts: [],              // снятые точки кривой
        turned: 0,            // мл — объём, при котором изменилась окраска
        spoiled: false,       // перетитровано на грубом этапе
        Vend: 0,              // мл — отсчёт по бюретке
        readTaken: false,
        curveDrawn: false,
        veqFound: 0,
        jump: null,
        compare: false,
        wind: null,           // индикатор для слабой кислоты
      };
    },

    /* ------------------------------------------------------------ сцена */
    draw(st, t) {
      const BENCH = 300;
      let s = W.bench(640, BENCH);

      /* --- табло --- */
      s += W.rect(8, 8, 296, 76, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(18, 26, 'Титрант: NaOH 0,1000 моль/л, бюретка 25 мл', C.ink, 11);
      s += W.txt(18, 43, 'Аликвота: HCl 10,00 мл, концентрация неизвестна', C.ink, 11);
      const pH = st.aliquot ? pHnow(st) : null;
      s += W.txt(18, 60, st.aliquot
        ? 'Прилито ' + f(st.Vb, 2) + ' мл; pH ' + f(pH, 2)
          + '; ' + colorWord(st)
        : 'Прилито — ; pH — ; окраска —', st.aliquot ? C.water : C.gray, 11);
      if (st.turned) {
        s += W.txt(18, 77, 'Найдено: C(HCl) = ' + f(concFrom(st.Vend || st.turned), 4)
          + ' моль/л' + (st.spoiled ? ' — завышено' : ''),
          st.spoiled ? C.red : C.green, 11);
      } else {
        s += W.txt(18, 77, 'Найдено: —', C.gray, 11);
      }

      /* --- штатив с бюреткой --- */
      s += W.at(20, 88, W.stand(212, { clamps: [18, 88], reach: 76 }));
      const burFill = st.filled ? Math.max(0, (VBUR - st.Vb) / VBUR) : 0;
      const flowing = st.zeroed && st.aliquot && !!st.ind && !st.readTaken;
      s += W.at(112, 90, W.burette(118, burFill, '#d8ecf3', {
        divisions: 10, tapLabel: '',
        drop: flowing ? t : null,
      }));
      /* деления бюретки подписаны своими числами: 0 наверху, 25 у крана */
      s += W.txt(131, 97.5, '0', C.gray, 9);
      s += W.txt(131, 136.5, '12,5', C.gray, 9);
      s += W.txt(131, 175.5, '25', C.gray, 9);
      s += W.callout(128, 118, 28, -8, st.zeroed ? 'нуль установлен' : 'бюретка 25 мл');

      /* --- коническая колба --- */
      const Vtot = (st.aliquot ? VA : 0) + st.Vb;
      const fill = Math.min(0.78, Vtot / 45);
      const fh = 92, fy = BENCH - fh;
      s += W.at(77, fy, W.flaskConical(86, fh, fill, flaskColor(st), {}));
      s += W.txt(120, 318, 'коническая колба', C.gray, 10.5, 'middle');

      /* «розовое облачко» в месте падения капли: у точки эквивалентности
         окраска вспыхивает и расходится, но перемешивание её ещё снимает */
      if (st.ind && st.aliquot && st.Vb > 0 && !st.turned
        && Math.abs(st.Vb - VEQ) < 1.2) {
        const lq = fill * (fh - 26 - 6);
        const sy = BENCH - lq;
        const col = CC.indicatorColor(st.ind, 12).c;
        s += `<ellipse cx="120" cy="${Math.round((sy + 5) * 10) / 10}" `
          + `rx="${Math.round((9 + 9 * t) * 10) / 10}" ry="${Math.round((3.5 + 3 * t) * 10) / 10}" `
          + `fill="${col}" opacity="${(0.5 * (1 - t)).toFixed(2)}"/>`;
      }

      /* --- капельница с индикатором --- */
      const indShort = st.ind === 'phenolphthalein' ? 'ФФ'
        : (st.ind === 'methylOrange' ? 'МО' : (st.ind === 'litmus' ? 'лакмус' : '—'));
      s += W.txt(215, 242, 'индикатор', C.gray, 9.5, 'middle');
      s += W.at(200, 250, W.dropper(30, 44, '#eef2f5', indShort));

      /* --- пипетка Мора --- */
      s += W.at(258, 190, W.pipetteMohr(110,
        (st.pipRinsed && !st.aliquot) ? 1 : 0, '#dfeef4'));
      s += W.txt(268, 318, 'пипетка Мора 10 мл', C.gray, 10.5, 'middle');

      /* --- врезка с кривой --- */
      s += inset(st);
      return s;
    },

    /* ------------------------------------------------------------- шаги */
    steps: [
      {
        name: 'Подготовить и заполнить бюретку',
        hint: 'Бюретку сначала ополаскивают самим титрантом: капли воды на '
          + 'стенках разбавят раствор, и его концентрация перестанет быть '
          + 'известной. Затем заполняют выше нуля, выпускают раствор через кран, '
          + 'пока из носика не уйдёт пузырёк воздуха, и устанавливают уровень '
          + 'на нуль по нижнему краю мениска на уровне глаз. Пузырёк, оставшийся '
          + 'под краном, потом уйдёт в колбу и добавит к отсчёту лишний объём.',
        controls: [
          { kind: 'act', label: 'Ополоснуть бюретку титрантом', act(st, v, ui) {
            st.rinsed = true;
            ui.say('Бюретка дважды ополоснута раствором NaOH, смыв — в слив.', 'ok');
          } },
          { kind: 'act', label: 'Заполнить выше нуля', act(st, v, ui) {
            if (!st.rinsed) throw new Error('Сначала ополосните бюретку титрантом: '
              + 'вода на стенках разбавит раствор и его концентрация станет неизвестной.');
            st.filled = true;
            ui.say('Бюретка заполнена, под краном виден пузырёк воздуха.', 'ok');
          } },
          { kind: 'act', label: 'Вытеснить пузырёк и установить нуль', primary: true,
            act(st, v, ui) {
              if (!st.filled) throw new Error('Бюретка ещё пуста — заполните её.');
              st.zeroed = true;
              ui.say('Пузырёк вытеснен, мениск на нулевом делении. Цена деления '
                + '0,05 мл — это и есть объём одной капли.', 'ok');
            } },
        ],
        done: (st) => st.zeroed,
        observe: () => ({
          what: 'Бюретка ополоснута титрантом, заполнена, пузырёк вытеснен',
          obs: 'уровень NaOH на нуле, цена деления 0,05 мл',
        }),
      },
      {
        name: 'Отобрать аликвоту пипеткой Мора',
        hint: 'Аликвота — точная порция анализируемого раствора. Её отбирают '
          + 'пипеткой Мора: у неё одна кольцевая метка и один-единственный '
          + 'объём. Пипетку тоже ополаскивают тем раствором, который ею берут. '
          + 'По методике нужна аликвота 10,00 мл.',
        controls: [
          { kind: 'act', label: 'Ополоснуть пипетку кислотой', act(st, v, ui) {
            st.pipRinsed = true;
            ui.say('Пипетка ополоснута анализируемым раствором.', 'ok');
          } },
          { kind: 'select', id: 'pip', label: 'пипетка', options: [
            { v: '5', t: '5 мл' }, { v: '10', t: '10 мл' }, { v: '20', t: '20 мл' }] },
          { kind: 'act', label: 'Набрать до метки и слить в колбу', primary: true,
            act(st, v, ui) {
              if (!st.pipRinsed) throw new Error('Пипетка не ополоснута: остатки воды '
                + 'разбавят аликвоту, и найденная концентрация окажется заниженной.');
              const V = parseInt(v.pip, 10);
              if (V !== 10) throw new Error('По методике аликвота 10,00 мл. Пипеткой на '
                + V + ' мл вы возьмёте другое количество вещества, и расход титранта '
                + 'изменится во столько же раз — возьмите пипетку на 10 мл.');
              st.aliquot = true;
              st.Va = V;
              ui.say('В конической колбе 10,00 мл кислоты. Раствор бесцветный, '
                + 'pH = ' + f(pHnow(st), 2) + '.', 'ok');
            } },
        ],
        done: (st) => st.aliquot,
        observe: (st) => ({
          what: 'Отобрана аликвота ' + f(st.Va, 2) + ' мл раствора HCl',
          obs: 'раствор бесцветный и прозрачный, pH = ' + f(pHnow(st), 2),
        }),
      },
      {
        name: 'Выбрать и добавить индикатор',
        hint: 'Индикатор выбирают не по привычке, а по скачку титрования: '
          + 'интервал перехода индикатора должен лежать внутри скачка pH. '
          + 'Стенд считает скачок функцией titrationJump — pH при 99 % и 101 % '
          + 'от точки эквивалентности. Для сильной кислоты скачок широкий, '
          + 'и внутрь него попадают и метилоранж, и фенолфталеин. '
          + 'Добавляют 1–2 капли: индикатор — тоже кислота, и его избыток '
          + 'потребует титранта.',
        controls: [
          { kind: 'select', id: 'ind', label: 'индикатор', options: [
            { v: 'phenolphthalein', t: 'фенолфталеин (8,2–10,0)' },
            { v: 'methylOrange', t: 'метилоранж (3,1–4,4)' },
            { v: 'litmus', t: 'лакмус (5,0–8,0)' }] },
          { kind: 'act', label: 'Добавить 2 капли индикатора', primary: true,
            act(st, v, ui) {
              if (!st.aliquot) throw new Error('В колбе ещё нет аликвоты — '
                + 'индикатор капать не во что.');
              const j = CC.titrationJump(VA, CA, CB, null);
              const ind = CC.INDICATORS[v.ind];
              st.ind = v.ind;
              st.jump = j;
              st.pts = [{ V: 0, pH: pHat(0, null) }];
              const inside = ind.lo > j.pH99 && ind.hi < j.pH101;
              ui.say('Скачок титрования: pH ' + f(j.pH99, 2) + ' → '
                + f(j.pH101, 2) + '. Интервал перехода индикатора «'
                + ind.name + '» — ' + f(ind.lo, 1) + '–' + f(ind.hi, 1)
                + (inside ? ' лежит внутри скачка, индикатор годится.'
                  : ' выходит за скачок.')
                + ' Окраска сейчас — ' + CC.indicatorColor(v.ind, pHnow(st)).t + '.',
                inside ? 'ok' : 'bad');
            } },
        ],
        done: (st) => !!st.ind,
        observe: (st) => ({
          what: 'Добавлено 2 капли: ' + nameOf(st.ind),
          obs: 'окраска ' + colorWord(st) + ' (pH = ' + f(pHnow(st), 2)
            + '); скачок титрования pH ' + f(st.jump.pH99, 2)
            + ' → ' + f(st.jump.pH101, 2),
        }),
      },
      {
        name: 'Титровать крупными порциями',
        hint: 'Первое титрование — ориентировочное: титрант приливают порциями '
          + 'по несколько миллилитров, всё время взбалтывая колбу круговым '
          + 'движением. Порция больше 5 мл за раз недопустима: точку '
          + 'эквивалентности легко проскочить, а вернуть титрант обратно нельзя. '
          + 'Приливайте, пока не израсходуете около 7–8 мл, и следите за pH '
          + 'на врезке: каждая порция даёт свою точку кривой.',
        controls: [
          { kind: 'number', id: 'portion', label: 'порция титранта', unit: 'мл',
            min: 0.5, max: 5, step: 0.5, value: 4 },
          { kind: 'act', label: 'Прилить порцию', primary: true, act(st, v, ui) {
            const d = v.portion;
            if (!isFinite(d) || d <= 0) throw new Error('Введите объём порции.');
            if (d > 5) throw new Error('Порция больше 5 мл за раз — верный способ '
              + 'проскочить точку эквивалентности. Лейте меньшими порциями.');
            if (!st.ind) throw new Error('Индикатор не добавлен: конец титрования '
              + 'будет не виден.');
            if (st.Vb + d > VBUR + 1e-9) throw new Error('В бюретке всего 25 мл; '
              + 'израсходовано уже ' + f(st.Vb, 2) + ' мл.');
            const before = CC.indicatorColor(st.ind, pHnow(st)).zone;
            st.Vb = r2(st.Vb + d);
            const p = pHnow(st);
            st.pts.push({ V: st.Vb, pH: p });
            const after = CC.indicatorColor(st.ind, p).zone;
            if (before === 'acid' && after !== 'acid') {
              st.turned = st.Vb;
              st.spoiled = true;
              st.Vend = st.Vb;
              ui.say('Окраска изменилась сразу от целой порции: точка '
                + 'эквивалентности проскочена. Отсчёт ' + f(st.Vb, 2)
                + ' мл даст C(HCl) = ' + f(concFrom(st.Vb), 4)
                + ' моль/л — завышенное значение. Такое титрование бракуют: '
                + 'нажмите «Начать заново».', 'bad');
            } else {
              ui.say('Прилито ' + f(st.Vb, 2) + ' мл; pH = ' + f(p, 2)
                + ', окраска прежняя (' + colorWord(st) + ').', 'ok');
            }
          } },
        ],
        done: (st) => st.Vb >= 7,
        observe: (st) => ({
          what: 'Ориентировочное титрование до V = ' + f(st.Vb, 2) + ' мл',
          obs: st.spoiled
            ? 'окраска изменилась скачком — точка эквивалентности проскочена'
            : 'окраска не изменилась, pH = ' + f(pHnow(st), 2),
        }),
      },
      {
        name: 'Дотитровать по каплям',
        hint: 'Вблизи точки эквивалентности одна капля меняет pH на несколько '
          + 'единиц — поэтому конец титрования добирают строго по каплям, '
          + 'перемешивая после каждой. Титрование заканчивают, когда окраска '
          + 'изменилась от одной капли и не исчезает при взбалтывании. '
          + 'Стенд прекращает добавление в тот момент, когда посчитанный pH '
          + 'выходит из интервала перехода индикатора.',
        controls: [
          { kind: 'number', id: 'drops', label: 'капель за приём', unit: 'кап.',
            min: 1, max: 20, step: 1, value: 10 },
          { kind: 'act', label: 'Прибавить капли', primary: true, act(st, v, ui) {
            if (st.spoiled) throw new Error('Точка эквивалентности проскочена ещё '
              + 'на грубом этапе (окраска изменилась при ' + f(st.turned, 2)
              + ' мл вместо ожидаемых ~8,5). Титрование испорчено — '
              + 'нажмите «Начать заново» и лейте меньшими порциями.');
            const n = Math.round(v.drops);
            if (!isFinite(n) || n < 1) throw new Error('Введите число капель.');
            let added = 0;
            for (let i = 0; i < n; i++) {
              if (st.Vb + DROP > VBUR + 1e-9) break;
              st.Vb = r2(st.Vb + DROP);
              added++;
              const p = pHnow(st);
              st.pts.push({ V: st.Vb, pH: p });
              if (CC.indicatorColor(st.ind, p).zone !== 'acid') { st.turned = st.Vb; break; }
            }
            const p = pHnow(st);
            if (st.turned) {
              ui.say('Прибавлено капель: ' + added + '. Последняя капля изменила '
                + 'окраску на «' + colorWord(st) + '» — окраска устойчива. '
                + 'Титрование окончено при V = ' + f(st.Vb, 2)
                + ' мл (pH = ' + f(p, 2) + ').', 'ok');
            } else {
              ui.say('Прибавлено капель: ' + added + '; V = ' + f(st.Vb, 2)
                + ' мл, pH = ' + f(p, 2) + '. Окраска не изменилась — '
                + 'продолжайте по каплям.', '');
            }
          } },
        ],
        done: (st) => !!st.turned && !st.spoiled,
        observe: (st) => ({
          what: 'Дотитровано по каплям до устойчивого изменения окраски',
          obs: 'окраска ' + colorWord(st) + ' при V = ' + f(st.Vb, 2)
            + ' мл, pH = ' + f(pHnow(st), 2),
        }),
      },
      {
        name: 'Снять отсчёт по бюретке',
        hint: 'Отсчёт берут по нижнему краю мениска, глаз на уровне мениска: '
          + 'смотреть сверху или снизу — значит получить ошибку параллакса в '
          + 'несколько сотых миллилитра. Цена деления 0,05 мл, поэтому и '
          + 'записывают два знака после запятой. Введите объём, который '
          + 'показывает бюретка, и стенд посчитает концентрацию кислоты по '
          + 'закону эквивалентов.',
        controls: [
          { kind: 'number', id: 'read', label: 'отсчёт по бюретке', unit: 'мл',
            min: 0, max: 25, step: 0.05, value: 8 },
          { kind: 'act', label: 'Записать отсчёт и рассчитать C(HCl)', primary: true,
            act(st, v, ui) {
              if (!st.turned) throw new Error('Титрование ещё не закончено — '
                + 'окраска не изменилась.');
              if (!isFinite(v.read)) throw new Error('Введите отсчёт по бюретке.');
              if (Math.abs(v.read - st.Vb) > 0.051) throw new Error('Отсчёт не совпадает '
                + 'с уровнем в бюретке. Читайте нижний край мениска на уровне глаз; '
                + 'цена деления 0,05 мл, значение выводится и на табло слева.');
              st.Vend = st.Vb;
              st.readTaken = true;
              const c = concFrom(st.Vend);
              ui.say('Отсчёт ' + f(st.Vend, 2) + ' мл. По закону эквивалентов '
                + 'C(HCl) = C(NaOH)·V(NaOH)/V(HCl) = ' + f(CB, 4) + '·'
                + f(st.Vend, 2) + '/' + f(VA, 2) + ' = ' + f(c, 4)
                + ' моль/л.', 'ok');
            } },
        ],
        done: (st) => st.readTaken,
        observe: (st) => ({
          what: 'Отсчёт по бюретке V(NaOH) = ' + f(st.Vend, 2) + ' мл',
          obs: 'C(HCl) = ' + f(concFrom(st.Vend), 4) + ' моль/л',
        }),
      },
      {
        name: 'Построить кривую и найти точку эквивалентности',
        hint: 'Отдельные точки, снятые по ходу титрования, ложатся на кривую '
          + 'pH = f(V). Стенд строит её по точкам ChemCore.titrationCurve с '
          + 'шагом 0,05 мл — это шаг в одну каплю. Точка эквивалентности — '
          + 'середина скачка, точка перегиба: там pH меняется быстрее всего. '
          + 'Стенд находит её по максимуму центральной разности, а не «на глаз».',
        controls: [
          { kind: 'act', label: 'Построить кривую по точкам', act(st, v, ui) {
            st.curveDrawn = true;
            const n = curveS().length;
            ui.say('Кривая построена по ' + n + ' точкам от 0 до ' + VMAX
              + ' мл с шагом 0,05 мл.', 'ok');
          } },
          { kind: 'act', label: 'Найти скачок и точку эквивалентности', primary: true,
            act(st, v, ui) {
              if (!st.curveDrawn) throw new Error('Сначала постройте кривую.');
              const e = veqFromCurve(curveS());
              const j = CC.titrationJump(VA, CA, CB, null);
              st.veqFound = e.V;
              st.jump = j;
              const cTrue = concFrom(e.V);
              const err = CC.relError(concFrom(st.Vend), cTrue);
              ui.say('Точка эквивалентности: V = ' + f(e.V, 2) + ' мл, pH = '
                + f(e.pH, 2) + ' (сильная кислота и сильное основание дают '
                + 'нейтральную среду). Ей отвечает C(HCl) = ' + f(cTrue, 4)
                + ' моль/л. Ваш отсчёт ' + f(st.Vend, 2) + ' мл даёт '
                + f(concFrom(st.Vend), 4) + ' моль/л — относительная погрешность '
                + f(err, 2) + ' %.', 'ok');
            } },
        ],
        done: (st) => !!st.veqFound,
        observe: (st) => ({
          what: 'Построена кривая титрования, найдена точка эквивалентности',
          obs: 'V(т.э.) = ' + f(st.veqFound, 2) + ' мл, pH(т.э.) = 7,00; '
            + 'C(HCl) = ' + f(concFrom(st.veqFound), 4) + ' моль/л, погрешность '
            + f(CC.relError(concFrom(st.Vend), concFrom(st.veqFound)), 2) + ' %',
        }),
      },
      {
        name: 'Проверить выбор индикатора на слабой кислоте',
        hint: 'Та же щёлочь, та же концентрация — но кислота слабая (уксусная, '
          + 'Ka = 1,8·10⁻⁵). Точка эквивалентности теперь лежит не при pH 7, '
          + 'а в щелочной области: образуется ацетат натрия, соль слабой кислоты, '
          + 'и он гидролизуется. Скачок обрезан снизу. Выберите индикатор для '
          + 'этого титрования — стенд посчитает, при каком объёме он изменит '
          + 'окраску и какая при этом выйдет концентрация.',
        controls: [
          { kind: 'select', id: 'wind', label: 'индикатор', options: [
            { v: 'phenolphthalein', t: 'фенолфталеин (8,2–10,0)' },
            { v: 'methylOrange', t: 'метилоранж (3,1–4,4)' },
            { v: 'litmus', t: 'лакмус (5,0–8,0)' }] },
          { kind: 'act', label: 'Оттитровать уксусную кислоту', primary: true,
            act(st, v, ui) {
              const jw = CC.titrationJump(VA, CA, CB, KAC);
              st.compare = true;
              const vb = endpointV(v.wind, true, false);
              const vf = endpointV(v.wind, true, true);
              const c = concFrom(vb);
              const err = CC.relError(c, CA);
              const head = 'Скачок для CH₃COOH: pH ' + f(jw.pH99, 2) + ' → '
                + f(jw.pH101, 2) + ', точка эквивалентности при pH '
                + f(jw.pHeq, 2) + '. ';
              if (err > 5) {
                st.wind = null;
                throw new Error(head + nameOf(v.wind) + ' начинает менять окраску уже '
                  + 'при V = ' + f(vb, 2) + ' мл и заканчивает переход при '
                  + f(vf, 2) + ' мл — задолго до ' + f(VEQ, 2)
                  + ' мл. Отсчёт ' + f(vb, 2) + ' мл дал бы C = ' + f(c, 4)
                  + ' моль/л, то есть ошибку ' + f(err, 1)
                  + ' %. Его интервал перехода лежит ниже скачка — выберите другой.');
              }
              st.wind = v.wind;
              ui.say(head + nameOf(v.wind) + ' меняет окраску при V = '
                + f(vb, 2) + ' мл, что даёт C = ' + f(c, 4)
                + ' моль/л и погрешность ' + f(err, 2)
                + ' %. Его интервал перехода накрывает точку эквивалентности — '
                + 'для слабой кислоты годится только такой индикатор.', 'ok');
            } },
        ],
        done: (st) => st.wind === 'phenolphthalein',
        observe: (st) => {
          const jw = CC.titrationJump(VA, CA, CB, KAC);
          const vmo = endpointV('methylOrange', true, true);
          return {
            what: 'Сравнение: титрование CH₃COOH тем же раствором NaOH',
            obs: 'pH(т.э.) = ' + f(jw.pHeq, 2) + ' (щелочная среда, гидролиз '
              + 'ацетата); фенолфталеин даёт '
              + f(endpointV('phenolphthalein', true, false), 2)
              + ' мл, метилоранж заканчивает переход уже при ' + f(vmo, 2)
              + ' мл — ошибка ' + f(CC.relError(concFrom(vmo), CA), 0) + ' %',
          };
        },
      },
    ],

    /* --------------------------------------------------------- журнал */
    journal: [
      { id: 'v', label: 'Объём титранта в точке эквивалентности', unit: 'мл', tol: 1,
        hint: 'отсчёт по бюретке в конце титрования',
        truth: (st) => st.Vend },
      { id: 'c', label: 'Найденная концентрация HCl', unit: 'моль/л', tol: 1,
        hint: 'C(HCl) = C(NaOH)·V(NaOH)/V(HCl)',
        truth: (st) => concFrom(st.Vend) },
      { id: 'ph', label: 'pH в точке эквивалентности (HCl + NaOH)', unit: '', tol: 2,
        hint: 'сильная кислота и сильное основание дают только NaCl и воду',
        truth: () => pHat(VEQ, null) },
      { id: 'phw', label: 'pH в точке эквивалентности (CH₃COOH + NaOH)', unit: '', tol: 2,
        hint: 'pH = 7 + ½(pKa + lg C) — гидролиз ацетата натрия',
        truth: () => pHat(VEQ, KAC) },
      /* Погрешность — величина второго порядка (погрешность от погрешности):
         требовать её с точностью 2 % значило бы заставлять писать 0,59
         вместо 0,6. Допуск расширен до 5 %. */
      { id: 'err', label: 'Относительная погрешность определения', unit: '%', tol: 5,
        hint: 'ε = |C(найд.) − C(т.э.)|/C(т.э.)·100, с точностью до десятых',
        truth: (st) => CC.relError(concFrom(st.Vend), CA) },
    ],
  });
})();
