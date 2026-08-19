/* lab-hardness.js — работа 4: жёсткость воды и её устранение.
 *
 * Что здесь считается, а не назначается:
 *   — общая жёсткость берётся из ОТСЧЁТА ПО БЮРЕТКЕ, который студент набрал
 *     сам (chemcore.hardnessFromTitration): перетитровал — жёсткость выйдет
 *     завышенной, недолил — стенд не даст записать отсчёт, потому что
 *     окраска ещё винно-красная;
 *   — момент перехода эриохрома чёрного Т считается по балансу эквивалентов
 *     трилона Б и суммы Ca²⁺ + Mg²⁺ в колбе, а не по номеру шага;
 *   — окраска метилоранжа при титровании соляной кислотой берётся
 *     chemcore.indicatorColor по pH, который считается из состава колбы
 *     (буфер HCO₃⁻/H₂CO₃ до точки эквивалентности, избыток сильной кислоты
 *     после неё);
 *   — доля разложившихся гидрокарбонатов зависит от того, сколько минут
 *     студент кипятил пробу; объём выделившегося CO₂ — chemcore.gasFromMass;
 *   — выпадение CaCO₃ после соды проверяется chemcore.willPrecipitate
 *     (произведение концентраций против ПР), а остаточная жёсткость
 *     ограничена снизу растворимостью CaCO₃ (chemcore.solubility) — отсюда
 *     и невозможность умягчить воду «в ноль» реагентным методом.
 *
 * Эриохрома чёрного Т в справочнике chemcore.INDICATORS нет (там кислотно-
 * основные индикаторы), поэтому его переход считается здесь, в файле работы,
 * из мольного баланса — chemcore не трогаем.
 */
