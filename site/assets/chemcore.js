/* chemcore.js — расчётное ядро виртуальной лаборатории.
 *
 * Здесь нет ни одного обращения к DOM: модуль считает химию и ничего больше.
 * Поэтому его можно (и нужно) прогонять в node из тестов — так проверяется,
 * что наблюдаемый на стенде результат действительно посчитан, а не назначен
 * вручную под красивую картинку.
 *
 * Формулы взяты те же, что в главах теории сайта, чтобы практикум и теория
 * не расходились:
 *   pH = −lg[H⁺], Kw = 10⁻¹⁴                        (глава 5, лекция 11)
 *   сильный электролит: [H⁺] = n·C                  (глава 5)
 *   слабый электролит: Kд ≈ Cα², [H⁺] = √(Kд·C)     (глава 5, закон Оствальда)
 *   гидролиз соли слабой кислоты: pH = 7 + ½(pKa + lg C)
 *   осадок выпадает, если ∏[ион]^ν > ПР             (глава 5, лекция 12)
 *   Vгаза = n · 22,4 л/моль при н.у.                (глава 1, лекция 1)
 *   m = M·I·t/(n·F), F = 96485 Кл/моль              (глава 7)
 *   жёсткость в мэкв/л; 1 мэкв Ca²⁺ = 20 мг, Mg²⁺ = 12 мг  (лекция 13)
 *   правило Вант-Гоффа: v₂/v₁ = γ^((T₂−T₁)/10)      (глава 4, лекция 8)
 *
 * Атомные массы округлены до целых (для хлора 35,5) — так, как требует
 * методичка кафедры: иначе разобранные задачи сайта не сойдутся с практикумом.
 */
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChemCore = api;
}(typeof self !== 'undefined' ? self : this, function () {

  /* ================= атомные массы и молярная масса ================= */

  /* Округление до целого — соглашение курса; хлор 35,5 — оговорённое
     методичкой исключение. Список закрыт теми элементами, которые реально
     встречаются в работах практикума.
     Оговорка о меди: здесь 64, потому что по этому округлению сходятся
     разобранные задачи на концентрации (M(CuSO4) = 160 г/моль, навеска 8 г
     на 0,5 л 0,1 М раствора). В расчётах по закону Фарадея глава 7 и
     калькулятор электролиза берут точное 63,5 — там разница в 0,8 % уже
     заметна. Поэтому faradayMass принимает M аргументом: работа подставляет
     то значение, которое принято в её разделе, а ядро ничего не навязывает. */
  const A = {
    H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20,
    Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40,
    K: 39, Ca: 40, Sc: 45, Ti: 48, V: 51, Cr: 52, Mn: 55, Fe: 56, Co: 59,
    Ni: 59, Cu: 64, Zn: 65, Ga: 70, Ge: 73, As: 75, Se: 79, Br: 80,
    Rb: 85, Sr: 88, Y: 89, Zr: 91, Nb: 93, Mo: 96, Ag: 108, Cd: 112,
    Sn: 119, Sb: 122, Te: 128, I: 127, Ba: 137, W: 184, Pt: 195, Au: 197,
    Hg: 201, Pb: 207, Bi: 209,
  };

  /* Разбор формулы со скобками и кристаллогидратами:
     'CuSO4*5H2O', 'Ca(OH)2', 'Al2(SO4)3'. Точку кристаллогидрата пишем '*'
     или '·' — обе формы принимаются. */
  function parseFormula(f) {
    const counts = {};
    String(f).split(/[*·]/).forEach((part) => {
      const m = part.match(/^(\d+)/);           // множитель гидратной воды
      const mult = m ? parseInt(m[1], 10) : 1;
      const body = m ? part.slice(m[1].length) : part;
      const sub = parseGroup(body);
      for (const el in sub) counts[el] = (counts[el] || 0) + sub[el] * mult;
    });
    return counts;
  }

  function parseGroup(s) {
    const counts = {};
    let i = 0;
    const stack = [counts];
    while (i < s.length) {
      const ch = s[i];
      if (ch === '(' || ch === '[') { stack.push({}); i++; continue; }
      if (ch === ')' || ch === ']') {
        const grp = stack.pop();
        i++;
        const m = s.slice(i).match(/^\d+/);
        const n = m ? parseInt(m[0], 10) : 1;
        if (m) i += m[0].length;
        const top = stack[stack.length - 1];
        for (const el in grp) top[el] = (top[el] || 0) + grp[el] * n;
        continue;
      }
      const em = s.slice(i).match(/^[A-Z][a-z]?/);
      if (!em) { i++; continue; }
      const el = em[0];
      if (A[el] === undefined) throw new Error('нет атомной массы: ' + el);
      i += el.length;
      const nm = s.slice(i).match(/^\d+/);
      const n = nm ? parseInt(nm[0], 10) : 1;
      if (nm) i += nm[0].length;
      const top = stack[stack.length - 1];
      top[el] = (top[el] || 0) + n;
    }
    return counts;
  }

  function molarMass(f) {
    const c = parseFormula(f);
    let M = 0;
    for (const el in c) M += A[el] * c[el];
    return M;
  }

  /* ================= константы ================= */

  const KW = 1e-14;             // ионное произведение воды при 25 °C
  const VM = 22.4;              // молярный объём газа при н.у., л/моль
  const F_CONST = 96485;        // постоянная Фарадея, Кл/моль
  const R = 8.314;              // Дж/(моль·К)

  /* Константы диссоциации слабых электролитов (25 °C), справочные. */
  const KA = {
    CH3COOH: 1.8e-5,
    HCOOH: 1.8e-4,
    HF: 6.6e-4,
    HNO2: 4.0e-4,
    HCN: 6.2e-10,
    'H2CO3_1': 4.5e-7,
    'H2CO3_2': 4.8e-11,
    'H3PO4_1': 7.5e-3,
    'H2S_1': 1.0e-7,
  };
  const KB = { NH3: 1.8e-5 };

  /* Произведения растворимости (25 °C), справочные — те же числа, что в
     разобранных задачах сайта и в лекции 12. */
  const KSP = {
    AgCl: 1.8e-10,
    AgBr: 5.3e-13,
    AgI: 8.3e-17,
    Ag2CrO4: 1.1e-12,
    BaSO4: 1.1e-10,
    CaCO3: 5.0e-9,
    CaSO4: 1.3e-4,
    'Ca(OH)2': 5.5e-6,
    'Mg(OH)2': 6.0e-10,
    MgCO3: 2.1e-5,
    'Fe(OH)3': 3.8e-38,
    'Fe(OH)2': 8.0e-16,
    'Cu(OH)2': 2.2e-20,
    CuS: 6.3e-36,
    PbCl2: 1.6e-5,
    PbI2: 1.1e-9,
    PbSO4: 1.6e-8,
    'Zn(OH)2': 1.2e-17,
  };

  /* ================= pH ================= */

  const lg = (x) => Math.log(x) / Math.LN10;
  const clampPH = (p) => Math.min(14, Math.max(0, p));

  /* Сильная кислота: [H⁺] = n·C, где n — основность. */
  function pHStrongAcid(C, n) {
    const h = (n || 1) * C;
    if (h <= 0) return 7;
    return clampPH(-lg(h + KW / Math.max(h, 1e-12)));
  }

  /* Сильное основание: [OH⁻] = n·C, где n — кислотность. */
  function pHStrongBase(C, n) {
    const oh = (n || 1) * C;
    if (oh <= 0) return 7;
    return clampPH(14 + lg(oh));
  }

  /* Слабая одноосновная кислота. Курс даёт приближение [H⁺] = √(Kд·C);
     здесь решается точное квадратное уравнение x²/(C−x) = Ka, которое при
     концентрациях практикума совпадает с приближением в пределах 0,01 pH.
     Приближение доступно отдельно — им пользуются в ручном расчёте. */
  function pHWeakAcid(C, Ka) {
    if (C <= 0) return 7;
    const h = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * C)) / 2;
    return clampPH(-lg(h));
  }
  const pHWeakAcidApprox = (C, Ka) => clampPH(-lg(Math.sqrt(Ka * C)));

  function pHWeakBase(C, Kb) {
    if (C <= 0) return 7;
    const oh = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * C)) / 2;
    return clampPH(14 + lg(oh));
  }

  /* Буферная смесь слабая кислота / её соль — уравнение Гендерсона. */
  function pHBuffer(Cacid, Csalt, Ka) {
    if (Cacid <= 0) return pHWeakBase(Csalt, KW / Ka);
    if (Csalt <= 0) return pHWeakAcid(Cacid, Ka);
    return clampPH(-lg(Ka) + lg(Csalt / Cacid));
  }

  /* Гидролиз соли слабой кислоты и сильного основания (CH3COONa, Na2CO3):
     pH = 7 + ½(pKa + lg C). */
  function pHSaltWeakAcid(C, Ka) {
    if (C <= 0) return 7;
    return clampPH(7 + 0.5 * (-lg(Ka) + lg(C)));
  }
  /* Гидролиз соли слабого основания и сильной кислоты (NH4Cl, CuSO4). */
  function pHSaltWeakBase(C, Kb) {
    if (C <= 0) return 7;
    return clampPH(7 - 0.5 * (-lg(Kb) + lg(C)));
  }

  /* ================= индикаторы ================= */

  /* Интервалы перехода — справочные. Цвет возвращается и словом, и кодом,
     чтобы на схеме залить раствор ровно тем, что названо в подписи. */
  const INDICATORS = {
    litmus: {
      name: 'лакмус', lo: 5.0, hi: 8.0,
      acid: { t: 'красный', c: '#c0392b' },
      mid: { t: 'фиолетовый', c: '#7e3f9d' },
      base: { t: 'синий', c: '#2456a6' },
    },
    phenolphthalein: {
      name: 'фенолфталеин', lo: 8.2, hi: 10.0,
      acid: { t: 'бесцветный', c: '#eef4f7' },
      mid: { t: 'бледно-малиновый', c: '#e79bc0' },
      base: { t: 'малиновый', c: '#c2185b' },
    },
    methylOrange: {
      name: 'метилоранж', lo: 3.1, hi: 4.4,
      acid: { t: 'красный', c: '#d1462f' },
      mid: { t: 'оранжевый', c: '#e08a2e' },
      base: { t: 'жёлтый', c: '#e8c33a' },
    },
  };

  function indicatorColor(key, pH) {
    const ind = INDICATORS[key];
    if (!ind) throw new Error('нет индикатора: ' + key);
    if (pH <= ind.lo) return Object.assign({ zone: 'acid' }, ind.acid);
    if (pH >= ind.hi) return Object.assign({ zone: 'base' }, ind.base);
    return Object.assign({ zone: 'mid' }, ind.mid);
  }

  /* ================= осадки ================= */

  /* Выпадет ли осадок: сравниваем произведение концентраций ионов в степенях
     стехиометрических индексов с ПР. cations/anions — молярные концентрации
     ПОСЛЕ смешивания (при сливании равных объёмов они вдвое меньше исходных —
     это делает mixEqual). */
  function willPrecipitate(salt, cCation, cAnion, nCation, nAnion) {
    const Ksp = KSP[salt];
    if (Ksp === undefined) throw new Error('нет ПР: ' + salt);
    const IP = Math.pow(cCation, nCation || 1) * Math.pow(cAnion, nAnion || 1);
    return { Ksp, IP, precipitates: IP > Ksp, ratio: IP / Ksp };
  }

  /* Слияние двух растворов: концентрации падают пропорционально объёмам. */
  function mix(c1, v1, c2, v2) {
    return { c1: c1 * v1 / (v1 + v2), c2: c2 * v2 / (v1 + v2), V: v1 + v2 };
  }

  /* Растворимость бинарной соли типа AB из ПР: s = √ПР (моль/л). */
  function solubility(salt, nCation, nAnion) {
    const Ksp = KSP[salt];
    if (Ksp === undefined) throw new Error('нет ПР: ' + salt);
    const a = nCation || 1, b = nAnion || 1;
    return Math.pow(Ksp / (Math.pow(a, a) * Math.pow(b, b)), 1 / (a + b));
  }

  /* ================= растворы ================= */

  /* Навеска для приготовления V литров раствора концентрации C моль/л. */
  const massForMolar = (C, V, M) => C * V * M;
  /* Молярная концентрация по навеске. */
  const molarFromMass = (m, M, V) => m / (M * V);
  /* Массовая доля, %. */
  const massFraction = (mSolute, mSolution) => mSolute / mSolution * 100;
  /* Пересчёт массовой доли в молярную концентрацию через плотность (г/мл). */
  const molarFromFraction = (w, rho, M) => w * rho * 10 / M;
  /* Разбавление: C1V1 = C2V2. */
  const dilute = (C1, V1, C2) => C1 * V1 / C2;

  /* Навеска кристаллогидрата на ту же безводную соль. */
  function massHydrate(C, V, anhydrous, hydrate) {
    const Ma = molarMass(anhydrous), Mh = molarMass(hydrate);
    return { Ma, Mh, m: C * V * Mh, mAnhydrous: C * V * Ma };
  }

  /* ================= титрование ================= */

  /* Точка эквивалентности: C(кислоты)·V(кислоты)·n(кислоты) =
     C(щёлочи)·V(щёлочи)·n(щёлочи). Объёмы — в мл, результат в мл. */
  function equivalenceVolume(Ca, Va, na, Cb, nb) {
    return Ca * Va * (na || 1) / (Cb * (nb || 1));
  }

  /* Кривая титрования: в колбе Va мл кислоты концентрации Ca, из бюретки
     прилито Vb мл щёлочи концентрации Cb. Ka = null — сильная кислота.
     Возвращает pH. Разбавление учитывается. */
  function titrationPH(Va, Ca, Vb, Cb, Ka) {
    const V = Va + Vb;                        // мл
    const nA = Ca * Va / 1000;                // моль кислоты
    const nB = Cb * Vb / 1000;                // моль щёлочи
    const diff = nA - nB;                     // >0 — кислота в избытке
    if (!Ka) {
      /* сильная кислота + сильное основание */
      if (Math.abs(diff) < 1e-12) return 7;
      if (diff > 0) return pHStrongAcid(diff / (V / 1000), 1);
      return pHStrongBase(-diff / (V / 1000), 1);
    }
    /* слабая кислота + сильное основание */
    if (nB <= 0) return pHWeakAcid(nA / (V / 1000), Ka);
    if (diff > 1e-12) return pHBuffer(diff / (V / 1000), nB / (V / 1000), Ka);
    if (Math.abs(diff) < 1e-12) return pHSaltWeakAcid(nA / (V / 1000), Ka);
    return pHStrongBase(-diff / (V / 1000), 1);
  }

  function titrationCurve(Va, Ca, Cb, Ka, VbMax, step) {
    const pts = [];
    const h = step || 0.25;
    for (let Vb = 0; Vb <= VbMax + 1e-9; Vb += h) {
      pts.push({ V: +Vb.toFixed(4), pH: titrationPH(Va, Ca, Vb, Cb, Ka) });
    }
    return pts;
  }

  /* Скачок титрования: интервал pH между 99 % и 101 % от точки
     эквивалентности — по нему выбирают индикатор. */
  function titrationJump(Va, Ca, Cb, Ka) {
    const Veq = equivalenceVolume(Ca, Va, 1, Cb, 1);
    return {
      Veq,
      pH99: titrationPH(Va, Ca, Veq * 0.99, Cb, Ka),
      pHeq: titrationPH(Va, Ca, Veq, Cb, Ka),
      pH101: titrationPH(Va, Ca, Veq * 1.01, Cb, Ka),
    };
  }

  /* Концентрация, найденная титрованием (то, ради чего оно делается). */
  const concFromTitration = (Cb, Vb, nb, Va, na) =>
    Cb * Vb * (nb || 1) / (Va * (na || 1));

  /* ================= газы ================= */

  /* Объём газа при н.у. по количеству вещества. */
  const gasVolume = (n) => n * VM;
  /* Объём газа по массе исходного вещества и стехиометрии. */
  function gasFromMass(m, M, coefSubstance, coefGas) {
    const n = m / M;
    return { n, nGas: n * coefGas / coefSubstance, V: n * coefGas / coefSubstance * VM };
  }
  /* Приведение объёма к другим условиям (объединённый газовый закон). */
  const gasAtConditions = (V0, T, p) => V0 * (T / 273) * (101325 / p);

  /* ================= термохимия ================= */

  /* Тепловой эффект по следствию из закона Гесса. */
  function heatOfReaction(products, reactants) {
    const s = (arr) => arr.reduce((a, x) => a + x.n * x.dH, 0);
    return s(products) - s(reactants);
  }
  /* Нагрев раствора выделившейся теплотой: Δt = Q/(c·m). */
  const tempRise = (Q, m, c) => Q * 1000 / ((c || 4.18) * m);

  /* ================= кинетика ================= */

  /* Правило Вант-Гоффа. */
  const vantHoff = (gamma, dT) => Math.pow(gamma, dT / 10);
  /* Время реакции при изменении температуры. */
  const timeVantHoff = (t1, gamma, dT) => t1 / vantHoff(gamma, dT);
  /* Уравнение Аррениуса: отношение констант при двух температурах. */
  const arrhenius = (Ea, T1, T2) =>
    Math.exp(Ea * 1000 / R * (1 / T1 - 1 / T2));
  /* Закон действующих масс для v = k·∏C^ν. */
  const rateLaw = (k, terms) =>
    terms.reduce((a, t) => a * Math.pow(t.C, t.order), k);

  /* ================= электрохимия ================= */

  /* Масса вещества на электроде по закону Фарадея. */
  const faradayMass = (M, I, t, n) => M * I * t / (n * F_CONST);
  /* Объём газа на электроде (н.у.). */
  const faradayVolume = (I, t, n) => VM * I * t / (n * F_CONST);
  /* Выход по току. */
  const currentYield = (mReal, mTheor) => mReal / mTheor * 100;

  /* Стандартные электродные потенциалы, В (ряд напряжений). */
  const E0 = {
    'Li+/Li': -3.05, 'K+/K': -2.92, 'Ca2+/Ca': -2.87, 'Na+/Na': -2.71,
    'Mg2+/Mg': -2.36, 'Al3+/Al': -1.66, 'Mn2+/Mn': -1.18, 'Zn2+/Zn': -0.76,
    'Cr3+/Cr': -0.74, 'Fe2+/Fe': -0.44, 'Cd2+/Cd': -0.40, 'Ni2+/Ni': -0.25,
    'Sn2+/Sn': -0.14, 'Pb2+/Pb': -0.13, '2H+/H2': 0.00, 'Cu2+/Cu': 0.34,
    'Ag+/Ag': 0.80, 'Hg2+/Hg': 0.85, 'Au3+/Au': 1.50,
  };

  /* Уравнение Нернста при 25 °C: φ = φ° + (0,059/n)·lg C. */
  const nernst = (phi0, n, C) => phi0 + (0.059 / n) * lg(C);
  /* ЭДС гальванического элемента. */
  const emf = (phiCathode, phiAnode) => phiCathode - phiAnode;

  /* ================= жёсткость воды ================= */

  /* Жёсткость по массовым концентрациям ионов, мг/л → мэкв/л.
     1 мэкв Ca²⁺ = 20 мг, 1 мэкв Mg²⁺ = 12 мг (лекция 13). */
  const hardnessFromMass = (mgCa, mgMg) => (mgCa || 0) / 20 + (mgMg || 0) / 12;
  /* Жёсткость по молярным концентрациям (моль/л) — оба иона двухзарядные. */
  const hardnessFromMolar = (cCa, cMg) => ((cCa || 0) + (cMg || 0)) * 2 * 1000;
  /* Жёсткость по результату титрования трилоном Б (комплексонометрия):
     Ж = C(трилона)·V(трилона)·1000/V(пробы), мэкв/л. */
  const hardnessFromTitration = (Ct, Vt, Vsample) => Ct * Vt * 2 * 1000 / Vsample;

  function hardnessGrade(H) {
    if (H < 4) return 'мягкая';
    if (H < 8) return 'средней жёсткости';
    if (H < 12) return 'жёсткая';
    return 'очень жёсткая';
  }

  /* Расход реагента на умягчение: на 1 мэкв жёсткости нужен 1 мэкв реагента. */
  function softeningDose(H, V, Meq) {
    return H * V * Meq / 1000;      // г реагента на V литров
  }

  /* ================= служебное ================= */

  /* Округление до значащих цифр — стенд не должен показывать 13 знаков. */
  function sig(x, n) {
    if (x === 0 || !isFinite(x)) return 0;
    const d = Math.ceil(lg(Math.abs(x)));
    const p = (n || 3) - d;
    const f = Math.pow(10, p);
    return Math.round(x * f) / f;
  }

  /* Относительная погрешность измерения студента, %. */
  const relError = (measured, real) =>
    real === 0 ? NaN : Math.abs(measured - real) / Math.abs(real) * 100;

  return {
    A, KW, VM, F: F_CONST, R, KA, KB, KSP, E0, INDICATORS,
    parseFormula, molarMass, lg,
    pHStrongAcid, pHStrongBase, pHWeakAcid, pHWeakAcidApprox, pHWeakBase,
    pHBuffer, pHSaltWeakAcid, pHSaltWeakBase, indicatorColor,
    willPrecipitate, mix, solubility,
    massForMolar, molarFromMass, massFraction, molarFromFraction, dilute,
    massHydrate,
    equivalenceVolume, titrationPH, titrationCurve, titrationJump,
    concFromTitration,
    gasVolume, gasFromMass, gasAtConditions,
    heatOfReaction, tempRise,
    vantHoff, timeVantHoff, arrhenius, rateLaw,
    faradayMass, faradayVolume, currentYield, nernst, emf,
    hardnessFromMass, hardnessFromMolar, hardnessFromTitration,
    hardnessGrade, softeningDose,
    sig, relError,
  };
}));
