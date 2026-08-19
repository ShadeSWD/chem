/* lab-kinetics.js — работа 5: скорость реакции тиосульфата натрия с серной
 * кислотой; влияние концентрации и температуры.
 *
 *   Na₂S₂O₃ + H₂SO₄ = Na₂SO₄ + S↓ + SO₂↑ + H₂O
 *
 * Момент реакции фиксируют по помутнению: выделяющаяся коллоидная сера
 * скрывает метку (крест на бумаге под пробиркой). Условная скорость v = 1/τ.
 *
 * Что здесь считается, а не назначается:
 *   — время τ стенд СЧИТАЕТ по физической модели
 *         v = 1/τ = k·C·γ^((T−T₀)/10),
 *     где произведение k·C берётся из закона действующих масс
 *     (chemcore.rateLaw, порядок по тиосульфату 1), а температурный множитель —
 *     из правила Вант-Гоффа (chemcore.vantHoff); k = 1/15 л/(моль·с),
 *     γ = 2,5, T₀ = 20 °C;
 *   — концентрация тиосульфата в пробирке берётся из тех объёмов раствора и
 *     воды, которые отмерил студент: C = C₀·V(р-ра)/(V(смеси) + V(кислоты));
 *   — температура опыта — та, до которой студент прогрел баню;
 *   — порядок реакции, температурный коэффициент и энергия активации в журнале
 *     считаются из полученной таблицы времён, а не подставляются готовыми,
 *     поэтому найденный студентом γ обязан сойтись с заложенным в модель.
 */