'use strict';
(function () {
  const CC = window.ChemCore, W = window.Labware, L = window.Lab;
  const C = W.C;

  /* ---------------- состав пробы (вариант задания, студенту не показан) ----
     Ca(HCO₃)₂ и Mg(HCO₃)₂ дают карбонатную жёсткость, CaSO₄ — некарбонатную. */
  const c_CaHCO3 = 1.7e-3;                 // моль/л
  const c_MgHCO3 = 0.6e-3;                 // моль/л
  const c_CaSO4 = 1.1e-3;                  // моль/л

  const H_CARB = CC.hardnessFromMolar(c_CaHCO3, c_MgHCO3);   // 4,6 мэкв/л
  const H_NONCARB = CC.hardnessFromMolar(c_CaSO4, 0);        // 2,2 мэкв/л
  const H_TOTAL = H_CARB + H_NONCARB;                        // 6,8 мэкв/л
  /* та же жёсткость по массовым концентрациям ионов — сверка лекционных
     эквивалентов: 1 мэкв Ca²⁺ = 20 мг, 1 мэкв Mg²⁺ = 12 мг */
  const MG_CA = (c_CaHCO3 + c_CaSO4) * CC.A.Ca * 1000;       // 112 мг/л
  const MG_MG = c_MgHCO3 * CC.A.Mg * 1000;                   // 14,4 мг/л

  /* ---------------- реактивы и посуда ---------------- */
  const CT = 0.05;                         // трилон Б, моль/л
  const CHCL = 0.1;                        // соляная кислота, моль/л
  const CSODA = 0.1;                       // раствор соды из работы 1, моль/л
  const V_SOFT = 1.0;                      // л — порция воды на умягчение
  const V_CTRL = 100;                      // мл — проба на контрольное титрование
  const MEQ_SODA = CC.molarMass('Na2CO3') / 2;    // 53 г/экв
  const BURETTE = 25;                      // мл — вместимость бюретки
  const T_FULL = 15;                       // мин кипячения до полного разложения
  const KA1 = CC.KA.H2CO3_1;               // первая ступень угольной кислоты

  /* Предел умягчения: растворимость CaCO₃ по ПР (лекция 12). */
  const FLOOR = CC.hardnessFromMolar(CC.solubility('CaCO3'), 0);   // ≈0,14 мэкв/л

  /* ---------------- цвета ---------------- */
  const COL_CLEAR = '#cfe7f0';             // бесцветная проба (тон — чтобы был виден уровень)
  const COL_RED = '#8e2942';               // Mg–ЭХЧТ: винно-красная
  const COL_MID = '#6b4a8a';               // переход
  const COL_BLUE = '#2456a6';              // свободный ЭХЧТ: синяя
  const COL_MILK = '#dde6ea';              // муть карбоната
  const COL_SCALE = '#b9c2c8';             // накипь

  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
    5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  /* Число в виде 1,3·10⁻⁶ — иначе ПР и произведение концентраций на табло
     превращаются в «0,00». */
  function sci(x) {
    if (!isFinite(x) || x <= 0) return '0';
    const e = Math.floor(CC.lg(x));
    const m = x / Math.pow(10, e);
    return L.fmt(m, 1) + '·10' + String(e).split('').map((ch) => SUP[ch]).join('');
  }
  const r2 = (x) => Math.round(x * 100) / 100;

  /* ================= расчёты по состоянию ================= */

  /* Объём пробы в колбе: на контрольном титровании он свой. */
  const Vin = (st) => (st.stage === 3 ? V_CTRL : st.Vsample);

  /* Доля разложившихся гидрокарбонатов: за T_FULL минут кипячения — вся. */
  const boilFrac = (st) => Math.min(1, Math.max(0, st.boilMin / T_FULL));

  /* Жёсткость воды в стакане после кипячения: карбонатная уходит, но не ниже
     предела, который задаёт растворимость выпавшего CaCO₃. */
  const Hboil = (st) => H_TOTAL - boilFrac(st) * (H_CARB - FLOOR);

  /* Внесено соды, мэкв/л (1 моль Na₂CO₃ = 2 экв). */
  const dosed = (st) => CSODA * 2 * st.Vsoda / V_SOFT;

  /* Жёсткость после соды: ниже предела по ПР не опускается. */
  const Hfinal = (st) => Math.max(FLOOR, Hboil(st) - dosed(st));

  /* Жёсткость воды, налитой в колбу на данном этапе работы. */
  const Hflask = (st) => (st.stage === 3 ? Hfinal(st) : H_TOTAL);

  /* Сколько трилона Б в колбе сейчас. */
  const Vedta = (st) => (st.stage === 3 ? st.Vt3 : st.Vt);

  /* Объём титранта до точки эквивалентности, мл. */
  const VeqEDTA = (st) => Hflask(st) * Vin(st) / (CT * 2 * 1000);

  /* Доля связанных трилоном ионов Ca²⁺ + Mg²⁺ — от неё зависит окраска ЭХЧТ. */
  function edtaFrac(st) {
    const need = Hflask(st) * Vin(st) / 1000;         // мэкв в колбе
    if (need <= 0) return 0;
    return CT * 2 * Vedta(st) / need;                 // прилито мэкв / надо мэкв
  }

  /* Окраска эриохрома чёрного Т: пока в растворе есть незакомплексованные
     Ca²⁺ и Mg²⁺, индикатор связан с металлом и раствор винно-красный; когда
     трилон Б отнял последние ионы, индикатор выходит свободным — синий. */
  function ebt(st) {
    const f = edtaFrac(st);
    if (f >= 1 - 1e-9) return { t: 'синяя', c: COL_BLUE, done: true };
    if (f >= 0.97) return { t: 'лиловая (переход)', c: COL_MID, done: false };
    return { t: 'винно-красная', c: COL_RED, done: false };
  }

  /* pH в колбе при титровании гидрокарбонатов соляной кислотой: до точки
     эквивалентности — буфер HCO₃⁻/H₂CO₃, после — избыток сильной кислоты
     поверх насыщенного раствора CO₂. */
  function pHhcl(st) {
    const nHCO3 = H_CARB * st.Vsample / 1e6;          // моль HCO₃⁻ в пробе
    const nHCl = CHCL * st.Vhcl / 1000;               // моль прилитой HCl
    const V = (st.Vsample + st.Vhcl) / 1000;          // л
    if (V <= 0 || nHCO3 <= 0) return 7;
    if (nHCl < nHCO3) return CC.pHBuffer(nHCl / V, (nHCO3 - nHCl) / V, KA1);
    const hStrong = (nHCl - nHCO3) / V;
    const hWeak = Math.pow(10, -CC.pHWeakAcid(nHCO3 / V, KA1));
    return Math.max(0, -CC.lg(hStrong + hWeak));
  }
  const moColor = (st) => CC.indicatorColor('methylOrange', pHhcl(st));

  /* Объём CO₂ (н.у.) при кипячении V_SOFT литров:
     Ca(HCO₃)₂ → CaCO₃↓ + CO₂↑ + H₂O и Mg(HCO₃)₂ → Mg(OH)₂↓ + 2CO₂↑. */
  function co2(st) {
    const Mca = CC.molarMass('Ca(HCO3)2'), Mmg = CC.molarMass('Mg(HCO3)2');
    const g1 = CC.gasFromMass(c_CaHCO3 * V_SOFT * Mca, Mca, 1, 1);
    const g2 = CC.gasFromMass(c_MgHCO3 * V_SOFT * Mmg, Mmg, 1, 2);
    return (g1.V + g2.V) * boilFrac(st);              // л
  }
  /* Масса осадка, снятого кипячением, г на V_SOFT литров. */
  const scaleMass = (st) => boilFrac(st) * V_SOFT *
    (c_CaHCO3 * CC.molarMass('CaCO3') + c_MgHCO3 * CC.molarMass('Mg(OH)2'));

  /* Осаждается ли CaCO₃ содой: произведение концентраций против ПР. */
  function sodaPrecip(st) {
    const cCa = Hboil(st) / 2 / 1000;                 // моль/л Ca²⁺ перед содой
    const cCO3 = CSODA * st.Vsoda / (V_SOFT * 1000 + st.Vsoda);
    return CC.willPrecipitate('CaCO3', cCa, cCO3, 1, 1);
  }

  /* ---------------- то, что студент измерил ---------------- */
  const Hobs = (st) => (st.Vt_read > 0 && st.Vsample > 0)
    ? CC.hardnessFromTitration(CT, st.Vt_read, st.Vsample) : 0;
  /* карбонатная — через молярную концентрацию гидрокарбонат-ионов:
     c(экв. Ca) = c(HCO₃⁻)/2, дальше та же формула жёсткости */
  const HcarbObs = (st) => (st.Vhcl_read > 0 && st.Vsample > 0)
    ? CC.hardnessFromMolar(CHCL * st.Vhcl_read / st.Vsample / 2, 0) : 0;
  const HncObs = (st) => Math.max(0, Hobs(st) - HcarbObs(st));
  const doseObs = (st) => CC.softeningDose(HncObs(st), V_SOFT, MEQ_SODA);
  const VsodaNeed = (st) => HncObs(st) * V_SOFT / (CSODA * 2);      // мл раствора
  const HresObs = (st) => st.Vt3_read > 0
    ? CC.hardnessFromTitration(CT, st.Vt3_read, V_CTRL) : 0;

  /* ================= определение работы ================= */

  L.define('hardness', {
    scene: { w: 640, h: 340 },
    alt: 'лабораторный стол: штатив с бюреткой над конической колбой с пробой '
      + 'воды, рядом стакан с кипящей пробой на электроплитке, пипетка Мора и '
      + 'капельницы с буфером и индикаторами',

    init() {
      return {
        stage: 0,          // 0 — колба пуста, 1 — проба на трилон, 2 — на HCl, 3 — контроль
        Vsample: 0,        // мл — объём пробы, отобранной пипеткой
        buffer: false,     // аммиачный буфер прилит
        indicator: false,  // эриохром чёрный Т внесён
        Vt: 0,             // мл трилона Б в колбе
        Vt_read: 0,        // записанный отсчёт, мл
        sample2: false,    // вторая проба с метилоранжем
        Vhcl: 0,
        Vhcl_read: 0,
        inBeaker: false,   // проба налита в стакан
        boilMin: 0,
        boiled: false,
        filtered: false,   // слито с осадка
        Vsoda: 0,          // мл 0,1 М Na₂CO₃
        softened: false,
        ctrlReady: false,  // проба умягчённой воды с буфером и индикатором
        Vt3: 0,
        Vt3_read: 0,
      };
    },

    /* ------------------------------------------------------------ сцена */
    draw(st, t) {
      const BENCH = 300;
      let s = W.bench(640, BENCH);

      /* --- что сейчас в бюретке и в колбе --- */
      const hcl = st.stage === 2;
      const titrant = hcl ? 'HCl 0,1 моль/л' : 'трилон Б 0,05 моль/л';
      const Vt = hcl ? st.Vhcl : Vedta(st);
      const busy = (st.stage === 1 && st.indicator && !st.Vt_read)
        || (st.stage === 2 && st.sample2 && !st.Vhcl_read)
        || (st.stage === 3 && st.ctrlReady && !st.Vt3_read);

      let col = COL_CLEAR, note = '', noteCol = C.gray;
      if ((st.stage === 1 && st.indicator) || (st.stage === 3 && st.ctrlReady)) {
        const e = ebt(st); col = e.c; note = e.t; noteCol = e.c;
      } else if (st.stage === 2 && st.sample2) {
        const m = moColor(st); col = m.c; note = m.t; noteCol = C.ink;
      }

      /* --- штатив с бюреткой --- */
      s += W.at(8, BENCH - 270, W.stand(270, { clamps: [22, 116], reach: 60 }));
      s += W.at(88, 36, W.burette(150, 1 - Math.min(1, Vt / BURETTE), '#dff0f5', {
        divisions: 10, scale: BURETTE, drop: busy ? t : null,
      }));
      s += W.txt(96, 22, 'бюретка: ' + titrant, C.gray, 10.5, 'middle');

      /* --- отсчёт и окраска --- */
      s += W.rect(140, 40, 196, 54, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(150, 62, 'прилито: ' + (Vt > 0 ? L.fmt(Vt, 2) + ' мл' : '—'), C.ink, 11);
      s += W.txt(150, 82, 'окраска: ' + (note || 'пробы нет'), noteCol, 11);

      /* --- коническая колба под бюреткой --- */
      const fill = st.stage ? Math.min(0.85, (Vin(st) + Vt) / 250) : 0;
      s += W.at(48, BENCH - 88, W.flaskConical(96, 88, fill, col, {}));
      s += W.txt(96, BENCH + 18,
        st.stage ? 'колба: проба ' + L.fmt(Vin(st), 0) + ' мл' : 'колба 250 мл',
        C.gray, 10.5, 'middle');

      /* --- пипетка Мора --- */
      s += W.at(200, BENCH - 150, W.pipetteMohr(150, 0, COL_CLEAR));
      s += W.txt(210, BENCH + 18, 'пипетка Мора', C.gray, 10.5, 'middle');

      /* --- капельницы --- */
      s += W.txt(330, BENCH - 66, 'капельницы', C.gray, 10, 'middle');
      s += W.at(258, BENCH - 58, W.dropper(40, 58, '#eaf2ee', 'буфер'));
      s += W.at(310, BENCH - 58, W.dropper(40, 58, '#f2e6ea', 'ЭХЧТ'));
      s += W.at(362, BENCH - 58, W.dropper(40, 58, '#f6efdc', 'м/о'));

      /* --- стакан на плитке --- */
      const boiling = st.boiled && !st.filtered;
      s += W.at(430, BENCH - 26, W.hotplate(130, 26, boiling));
      const bw = st.softened ? COL_MILK : COL_CLEAR;
      const solid = st.inBeaker ? (st.softened ? 0.9 : (st.boiled ? 0.55 : 0)) : 0;
      s += W.at(452, 194, W.beaker(86, 80, st.inBeaker ? 0.72 : 0, bw,
        { solid, solidColor: COL_SCALE }));
      if (boiling) {
        /* пузырьки кипения */
        for (let i = 0; i < 9; i++) {
          const ph = ((t * 1.4 + i * 0.11) % 1);
          s += W.circle(462 + (i * 23) % 66, 268 - ph * 44, 1.4 + (i % 3) * 0.7,
            'rgba(21,94,117,.45)');
        }
        /* пар над стаканом */
        for (let i = 0; i < 2; i++) {
          const ph = ((t + i * 0.5) % 1);
          s += W.path('M ' + (478 + i * 30) + ' ' + (192 - ph * 10).toFixed(1)
            + ' q 6 -7 0 -14', 'rgba(107,107,116,' + (0.4 * (1 - ph)).toFixed(2) + ')', 1.6);
        }
      }
      s += W.txt(495, BENCH + 18, st.inBeaker
        ? 'стакан: проба 1,0 л' : 'стакан 1 л на плитке', C.gray, 10.5, 'middle');
      if (st.inBeaker && (st.boiled || st.softened)) {
        s += W.txt(495, BENCH + 32, st.softened
          ? 'на дне осадок CaCO₃ — шлам' : 'на дне и стенках накипь CaCO₃',
        C.gray, 10, 'middle');
      }

      /* --- табло состояния --- */
      s += W.rect(352, 8, 280, 92, '#f7fafb', '#d7dbe0', 1, 8);
      s += W.txt(362, 26, 'Проба: пресная вода, вариант 4', C.ink, 11.5);
      const ho = Hobs(st);
      s += W.txt(362, 44, ho > 0
        ? 'Ж общая = ' + L.fmt(ho, 2) + ' мэкв/л, ' + CC.hardnessGrade(ho)
        : 'Ж общая — не определена', ho > 0 ? C.green : C.gray, 11);
      const hk = HcarbObs(st);
      s += W.txt(362, 62, hk > 0
        ? 'Ж карб. = ' + L.fmt(hk, 2) + ', некарб. = ' + L.fmt(HncObs(st), 2) + ' мэкв/л'
        : 'Ж карбонатная — не определена', hk > 0 ? C.green : C.gray, 11);
      const hr = HresObs(st);
      s += W.txt(362, 80, hr > 0
        ? 'после умягчения ' + L.fmt(hr, 2) + ' мэкв/л, ' + CC.hardnessGrade(hr)
        : (st.softened ? 'умягчено, контроль не сделан' : 'умягчение — впереди'),
      hr > 0 ? C.green : C.gray, 11);
      return s;
    },

    /* ------------------------------------------------------------ шаги */
    steps: [
      {
        name: 'Отобрать пробу воды',
        hint: 'Пробу отбирают пипеткой Мора: объём пробы стоит в формуле '
          + 'жёсткости в знаменателе, поэтому отмерять его стаканом нельзя. '
          + 'Чем больше проба, тем больше отсчёт по бюретке и тем меньше '
          + 'относительная ошибка отсчёта — по методике берут 100 мл. Пробу '
          + 'переливают в коническую колбу на 250 мл: в ней удобно '
          + 'перемешивать круговым движением, не расплёскивая.',
        controls: [
          { kind: 'select', id: 'pip', label: 'пипетка', options: [
            { v: '100', t: '100 мл' }, { v: '50', t: '50 мл' }, { v: '250', t: '250 мл' }] },
          { kind: 'act', label: 'Отобрать пробу в колбу', primary: true, act(st, v, ui) {
            const V = parseInt(v.pip, 10);
            if (V === 250) throw new Error('Проба 250 мл не поместится в колбу на 250 мл '
              + 'вместе с буферным раствором и титрантом, и перемешать её круговым '
              + 'движением не выйдет. Возьмите пипетку на 100 мл.');
            st.Vsample = V;
            st.stage = 1;
            ui.say(V === 100
              ? 'В колбе 100 мл исследуемой воды.'
              : 'В колбе 50 мл. Отсчёт по бюретке будет вдвое меньше, а относительная '
                + 'ошибка отсчёта — вдвое больше; расчёт стенд ведёт по фактическому '
                + 'объёму пробы.', V === 100 ? 'ok' : 'bad');
          } },
        ],
        done: (st) => st.Vsample > 0,
        observe: (st) => ({
          what: 'Отобрана проба воды ' + st.Vsample + ' мл',
          obs: 'вода прозрачная, бесцветная, без запаха и видимого осадка',
        }),
      },
      {
        name: 'Создать среду и внести индикатор',
        hint: 'Комплексы трилона Б с Ca²⁺ и Mg²⁺ прочны только в щелочной '
          + 'среде, поэтому в пробу приливают аммиачный буферный раствор '
          + '(NH₄OH + NH₄Cl), удерживающий pH около 10. Только после этого '
          + 'вносят индикатор эриохром чёрный Т: он связывает ионы магния в '
          + 'винно-красный комплекс, и исчезновение этой окраски служит '
          + 'признаком конца титрования.',
        controls: [
          { kind: 'act', label: 'Прилить 5 мл аммиачного буфера', act(st, v, ui) {
            st.buffer = true;
            ui.say('pH пробы доведён до 10 — это область устойчивости комплексов '
              + 'трилона Б с кальцием и магнием.', 'ok');
          } },
          { kind: 'act', label: 'Внести индикатор ЭХЧТ', primary: true, act(st, v, ui) {
            if (!st.buffer) throw new Error('Сначала буфер. Без буферного раствора '
              + 'pH пробы близок к 7: комплекс индикатора с магнием неустойчив, '
              + 'окраска выйдет грязно-фиолетовой, и перехода в конце титрования '
              + 'вы не увидите.');
            st.indicator = true;
            ui.say('Раствор окрасился в винно-красный цвет — индикатор связал ионы магния.', 'ok');
          } },
        ],
        done: (st) => st.buffer && st.indicator,
        observe: () => ({
          what: 'Добавлены аммиачный буфер (pH 10) и эриохром чёрный Т',
          obs: 'проба стала винно-красной — в воде есть ионы Ca²⁺ и Mg²⁺',
        }),
      },
      {
        name: 'Титровать трилоном Б',
        hint: 'Трилон Б приливают из бюретки при постоянном перемешивании: '
          + 'сначала по миллилитру, у перехода — по каплям. В конце титрования '
          + 'трилон отнимает магний у индикатора, и винно-красная окраска '
          + 'сменяется синей. Записать отсчёт до перехода стенд не даст. '
          + 'Перетитруете — жёсткость получится завышенной, и это будет видно '
          + 'в журнале.',
        controls: [
          { kind: 'act', label: 'Прилить 1,0 мл', act(st, v, ui) { addT(st, ui, 1.0); } },
          { kind: 'act', label: 'Прилить 0,1 мл (по каплям)', act(st, v, ui) { addT(st, ui, 0.1); } },
          { kind: 'act', label: 'Записать отсчёт', primary: true, act(st, v, ui) {
            if (st.Vt <= 0) throw new Error('Титрант ещё не прилит: откройте кран бюретки.');
            const e = ebt(st);
            if (!e.done) throw new Error('Окраска ещё ' + e.t + ' — переход не достигнут. '
              + 'В растворе остаются несвязанные ионы Ca²⁺ и Mg²⁺, приливайте трилон Б дальше.');
            st.Vt_read = st.Vt;
            const H = Hobs(st);
            const over = st.Vt - VeqEDTA(st);
            ui.say('Отсчёт ' + L.fmt(st.Vt_read, 2) + ' мл. Общая жёсткость '
              + L.fmt(H, 2) + ' мэкв/л — вода ' + CC.hardnessGrade(H) + '.'
              + (over > 0.15 ? ' Перетитровано на ' + L.fmt(over, 2)
                + ' мл, результат завышен.' : ''), over > 0.15 ? 'bad' : 'ok');
          } },
        ],
        done: (st) => st.Vt_read > 0,
        observe: (st) => ({
          what: 'Титрование трилоном Б, отсчёт ' + L.fmt(st.Vt_read, 2) + ' мл',
          obs: 'винно-красная окраска перешла в синюю; Ж(общ) = ' + L.fmt(Hobs(st), 2)
            + ' мэкв/л, вода ' + CC.hardnessGrade(Hobs(st))
            + ' (по паспорту пробы Ca²⁺ ' + L.fmt(MG_CA, 3) + ' и Mg²⁺ '
            + L.fmt(MG_MG, 3) + ' мг/л дают '
            + L.fmt(CC.hardnessFromMass(MG_CA, MG_MG), 3) + ' мэкв/л)',
        }),
      },
      {
        name: 'Определить карбонатную жёсткость',
        hint: 'Карбонатная жёсткость — это гидрокарбонаты, то есть щёлочность '
          + 'воды, и её титруют соляной кислотой с метилоранжем. Пока в '
          + 'растворе есть HCO₃⁻, кислота расходуется на его нейтрализацию и '
          + 'раствор остаётся жёлтым; как только гидрокарбонат кончился, pH '
          + 'падает ниже 4,4 и метилоранж становится оранжево-красным. Стенд '
          + 'считает pH по составу колбы и берёт окраску из интервала перехода '
          + 'индикатора.',
        controls: [
          { kind: 'act', label: 'Взять новую пробу и добавить метилоранж', act(st, v, ui) {
            st.stage = 2; st.sample2 = true;
            ui.say('В колбе свежая проба ' + st.Vsample + ' мл, окраска жёлтая: '
              + 'гидрокарбонаты дают щелочную реакцию.', 'ok');
          } },
          { kind: 'act', label: 'Прилить 1,0 мл HCl', act(st, v, ui) { addH(st, ui, 1.0); } },
          { kind: 'act', label: 'Прилить 0,1 мл HCl', act(st, v, ui) { addH(st, ui, 0.1); } },
          { kind: 'act', label: 'Записать отсчёт', primary: true, act(st, v, ui) {
            if (!st.sample2) throw new Error('Сначала возьмите новую пробу: в прежней '
              + 'колбе уже есть трилон Б, буфер и связанные ионы.');
            if (st.Vhcl <= 0) throw new Error('Кислота ещё не прилита.');
            const m = moColor(st);
            if (m.zone === 'base') throw new Error('Метилоранж ещё жёлтый: pH = '
              + L.fmt(pHhcl(st), 2) + ', гидрокарбонаты нейтрализованы не полностью. '
              + 'Приливайте кислоту дальше.');
            st.Vhcl_read = st.Vhcl;
            ui.say('Отсчёт ' + L.fmt(st.Vhcl_read, 2) + ' мл. Карбонатная жёсткость '
              + L.fmt(HcarbObs(st), 2) + ' мэкв/л, некарбонатная по разности — '
              + L.fmt(HncObs(st), 2) + ' мэкв/л.', 'ok');
          } },
        ],
        done: (st) => st.Vhcl_read > 0,
        observe: (st) => ({
          what: 'Титрование HCl с метилоранжем, отсчёт ' + L.fmt(st.Vhcl_read, 2) + ' мл',
          obs: 'жёлтая окраска перешла в ' + moColor(st).t + ' при pH = '
            + L.fmt(pHhcl(st), 2) + '; Ж(карб) = ' + L.fmt(HcarbObs(st), 2)
            + ', Ж(некарб) = ' + L.fmt(HncObs(st), 2) + ' мэкв/л',
        }),
      },
      {
        name: 'Устранить карбонатную жёсткость кипячением',
        hint: 'При нагревании гидрокарбонаты разлагаются: Ca(HCO₃)₂ даёт осадок '
          + 'CaCO₃ и углекислый газ, Mg(HCO₃)₂ — Mg(OH)₂. Это и есть та накипь, '
          + 'которая садится на трубки парогенератора. Кипятить нужно не '
          + 'меньше 15 минут: за меньшее время разложение не заканчивается, и '
          + 'часть карбонатной жёсткости останется в воде — стенд посчитает '
          + 'это честно. После кипячения воду дают отстояться и сливают с осадка.',
        controls: [
          { kind: 'act', label: 'Налить 1,0 л пробы в стакан', act(st, v, ui) {
            st.inBeaker = true;
            ui.say('В стакане 1,0 л исследуемой воды.', 'ok');
          } },
          { kind: 'number', id: 'tb', label: 'кипятить', unit: 'мин',
            min: 1, max: 40, step: 1, value: 20 },
          { kind: 'act', label: 'Кипятить', primary: true, act(st, v, ui) {
            if (!st.inBeaker) throw new Error('Стакан пуст — сначала налейте пробу.');
            if (!isFinite(v.tb) || v.tb <= 0) throw new Error('Введите время кипячения.');
            st.boilMin = v.tb;
            st.boiled = true;
            const f = boilFrac(st);
            ui.say('Кипячение ' + L.fmt(v.tb, 0) + ' мин: разложилось '
              + L.fmt(f * 100, 0) + ' % гидрокарбонатов, выделилось '
              + L.fmt(co2(st) * 1000, 0) + ' мл CO₂ (н.у.), выпало '
              + L.fmt(scaleMass(st), 2) + ' г осадка. Жёсткость в стакане '
              + L.fmt(Hboil(st), 2) + ' мэкв/л.'
              + (f < 1 ? ' Разложение не закончено — прокипятите дольше.' : ''),
            f < 1 ? 'bad' : 'ok');
          } },
          { kind: 'act', label: 'Отстоять и слить с осадка', act(st, v, ui) {
            if (!st.boiled) throw new Error('Сначала прокипятите пробу.');
            st.filtered = true;
            ui.say('Вода слита с осадка. На дне и стенках стакана осталась белая '
              + 'плотная накипь — CaCO₃ с примесью Mg(OH)₂.', 'ok');
          } },
        ],
        done: (st) => st.boiled && st.filtered,
        observe: (st) => ({
          what: 'Кипячение 1,0 л пробы ' + L.fmt(st.boilMin, 0) + ' мин и слив с осадка',
          obs: 'на дне и стенках белый осадок ' + L.fmt(scaleMass(st), 2)
            + ' г, выделилось ' + L.fmt(co2(st) * 1000, 0)
            + ' мл CO₂; жёсткость снизилась до ' + L.fmt(Hboil(st), 2)
            + ' мэкв/л — осталась в основном некарбонатная',
        }),
      },
      {
        name: 'Умягчить остаток содой',
        hint: 'Кипячение снимает только карбонатную жёсткость; сульфат кальция '
          + 'остаётся. Его осаждают содой: CaSO₄ + Na₂CO₃ = CaCO₃↓ + Na₂SO₄. '
          + 'Дозу считают по некарбонатной жёсткости — на 1 мэкв жёсткости '
          + 'нужен 1 мэкв соды, эквивалент Na₂CO₃ равен 53 г/экв. Соду берут '
          + 'готовым 0,1 М раствором из работы 1: в каждом миллилитре 0,2 мэкв. '
          + 'Переведите рассчитанную массу в объём раствора.',
        controls: [
          { kind: 'number', id: 'vs', label: 'прилить 0,1 М Na₂CO₃', unit: 'мл',
            min: 0, max: 40, step: 0.5, value: 11 },
          { kind: 'act', label: 'Прилить соду и перемешать', primary: true, act(st, v, ui) {
            if (!st.filtered) throw new Error('Сначала прокипятите пробу и слейте её с '
              + 'осадка: иначе сода уйдёт на карбонатную жёсткость, которую и так '
              + 'снимает кипячение.');
            if (!isFinite(v.vs) || v.vs <= 0) throw new Error('Введите объём раствора соды.');
            const need = VsodaNeed(st);
            if (v.vs > 2 * need) throw new Error('Доза завышена больше чем вдвое: по '
              + 'расчёту нужно ' + L.fmt(need, 2) + ' мл. Лишняя сода воду не умягчит — '
              + 'предел задан произведением растворимости CaCO₃, — зато поднимет '
              + 'щёлочность и солесодержание котловой воды.');
            st.Vsoda = v.vs;
            st.softened = true;
            const p = sodaPrecip(st);
            ui.say('Произведение концентраций [Ca²⁺]·[CO₃²⁻] = ' + sci(p.IP)
              + ' больше ПР(CaCO₃) = ' + sci(p.Ksp) + ' в ' + L.fmt(p.ratio, 0)
              + ' раз — выпадает осадок. Расчётная жёсткость после умягчения '
              + L.fmt(Hfinal(st), 3) + ' мэкв/л.',
            v.vs < 0.9 * need ? 'bad' : 'ok');
          } },
        ],
        done: (st) => st.softened,
        observe: (st) => ({
          what: 'Внесено ' + L.fmt(st.Vsoda, 2) + ' мл 0,1 М Na₂CO₃ — это '
            + L.fmt(doseObs(st), 3) + ' г соды на 1 л воды',
          obs: 'вода помутнела, выпал мелкий осадок CaCO₃: произведение '
            + 'концентраций превысило ПР в ' + L.fmt(sodaPrecip(st).ratio, 0)
            + ' раз; расчётная остаточная жёсткость ' + L.fmt(Hfinal(st), 3) + ' мэкв/л',
        }),
      },
      {
        name: 'Контрольное титрование умягчённой воды',
        hint: 'Результат умягчения проверяют тем же комплексонометрическим '
          + 'титрованием: 100 мл умягчённой воды, буфер, индикатор, трилон Б. '
          + 'Отсчёт теперь измеряется каплями — это и есть признак мягкой воды. '
          + 'Полного нуля не будет: над осадком CaCO₃ остаётся раствор, '
          + 'насыщенный по произведению растворимости.',
        controls: [
          { kind: 'act', label: 'Отобрать 100 мл, буфер и индикатор', act(st, v, ui) {
            if (!st.softened) throw new Error('Умягчение ещё не сделано — контролировать нечего.');
            st.stage = 3; st.ctrlReady = true;
            ui.say('В колбе 100 мл умягчённой воды, окраска винно-красная: '
              + 'остаточные ионы Ca²⁺ в растворе ещё есть.', 'ok');
          } },
          { kind: 'act', label: 'Прилить 0,05 мл (капля)', act(st, v, ui) { addT3(st, ui, 0.05); } },
          { kind: 'act', label: 'Прилить 0,5 мл', act(st, v, ui) { addT3(st, ui, 0.5); } },
          { kind: 'act', label: 'Записать отсчёт', primary: true, act(st, v, ui) {
            if (!st.ctrlReady) throw new Error('Сначала подготовьте пробу умягчённой воды.');
            if (st.Vt3 <= 0) throw new Error('Титрант ещё не прилит.');
            const e = ebt(st);
            if (!e.done) throw new Error('Окраска ещё ' + e.t
              + ' — прилейте ещё каплю трилона Б.');
            st.Vt3_read = st.Vt3;
            const H = HresObs(st);
            ui.say('Отсчёт ' + L.fmt(st.Vt3_read, 2) + ' мл: остаточная жёсткость '
              + L.fmt(H, 2) + ' мэкв/л — вода ' + CC.hardnessGrade(H)
              + '. Предел реагентного умягчения по ПР(CaCO₃) — ' + L.fmt(FLOOR, 2)
              + ' мэкв/л, глубже умягчают ионитами и дистилляцией.', 'ok');
          } },
        ],
        done: (st) => st.Vt3_read > 0,
        observe: (st) => ({
          what: 'Контрольное титрование 100 мл умягчённой воды, отсчёт '
            + L.fmt(st.Vt3_read, 2) + ' мл',
          obs: 'остаточная жёсткость ' + L.fmt(HresObs(st), 2) + ' мэкв/л, вода '
            + CC.hardnessGrade(HresObs(st)) + '; ниже ' + L.fmt(FLOOR, 2)
            + ' мэкв/л реагентным методом не опуститься',
        }),
      },
    ],

    /* --------------------------------------------------------- журнал */
    journal: [
      { id: 'ho', label: 'Общая жёсткость воды', unit: 'мэкв/л', tol: 2,
        hint: 'Ж = C(трилона)·V(трилона)·2·1000/V(пробы)',
        truth: (st) => Hobs(st) },
      { id: 'hk', label: 'Карбонатная жёсткость', unit: 'мэкв/л', tol: 2,
        hint: 'Ж(карб) = C(HCl)·V(HCl)·1000/V(пробы)',
        truth: (st) => HcarbObs(st) },
      { id: 'hn', label: 'Некарбонатная жёсткость', unit: 'мэкв/л', tol: 3,
        hint: 'по разности: Ж(некарб) = Ж(общ) − Ж(карб)',
        truth: (st) => HncObs(st) },
      { id: 'ms', label: 'Доза соды на 1 л воды', unit: 'г', tol: 3,
        hint: 'm = Ж(некарб)·V·Э/1000, Э(Na₂CO₃) = 53 г/экв',
        truth: (st) => doseObs(st) },
      { id: 'hr', label: 'Остаточная жёсткость после умягчения', unit: 'мэкв/л', tol: 5,
        hint: 'по отсчёту контрольного титрования',
        truth: (st) => HresObs(st) },
    ],
  });

  /* ================= вспомогательные действия ================= */

  /* Прилить трилон Б в первую пробу. */
  function addT(st, ui, dV) {
    if (!st.indicator) throw new Error('Индикатор не внесён — перехода окраски вы не увидите.');
    if (st.Vt_read > 0) throw new Error('Отсчёт уже записан: титрование закончено.');
    if (st.Vt + dV > BURETTE) throw new Error('Бюретка вмещает 25 мл и уже пуста. '
      + 'Такой расход титранта означает ошибку: проверьте, ту ли жидкость вы титруете.');
    st.Vt = r2(st.Vt + dV);
    const e = ebt(st);
    ui.say('Прилито ' + L.fmt(st.Vt, 2) + ' мл, окраска ' + e.t
      + (e.done ? ' — переход достигнут, записывайте отсчёт.' : '.'), e.done ? 'ok' : '');
  }

  /* Прилить соляную кислоту во вторую пробу. */
  function addH(st, ui, dV) {
    if (!st.sample2) throw new Error('Сначала возьмите новую пробу с метилоранжем.');
    if (st.Vhcl_read > 0) throw new Error('Отсчёт уже записан: титрование закончено.');
    if (st.Vhcl + dV > BURETTE) throw new Error('Бюретка вмещает 25 мл и уже пуста.');
    st.Vhcl = r2(st.Vhcl + dV);
    const m = moColor(st);
    ui.say('Прилито ' + L.fmt(st.Vhcl, 2) + ' мл, pH = ' + L.fmt(pHhcl(st), 2)
      + ', метилоранж ' + m.t + (m.zone === 'base' ? '.' : ' — конец титрования.'),
    m.zone === 'base' ? '' : 'ok');
  }

  /* Прилить трилон Б в пробу умягчённой воды. */
  function addT3(st, ui, dV) {
    if (!st.ctrlReady) throw new Error('Проба умягчённой воды не подготовлена.');
    if (st.Vt3_read > 0) throw new Error('Отсчёт уже записан: титрование закончено.');
    if (st.Vt3 + dV > BURETTE) throw new Error('Бюретка вмещает 25 мл и уже пуста.');
    st.Vt3 = r2(st.Vt3 + dV);
    const e = ebt(st);
    ui.say('Прилито ' + L.fmt(st.Vt3, 2) + ' мл, окраска ' + e.t
      + (e.done ? ' — переход достигнут.' : '.'), e.done ? 'ok' : '');
  }
})();