'use strict';
(function () {
  const CC = window.ChemCore, W = window.Labware, L = window.Lab;
  const C = W.C;

  /* ------------------------------------------------------------ модель */

  const C0 = 1.0;          // моль/л — исходный раствор Na₂S₂O₃
  const VMIX = 6;          // мл — раствор + вода в каждой пробирке
  const VACID = 2;         // мл — прибавляемая серная кислота
  const GAMMA = 2.5;       // температурный коэффициент реакции
  const T0 = 20;           // °C — температура серии 1 (комнатная)
  const KRATE = 1 / 15;    // л/(моль·с) — константа скорости при 20 °C

  /* Концентрация тиосульфата после сливания: разбавление водой и кислотой. */
  const conc = (vs) => C0 * vs / (VMIX + VACID);

  /* Закон действующих масс + правило Вант-Гоффа: v = k(T)·C. */
  const rateAt = (c, T) =>
    CC.rateLaw(KRATE * CC.vantHoff(GAMMA, T - T0), [{ C: c, order: 1 }]);
  const tauAt = (c, T) => 1 / rateAt(c, T);

  const done1 = (st) => st.tubes.length >= 4 && st.tubes.every((x) => x.tau > 0);
  const baseTube = (st) => (st.baseIdx >= 0 ? st.tubes[st.baseIdx] : null);

  /* Порядок реакции по тиосульфату: наклон lg(1/τ) по lg C (МНК). */
  function orderN(st) {
    const p = st.tubes.filter((x) => x.tau > 0);
    if (p.length < 2) return NaN;
    const xs = p.map((x) => CC.lg(x.C)), ys = p.map((x) => CC.lg(1 / x.tau));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) * (xs[i] - mx);
    }
    return den > 0 ? num / den : NaN;
  }

  /* Самая широкая температурная пара: та же смесь при 20 °C и в бане. */
  function tempPair(st) {
    const b = baseTube(st);
    if (!b || !(b.tau > 0) || !st.bath.length) return null;
    const last = st.bath[st.bath.length - 1];
    if (!(last.tau > 0) || last.T <= T0) return null;
    return { T1: T0, tau1: b.tau, T2: last.T, tau2: last.tau };
  }

  /* γ из отношения времён: τ₁/τ₂ = γ^(ΔT/10). */
  function gammaFound(st) {
    const p = tempPair(st);
    return p ? Math.pow(p.tau1 / p.tau2, 10 / (p.T2 - p.T1)) : NaN;
  }

  /* Энергия активации из уравнения Аррениуса по той же паре, кДж/моль. */
  function eaFound(st) {
    const p = tempPair(st);
    if (!p) return NaN;
    const T1 = p.T1 + 273, T2 = p.T2 + 273;
    return CC.R * Math.log(p.tau1 / p.tau2) / (1 / T1 - 1 / T2) / 1000;
  }

  /* ------------------------------------------------------------ цвета */

  const CLEAR = '#dff0f5';        // прозрачный раствор
  const MILKY = '#efe8cb';        // муть коллоидной серы (бледно-жёлтая)

  function mixHex(a, b, f) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b), t = Math.max(0, Math.min(1, f));
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t)
      .toString(16).padStart(2, '0')).join('');
  }
  const turbColor = (turb) => mixHex(CLEAR, MILKY, turb);

  /* Метка — крест на бумаге, видимый сквозь раствор; с ростом мути гаснет. */
  function cross(cx, cy, r, op) {
    if (op <= 0.02) return '';
    const e = ` opacity="${Math.round(op * 100) / 100}"`;
    return W.line(cx - r, cy - r, cx + r, cy + r, C.ink, 1.6, e)
      + W.line(cx - r, cy + r, cx + r, cy - r, C.ink, 1.6, e);
  }

  /* ------------------------------------------------------------ график */

  const GX0 = 424, GX1 = 618, GY0 = 158, GY1 = 52;   // поле графика
  const CMAX = 0.8;                                   // ось C, моль/л

  function chart(st) {
    const s1 = st.tubes.filter((x) => x.tau > 0);
    const s2 = st.bath.filter((x) => x.tau > 0);
    let vmax = 0.05;
    s1.concat(s2).forEach((x) => { vmax = Math.max(vmax, 1 / x.tau); });
    const ymax = Math.ceil(vmax * 1.15 / 0.02) * 0.02;
    const px = (c) => GX0 + (c / CMAX) * (GX1 - GX0);
    const py = (v) => GY0 - (v / ymax) * (GY0 - GY1);

    let s = W.rect(392, 22, 236, 158, '#f7fafb', '#d7dbe0', 1, 8);
    s += W.txt(400, 38, 'График 1/τ (с⁻¹) от C (моль/л)', C.ink, 10.5);
    s += W.line(GX0, GY1 - 4, GX0, GY0, C.gray, 1.2);
    s += W.line(GX0, GY0, GX1 + 4, GY0, C.gray, 1.2);
    s += W.txt(GX0 - 4, GY0 + 3.5, '0', C.gray, 9, 'end');
    s += W.txt(GX0 - 4, GY1 + 3.5, L.fmt(ymax, 2), C.gray, 9, 'end');
    [0.4, 0.8].forEach((c) => {
      s += W.line(px(c), GY0, px(c), GY0 + 3, C.gray, 1);
      s += W.txt(px(c), GY0 + 13, L.fmt(c, 1), C.gray, 9, 'middle');
    });

    /* линия по точкам серии 1 — только после обработки результатов */
    if (st.fitted && s1.length >= 2) {
      const k = s1.reduce((a, x) => a + (1 / x.tau) / x.C, 0) / s1.length;
      const cEnd = Math.min(CMAX, ymax / k);
      s += W.line(px(0), py(0), px(cEnd), py(k * cEnd), C.water, 1.4,
        ' stroke-dasharray="5 3"');
    }
    /* точки серии 1 (20 °C) */
    s1.forEach((x) => { s += W.circle(px(x.C), py(1 / x.tau), 3.2, C.water); });
    /* точки серии 2 (баня) */
    s2.forEach((x) => {
      const X = px(x.C), Y = py(1 / x.tau);
      s += `<path d="M ${X} ${Y - 4} L ${X + 4} ${Y} L ${X} ${Y + 4} L ${X - 4} ${Y} Z" fill="${C.red}"/>`;
      s += W.txt(X + 7, Y + 3.5, L.fmt(x.T, 0) + ' °C', C.red, 9);
    });
    if (!s1.length) s += W.txt((GX0 + GX1) / 2, 108, 'точек пока нет', C.gray, 10, 'middle');
    return s;
  }

  /* ------------------------------------------------------------ работа */

  L.define('kinetics', {
    scene: { w: 640, h: 356 },
    alt: 'лабораторный стол: четыре пробирки в штативе над листом с меткой, '
      + 'мерный цилиндр, капельница с серной кислотой, водяная баня на плитке '
      + 'с термометром и график зависимости условной скорости от концентрации',

    init() {
      return {
        tubes: [],        // {vs, vw, C, T, tau}
        bath: [],         // {T, C, tau}
        baseIdx: -1,      // какая смесь взята в температурную серию
        Tbath: 20,        // °C — температура воды в бане
        active: null,     // что мутнеет прямо сейчас
        fitted: false,    // график обработан
      };
    },

    /* ---------------------------------------------------------- сцена */
    draw(st, t) {
      const BENCH = 302;
      const TW = 24, TH = 92, TY = BENCH - 8 - TH;
      const TX = [44, 80, 116, 152];
      let s = W.bench(640, BENCH);

      /* --- табло --- */
      s += W.rect(8, 8, 300, 82, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(18, 26, 'Na₂S₂O₃ + H₂SO₄ = Na₂SO₄ + S↓ + SO₂↑ + H₂O', C.ink, 10.5);
      s += W.txt(18, 43, 'C₀ = 1,0 моль/л; в пробирке 6 мл смеси + 2 мл кислоты',
        C.gray, 10.5);
      const nDone = st.tubes.filter((x) => x.tau > 0).length;
      s += W.txt(18, 60, 'измерено: серия 1 — ' + nDone + ' из 4, серия 2 — '
        + st.bath.length + ' из 2', nDone ? C.green : C.gray, 10.5);
      s += W.txt(18, 78, 'над пробирками C, моль/л; под столом τ, с', C.gray, 10);

      /* --- лист с метками и штатив --- */
      s += W.rect(42, BENCH - 8, 136, 8, '#f6f2e4', '#ddd6c2', 1);
      s += W.txt(110, BENCH + 34, 'лист с меткой (крест)', C.gray, 10.5, 'middle');
      s += W.line(38, 226, 38, BENCH, C.gray, 2);
      s += W.line(188, 226, 188, BENCH, C.gray, 2);
      s += W.rect(34, 214, 158, 12, '#e6dcc6', C.gray, 1.2, 2);

      /* --- пробирки серии 1 --- */
      s += W.txt(30, 198, 'C:', C.gray, 9.5, 'end');
      s += W.txt(30, BENCH + 18, 'τ:', C.gray, 9.5, 'end');
      for (let i = 0; i < 4; i++) {
        const tb = st.tubes[i];
        const cx = TX[i] + TW / 2;
        const act = st.active && st.active.kind === 'tube' && st.active.i === i;
        const turb = tb && tb.tau > 0 ? (act ? t : 1) : 0;
        const fill = tb ? (tb.tau > 0 ? 0.6 : 0.45) : 0;
        s += W.at(TX[i], TY, W.tube(TW, TH, fill, turbColor(turb),
          { gas: act ? t : 0 }));
        if (tb && fill > 0) s += cross(cx, BENCH - 34, 4.5, 1 - Math.min(1, turb * 1.3));
        s += W.txt(cx, 222.5, String(i + 1), C.ink, 9.5, 'middle');
        if (tb) s += W.txt(cx, 198, L.fmt(tb.C, 3), C.ink, 9, 'middle');
        if (tb && tb.tau > 0) {
          s += W.txt(cx, BENCH + 18, L.fmt(tb.tau, 1), C.green, 9.5, 'middle');
        }
      }

      /* --- мерный цилиндр и капельница с кислотой --- */
      s += W.at(214, BENCH - 96, W.cylinder(30, 96, st.tubes.length < 4 ? 0.5 : 0.15,
        CLEAR, { divisions: 10, scale: 10 }));
      s += W.txt(229, BENCH + 18, 'мерный цилиндр', C.gray, 10.5, 'middle');
      s += W.at(330, BENCH - 54, W.dropper(34, 54, '#f0e6e4', 'H₂SO₄'));
      s += W.txt(347, BENCH + 18, 'H₂SO₄, 1 моль/л', C.gray, 10.5, 'middle');

      /* --- водяная баня --- */
      const hot = st.Tbath > T0 + 0.5;
      s += W.at(396, BENCH - 26, W.hotplate(120, 26, hot));
      s += W.at(408, 202, W.beaker(96, 74, 0.62, '#dbeaf0'));
      /* кипящая вода в бане: пузырьки у стенок стакана */
      if (hot) {
        for (let i = 0; i < 5; i++) {
          const ph = (t * 1.2 + i * 0.19) % 1;
          s += W.circle(418 + (i * 17) % 78, 268 - ph * 30, 1.6 + (i % 2) * 0.7,
            'rgba(21,94,117,.35)');
        }
      }
      const bt = st.bath.length ? st.bath[st.bath.length - 1] : null;
      const actB = st.active && st.active.kind === 'bath';
      const turbB = bt ? (actB ? t : 1) : 0;
      s += W.at(444, 210, W.tube(20, 64, bt ? 0.6 : 0.45, turbColor(turbB),
        { gas: actB ? t : 0 }));
      if (bt) s += cross(454, 254, 4, 1 - Math.min(1, turbB * 1.3));
      /* термометр */
      s += W.line(486, 206, 486, 258, C.glass, 3);
      s += W.circle(486, 262, 4.5, C.red);
      s += W.line(486, 258, 486, 258 - Math.min(46, (st.Tbath - 10) * 1.1), C.red, 2.2);
      s += W.txt(506, 214, L.fmt(st.Tbath, 0) + ' °C', hot ? C.red : C.gray, 11);
      s += W.txt(456, 196, 'та же смесь в бане', C.gray, 10, 'middle');
      s += W.txt(456, BENCH + 18, 'водяная баня', C.gray, 10.5, 'middle');
      if (st.bath.length) {
        s += W.txt(456, BENCH + 34, st.bath.map((x) => 'τ(' + L.fmt(x.T, 0)
          + ' °C) = ' + L.fmt(x.tau, 1) + ' с').join('; '), C.green, 9.5, 'middle');
      }

      /* --- график --- */
      s += chart(st);
      return s;
    },

    /* ---------------------------------------------------------- шаги */
    steps: [
      {
        name: 'Приготовить пробирки с разным разбавлением',
        hint: 'Четыре пробирки заполняют мерным цилиндром так, чтобы объём смеси '
          + 'во всех был одинаковым — 6 мл: меняется только доля тиосульфата, '
          + 'а всё остальное остаётся тем же, иначе сравнивать нечего. '
          + 'Первая пробирка контрольная — 6 мл раствора без воды; дальше берут, '
          + 'например, 4 + 2, 3 + 3 и 2 + 4 мл. Нажимайте «Наполнить очередную '
          + 'пробирку» четыре раза, меняя объёмы.',
        controls: [
          { kind: 'number', id: 'vs', label: 'раствор Na₂S₂O₃', unit: 'мл',
            min: 0, max: 6, step: 1, value: 6 },
          { kind: 'number', id: 'vw', label: 'вода', unit: 'мл',
            min: 0, max: 6, step: 1, value: 0 },
          { kind: 'act', label: 'Наполнить очередную пробирку', primary: true,
            act(st, v, ui) {
              if (st.tubes.length >= 4) throw new Error('Все четыре пробирки уже наполнены.');
              const vs = v.vs, vw = v.vw;
              if (!isFinite(vs) || !isFinite(vw) || vs < 0 || vw < 0) {
                throw new Error('Введите оба объёма — их отмеряют мерным цилиндром.');
              }
              if (Math.abs(vs + vw - VMIX) > 1e-6) {
                throw new Error('Общий объём смеси во всех пробирках должен быть '
                  + 'одинаковым — ' + VMIX + ' мл, а получилось ' + L.fmt(vs + vw, 1)
                  + ' мл. Иначе изменится не только концентрация, и сравнивать '
                  + 'времена будет нельзя.');
              }
              if (vs <= 0) throw new Error('Без тиосульфата реакции не будет: '
                + 'мутить раствор нечему.');
              if (st.tubes.length === 0 && vs !== VMIX) {
                throw new Error('Первая пробирка — контрольная, без разбавления: '
                  + VMIX + ' мл раствора и 0 мл воды. С ней сравнивают остальные.');
              }
              if (st.tubes.some((x) => x.vs === vs)) {
                throw new Error('Такое разбавление уже есть. Разбавления должны '
                  + 'различаться, иначе точки на графике совпадут.');
              }
              st.tubes.push({ vs, vw, C: conc(vs), T: T0, tau: 0 });
              ui.say('Пробирка ' + st.tubes.length + ': ' + L.fmt(vs, 0)
                + ' мл раствора + ' + L.fmt(vw, 0) + ' мл воды. После добавления '
                + VACID + ' мл кислоты C(Na₂S₂O₃) = ' + L.fmt(conc(vs), 3) + ' моль/л.', 'ok');
            } },
        ],
        done: (st) => st.tubes.length >= 4,
        observe: (st) => ({
          what: 'Приготовлены 4 пробирки по ' + VMIX + ' мл: '
            + st.tubes.map((x) => L.fmt(x.vs, 0) + ' + ' + L.fmt(x.vw, 0)).join('; ') + ' мл',
          obs: 'растворы бесцветные и прозрачные, метка видна; '
            + 'C = ' + st.tubes.map((x) => L.fmt(x.C, 3)).join(' / ') + ' моль/л',
        }),
      },
      {
        name: 'Опыт с первой пробиркой',
        hint: 'В первую (неразбавленную) пробирку приливают ' + VACID + ' мл серной '
          + 'кислоты и одновременно пускают секундомер. Отсчёт останавливают в тот '
          + 'момент, когда крест на бумаге под пробиркой перестаёт быть виден: '
          + 'выделившаяся сера делает раствор непрозрачным. Условная скорость '
          + 'реакции v = 1/τ.',
        controls: [
          { kind: 'act', label: 'Прилить кислоту и пустить секундомер', primary: true,
            act(st, v, ui) {
              if (!st.tubes.length) throw new Error('Пробирки ещё не приготовлены.');
              if (st.tubes[0].tau > 0) throw new Error('Опыт с первой пробиркой уже проведён.');
              const tb = st.tubes[0];
              tb.T = T0;
              tb.tau = tauAt(tb.C, T0);
              st.active = { kind: 'tube', i: 0 };
              ui.say('Раствор мутнеет, метка исчезла через ' + L.fmt(tb.tau, 1)
                + ' с. Условная скорость 1/τ = ' + L.fmt(1 / tb.tau, 3) + ' с⁻¹.', 'ok');
            } },
        ],
        done: (st) => st.tubes.length > 0 && st.tubes[0].tau > 0,
        observe: (st) => ({
          what: 'В пробирку 1 (C = ' + L.fmt(st.tubes[0].C, 3) + ' моль/л) прилито '
            + VACID + ' мл H₂SO₄ при ' + T0 + ' °C',
          obs: 'равномерное помутнение, метка исчезла через '
            + L.fmt(st.tubes[0].tau, 1) + ' с; 1/τ = ' + L.fmt(1 / st.tubes[0].tau, 3) + ' с⁻¹',
        }),
      },
      {
        name: 'Повторить опыт с остальными разбавлениями',
        hint: 'Те же ' + VACID + ' мл кислоты приливают в оставшиеся пробирки — '
          + 'по одной, при той же комнатной температуре. Точки появляются на '
          + 'графике по мере измерений: чем меньше концентрация тиосульфата, тем '
          + 'дольше приходится ждать помутнения.',
        controls: [
          { kind: 'act', label: 'Прилить кислоту в очередную пробирку', primary: true,
            act(st, v, ui) {
              const i = st.tubes.findIndex((x) => !(x.tau > 0));
              if (i < 0) throw new Error('Все пробирки серии 1 уже отработаны.');
              if (i === 0) throw new Error('Начните с первой пробирки на предыдущем шаге.');
              const tb = st.tubes[i];
              tb.T = T0;
              tb.tau = tauAt(tb.C, T0);
              st.active = { kind: 'tube', i };
              ui.say('Пробирка ' + (i + 1) + ': C = ' + L.fmt(tb.C, 3)
                + ' моль/л, τ = ' + L.fmt(tb.tau, 1) + ' с, 1/τ = '
                + L.fmt(1 / tb.tau, 3) + ' с⁻¹.', 'ok');
            } },
        ],
        done: (st) => done1(st),
        observe: (st) => ({
          what: 'Опыты с пробирками 2–4 при ' + T0 + ' °C',
          obs: st.tubes.map((x) => 'C = ' + L.fmt(x.C, 3) + ' → τ = '
            + L.fmt(x.tau, 1) + ' с').join('; '),
        }),
      },
      {
        name: 'Опыт при 30 °C на водяной бане',
        hint: 'Для температурной серии берут одну и ту же смесь — такую же, как в '
          + 'выбранной пробирке серии 1, — и прогревают её в стакане с водой на '
          + 'плитке. Пробирку выдерживают в бане несколько минут, чтобы раствор '
          + 'принял температуру воды, и только потом приливают кислоту. Вторую '
          + 'точку берут при 30 °C: шаг в 10 градусов — тот, для которого записано '
          + 'правило Вант-Гоффа.',
        controls: [
          { kind: 'select', id: 'base', label: 'смесь как в пробирке', options: [
            { v: '3', t: 'пробирка 3' }, { v: '1', t: 'пробирка 1' },
            { v: '2', t: 'пробирка 2' }, { v: '4', t: 'пробирка 4' }] },
          { kind: 'number', id: 'T', label: 'температура бани', unit: '°C',
            min: 20, max: 60, step: 1, value: 30 },
          { kind: 'act', label: 'Прогреть и прилить кислоту', primary: true,
            act(st, v, ui) {
              const i = parseInt(v.base, 10) - 1;
              const tb = st.tubes[i];
              if (!tb || !(tb.tau > 0)) throw new Error('У этой пробирки нет измерения '
                + 'при ' + T0 + ' °C — сравнивать будет не с чем.');
              const T = v.T;
              if (!isFinite(T)) throw new Error('Введите температуру бани.');
              if (T < 28 || T > 32) throw new Error('Вторую точку серии берут при '
                + '30 °C (допустимо 28–32 °C): правило Вант-Гоффа записано на шаг '
                + 'в 10 градусов от комнатной температуры.');
              if (st.bath.length) throw new Error('Опыт при 30 °C уже проведён.');
              st.baseIdx = i;
              st.Tbath = T;
              st.bath.push({ T, C: tb.C, tau: tauAt(tb.C, T) });
              st.active = { kind: 'bath' };
              ui.say('При ' + L.fmt(T, 0) + ' °C помутнение наступило через '
                + L.fmt(st.bath[0].tau, 1) + ' с вместо ' + L.fmt(tb.tau, 1)
                + ' с при ' + T0 + ' °C.', 'ok');
            } },
        ],
        done: (st) => st.bath.length >= 1,
        observe: (st) => ({
          what: 'Смесь состава пробирки ' + (st.baseIdx + 1) + ' (C = '
            + L.fmt(st.bath[0].C, 3) + ' моль/л) прогрета до '
            + L.fmt(st.bath[0].T, 0) + ' °C',
          obs: 'помутнение через ' + L.fmt(st.bath[0].tau, 1) + ' с; ускорение в '
            + L.fmt(baseTube(st).tau / st.bath[0].tau, 2) + ' раза по сравнению с '
            + T0 + ' °C',
        }),
      },
      {
        name: 'Опыт при 40 °C',
        hint: 'Ту же смесь берут в третий раз и прогревают до 40 °C. Две точки '
          + 'дают температурный коэффициент, но третья нужна для проверки: '
          + 'если γ, найденный по парам 20–30 и 20–40 °C, совпадает, правило '
          + 'Вант-Гоффа для этой реакции выполняется.',
        controls: [
          { kind: 'number', id: 'T2', label: 'температура бани', unit: '°C',
            min: 20, max: 60, step: 1, value: 40 },
          { kind: 'act', label: 'Прогреть до 40 °C и прилить кислоту', primary: true,
            act(st, v, ui) {
              if (!st.bath.length) throw new Error('Сначала проведите опыт при 30 °C.');
              if (st.bath.length >= 2) throw new Error('Опыт при 40 °C уже проведён.');
              const T = v.T2;
              if (!isFinite(T)) throw new Error('Введите температуру бани.');
              if (T < 38 || T > 42) throw new Error('Третью точку берут при 40 °C '
                + '(допустимо 38–42 °C): при более сильном нагреве помутнение '
                + 'наступает быстрее, чем секундомер успевает дать надёжный отсчёт.');
              const tb = baseTube(st);
              st.Tbath = T;
              st.bath.push({ T, C: tb.C, tau: tauAt(tb.C, T) });
              st.active = { kind: 'bath' };
              ui.say('При ' + L.fmt(T, 0) + ' °C помутнение через '
                + L.fmt(st.bath[1].tau, 1) + ' с. Все данные для расчёта γ собраны.', 'ok');
            } },
        ],
        done: (st) => st.bath.length >= 2,
        observe: (st) => ({
          what: 'Та же смесь прогрета до ' + L.fmt(st.bath[1].T, 0) + ' °C',
          obs: 'помутнение через ' + L.fmt(st.bath[1].tau, 1) + ' с; ряд времён '
            + L.fmt(baseTube(st).tau, 1) + ' / ' + L.fmt(st.bath[0].tau, 1) + ' / '
            + L.fmt(st.bath[1].tau, 1) + ' с при ' + T0 + ' / '
            + L.fmt(st.bath[0].T, 0) + ' / ' + L.fmt(st.bath[1].T, 0) + ' °C',
        }),
      },
      {
        name: 'Построить график и обработать результаты',
        hint: 'По точкам серии 1 строят зависимость условной скорости 1/τ от '
          + 'концентрации тиосульфата. Если она линейна и проходит через начало '
          + 'координат, скорость прямо пропорциональна концентрации, то есть '
          + 'порядок реакции по тиосульфату равен единице — это и есть закон '
          + 'действующих масс. Дальше по временам температурной серии считают '
          + 'γ и энергию активации и заносят их в журнал.',
        controls: [
          { kind: 'act', label: 'Построить прямую по точкам', primary: true,
            act(st, v, ui) {
              if (!done1(st)) throw new Error('Для прямой нужны все четыре точки серии 1.');
              st.fitted = true;
              const k = st.tubes.reduce((a, x) => a + (1 / x.tau) / x.C, 0) / st.tubes.length;
              ui.say('Отношение (1/τ)/C одинаково для всех точек и равно '
                + L.fmt(k, 3) + ' л/(моль·с) — прямая проходит через начало '
                + 'координат. Температурные точки отмечены на том же графике '
                + 'красным: они лежат выше при той же концентрации.', 'ok');
            } },
        ],
        done: (st) => st.fitted,
        observe: (st) => ({
          what: 'Построен график 1/τ — C по четырём точкам серии 1',
          obs: 'прямая через начало координат: v прямо пропорциональна C, '
            + 'порядок реакции по тиосульфату равен 1; точки серии 2 при той же '
            + 'концентрации лежат тем выше, чем горячее раствор',
        }),
      },
    ],

    /* --------------------------------------------------------- журнал */
    journal: [
      { id: 'tau1', label: 'Время реакции при исходной концентрации', unit: 'с', tol: 5,
        hint: 'пробирка 1, без разбавления, ' + T0 + ' °C',
        truth: (st) => (st.tubes[0] ? st.tubes[0].tau : NaN) },
      { id: 'v1', label: 'Условная скорость реакции 1/τ', unit: 'с⁻¹', tol: 5,
        hint: 'для той же пробирки 1',
        truth: (st) => (st.tubes[0] && st.tubes[0].tau > 0 ? 1 / st.tubes[0].tau : NaN) },
      { id: 'n', label: 'Порядок реакции по тиосульфату', unit: '', tol: 10,
        hint: 'наклон зависимости lg(1/τ) от lg C',
        truth: (st) => orderN(st) },
      { id: 'gamma', label: 'Температурный коэффициент γ', unit: '', tol: 8,
        hint: 'γ = (τ₁/τ₂)^(10/ΔT) по крайним температурам серии 2',
        truth: (st) => gammaFound(st) },
      { id: 'ea', label: 'Энергия активации Eₐ', unit: 'кДж/моль', tol: 10,
        hint: 'Eₐ = R·ln(τ₁/τ₂)/(1/T₁ − 1/T₂), T — в кельвинах',
        truth: (st) => eaFound(st) },
    ],
  });
})();
