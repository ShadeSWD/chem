/* calc.js — живые расчёты курса «Химия».
 *
 * Три независимых калькулятора; каждый монтируется, только если на странице
 * есть контейнер с соответствующим id:
 *   #calc-solution     — концентрации раствора и водородный показатель pH;
 *   #calc-nernst       — ЭДС гальванического элемента по уравнению Нернста;
 *   #calc-electrolysis — масса (объём) продукта электролиза по закону Фарадея.
 *
 * Числа выводятся с десятичной запятой, как принято в русской технической
 * литературе. Никаких внешних зависимостей. */
'use strict';
(function () {
  const F = 96485;          // постоянная Фарадея, Кл/моль
  const R = 8.314;          // универсальная газовая постоянная, Дж/(моль·К)
  const VM = 22.4;          // молярный объём газа при н. у., л/моль
  const KW = 1e-14;         // ионное произведение воды при 25 °C

  const $ = (id) => document.getElementById(id);

  /* форматирование: значащие цифры, запятая как разделитель,
     типографский минус U+2212 вместо дефиса */
  const MINUS = (s) => String(s).replace(/-/g, '−');
  function fmt(x, sig) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const a = Math.abs(x);
    let s;
    if (a >= 1e5 || a < 1e-4) {
      s = x.toExponential(sig === undefined ? 2 : sig - 1);
      const m = s.split('e');
      return MINUS(m[0].replace('.', ',') + '·10^' + Number(m[1]));
    }
    const digits = Math.max(0, (sig === undefined ? 4 : sig)
      - 1 - Math.floor(Math.log10(a)));
    s = x.toFixed(Math.min(10, digits));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return MINUS(s.replace('.', ','));
  }
  /* показатель степени в виде надстрочного индекса */
  function sup(s) { return String(s).replace(/\^([−-]?\d+)/g, '<sup>$1</sup>'); }
  const num = (el) => parseFloat(String(el.value).replace(',', '.'));

  function bind(container, handler) {
    const inputs = container.querySelectorAll('input, select');
    inputs.forEach((el) => {
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    handler();
  }

  /* ================= 1. Концентрации раствора и pH ================= */
  /* тип: sa — сильная кислота, sb — сильное основание,
     wa — слабая кислота, wb — слабое основание, n — неэлектролит/нейтральная соль */
  const SUBSTANCES = [
    { id: 'HCl', name: 'HCl — хлороводород', M: 36.5, type: 'sa', z: 1 },
    { id: 'HNO3', name: 'HNO₃ — азотная кислота', M: 63, type: 'sa', z: 1 },
    { id: 'H2SO4', name: 'H₂SO₄ — серная кислота', M: 98, type: 'sa', z: 2 },
    { id: 'NaOH', name: 'NaOH — гидроксид натрия', M: 40, type: 'sb', z: 1 },
    { id: 'KOH', name: 'KOH — гидроксид калия', M: 56, type: 'sb', z: 1 },
    { id: 'Ba(OH)2', name: 'Ba(OH)₂ — гидроксид бария', M: 171, type: 'sb', z: 2 },
    { id: 'CH3COOH', name: 'CH₃COOH — уксусная кислота', M: 60, type: 'wa', z: 1, K: 1.74e-5 },
    { id: 'NH3H2O', name: 'NH₃·H₂O — водный аммиак', M: 35, type: 'wb', z: 1, K: 1.76e-5 },
    { id: 'NaCl', name: 'NaCl — хлорид натрия', M: 58.5, type: 'n', z: 1 },
    { id: 'C12H22O11', name: 'C₁₂H₂₂O₁₁ — сахароза', M: 342, type: 'n', z: 1 },
  ];

  function mountSolution(box) {
    box.innerHTML = `
      <h3>Концентрации раствора и pH</h3>
      <p class="small">Задайте навеску, объём раствора и его плотность — калькулятор
      пересчитает количество вещества, молярную концентрацию, массовую долю и
      водородный показатель. Расчёт pH ведётся при 25 °C
      (K<sub>w</sub> = 10<sup>−14</sup>).</p>
      <div class="row">
        <label>Вещество
          <select id="cs-sub">${SUBSTANCES.map((s, i) =>
            `<option value="${i}">${s.name}</option>`).join('')}</select></label>
        <label>Масса навески <i>m</i>, г
          <input type="text" inputmode="decimal" id="cs-m" value="3,65"></label>
      </div>
      <div class="row">
        <label>Объём раствора <i>V</i>, л
          <input type="text" inputmode="decimal" id="cs-v" value="1"></label>
        <label>Плотность раствора ρ, г/мл
          <input type="text" inputmode="decimal" id="cs-rho" value="1"></label>
      </div>
      <div class="out" id="cs-out"></div>`;
    const out = $('cs-out');
    bind(box, function () {
      const s = SUBSTANCES[+$('cs-sub').value];
      const m = num($('cs-m')), V = num($('cs-v')), rho = num($('cs-rho'));
      if (!(m > 0) || !(V > 0) || !(rho > 0)) {
        out.innerHTML = '<div class="line warnline">Масса, объём и плотность '
          + 'должны быть положительными числами.</div>';
        return;
      }
      const n = m / s.M;                    // моль
      const C = n / V;                      // моль/л
      const mSol = V * 1000 * rho;          // г
      const w = 100 * m / mSol;             // %
      let h, oh, note;
      if (s.type === 'sa') {
        h = C * s.z;
        note = s.z > 1
          ? 'сильная кислота диссоциирует нацело, каждая молекула даёт ' + s.z + ' иона H⁺'
          : 'сильная кислота диссоциирует нацело: [H⁺] = C';
      } else if (s.type === 'sb') {
        oh = C * s.z; h = KW / oh;
        note = s.z > 1
          ? 'сильное основание даёт ' + s.z + ' иона OH⁻ на формульную единицу'
          : 'сильное основание диссоциирует нацело: [OH⁻] = C';
      } else if (s.type === 'wa') {
        h = Math.sqrt(s.K * C);
        note = 'слабая кислота: [H⁺] ≈ √(K<sub>д</sub>·C), K<sub>д</sub> = '
          + sup(fmt(s.K, 3)) + '; степень диссоциации α ≈ ' + fmt(h / C, 3);
      } else if (s.type === 'wb') {
        oh = Math.sqrt(s.K * C); h = KW / oh;
        note = 'слабое основание: [OH⁻] ≈ √(K<sub>д</sub>·C), K<sub>д</sub> = '
          + sup(fmt(s.K, 3)) + '; степень диссоциации α ≈ ' + fmt(oh / C, 3);
      } else {
        h = 1e-7; note = 'неэлектролит (или соль сильного основания и сильной '
          + 'кислоты) — среда нейтральная, гидролиза нет';
      }
      if (oh === undefined) oh = KW / h;
      const pH = -Math.log10(h);
      const env = pH < 6.99 ? 'кислая' : (pH > 7.01 ? 'щелочная' : 'нейтральная');
      out.innerHTML = `
        <div class="line"><i>n</i> = <i>m</i>/<i>M</i> =
          <span class="subst">${fmt(m, 4)} / ${fmt(s.M, 4)}</span> =
          <b>${fmt(n, 4)} моль</b></div>
        <div class="line"><i>C</i> = <i>n</i>/<i>V</i> =
          <span class="subst">${fmt(n, 4)} / ${fmt(V, 4)}</span> =
          <b>${fmt(C, 4)} моль/л</b></div>
        <div class="line"><i>m</i>(р-ра) = <i>V</i>·ρ =
          <span class="subst">${fmt(V * 1000, 5)} · ${fmt(rho, 4)}</span> =
          ${fmt(mSol, 5)} г, откуда ω =
          <b>${fmt(w, 3)} %</b></div>
        <div class="line">[H⁺] = <b>${sup(fmt(h, 3))} моль/л</b>,
          [OH⁻] = ${sup(fmt(oh, 3))} моль/л</div>
        <div class="line">pH = −lg[H⁺] = <b>${fmt(pH, 3)}</b> — среда <b>${env}</b></div>
        <div class="line small">${note}</div>`;
    });
  }

  /* ================= 2. ЭДС по уравнению Нернста ================= */
  const ELECTRODES = [
    { id: 'Li', name: 'Li⁺/Li', phi: -3.04, n: 1 },
    { id: 'Mg', name: 'Mg²⁺/Mg', phi: -2.36, n: 2 },
    { id: 'Al', name: 'Al³⁺/Al', phi: -1.66, n: 3 },
    { id: 'Zn', name: 'Zn²⁺/Zn', phi: -0.76, n: 2 },
    { id: 'Fe', name: 'Fe²⁺/Fe', phi: -0.44, n: 2 },
    { id: 'Ni', name: 'Ni²⁺/Ni', phi: -0.25, n: 2 },
    { id: 'Sn', name: 'Sn²⁺/Sn', phi: -0.14, n: 2 },
    { id: 'Pb', name: 'Pb²⁺/Pb', phi: -0.13, n: 2 },
    { id: 'H', name: '2H⁺/H₂', phi: 0.00, n: 2 },
    { id: 'Cu', name: 'Cu²⁺/Cu', phi: 0.34, n: 2 },
    { id: 'Ag', name: 'Ag⁺/Ag', phi: 0.80, n: 1 },
  ];
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  function mountNernst(box) {
    const opts = (sel) => ELECTRODES.map((e, i) =>
      `<option value="${i}"${i === sel ? ' selected' : ''}>${e.name} (φ° = ${
        MINUS(e.phi.toFixed(2).replace('.', ','))} В)</option>`).join('');
    box.innerHTML = `
      <h3>ЭДС гальванического элемента (уравнение Нернста)</h3>
      <p class="small">Выберите два электрода и концентрации ионов в полуэлементах.
      Анодом становится электрод с меньшим потенциалом — калькулятор определяет
      это сам, поэтому ЭДС всегда получается положительной.</p>
      <div class="row">
        <label>Первый электрод <select id="cn-a">${opts(3)}</select></label>
        <label>C(ион), моль/л <input type="text" inputmode="decimal" id="cn-ca" value="0,01"></label>
      </div>
      <div class="row">
        <label>Второй электрод <select id="cn-b">${opts(9)}</select></label>
        <label>C(ион), моль/л <input type="text" inputmode="decimal" id="cn-cb" value="1"></label>
      </div>
      <div class="row">
        <label>Температура <i>t</i>, °C <input type="text" inputmode="decimal" id="cn-t" value="25"></label>
      </div>
      <div class="out" id="cn-out"></div>`;
    const out = $('cn-out');
    bind(box, function () {
      const A = ELECTRODES[+$('cn-a').value], B = ELECTRODES[+$('cn-b').value];
      const cA = num($('cn-ca')), cB = num($('cn-cb')), t = num($('cn-t'));
      if (!(cA > 0) || !(cB > 0) || !isFinite(t) || t <= -273) {
        out.innerHTML = '<div class="line warnline">Концентрации должны быть '
          + 'положительными, температура — выше абсолютного нуля.</div>';
        return;
      }
      if (A.id === B.id) {
        out.innerHTML = '<div class="line warnline">Выберите два разных электрода: '
          + 'у концентрационного элемента из одинаковых металлов ЭДС определяется '
          + 'только отношением концентраций.</div>';
        return;
      }
      const T = t + 273.15;
      const k = 2.303 * R * T / F;            // предлогарифмический множитель, В
      const phi = (e, c) => e.phi + (k / e.n) * Math.log10(c);
      const pA = phi(A, cA), pB = phi(B, cB);
      const an = pA <= pB ? A : B, ca = pA <= pB ? B : A;
      const pAn = Math.min(pA, pB), pCa = Math.max(pA, pB);
      const cAn = pA <= pB ? cA : cB, cCa = pA <= pB ? cB : cA;
      const E = pCa - pAn;
      const z = an.n * ca.n / gcd(an.n, ca.n);   // электронов в суммарной реакции
      const dG = -z * F * E / 1000;              // кДж
      out.innerHTML = `
        <div class="line">Множитель <i>2,303RT/F</i> =
          <span class="subst">2,303 · ${fmt(R, 4)} · ${fmt(T, 5)} / ${F}</span> =
          <b>${fmt(k, 4)} В</b>${Math.abs(t - 25) < 0.6
            ? ' (при 25 °C это привычные 0,059 В)' : ''}</div>
        <div class="line">Анод (окисление, «−»): <b>${an.name}</b>,
          φ = φ° + (${fmt(k, 3)}/<i>n</i>)·lg C =
          <span class="subst">${fmt(an.phi, 3)} + (${fmt(k, 3)}/${an.n})·lg ${fmt(cAn, 4)}</span> =
          <b>${fmt(pAn, 4)} В</b></div>
        <div class="line">Катод (восстановление, «+»): <b>${ca.name}</b>,
          φ = <span class="subst">${fmt(ca.phi, 3)} + (${fmt(k, 3)}/${ca.n})·lg ${fmt(cCa, 4)}</span> =
          <b>${fmt(pCa, 4)} В</b></div>
        <div class="line">ЭДС = φ<sub>катода</sub> − φ<sub>анода</sub> =
          <span class="subst">${fmt(pCa, 4)} − (${fmt(pAn, 4)})</span> =
          <b>${fmt(E, 4)} В</b></div>
        <div class="line">Δ<i>G</i> = −<i>zFE</i> =
          <span class="subst">−${z} · ${F} · ${fmt(E, 4)}</span> =
          <b>${fmt(dG, 4)} кДж</b> — реакция самопроизвольна
          (<i>z</i> = ${z} — электронов в суммарном уравнении)</div>
        <div class="line small">Схема элемента:
          (−) ${an.name.split('/')[1]} | ${an.name.split('/')[0]} ‖
          ${ca.name.split('/')[0]} | ${ca.name.split('/')[1]} (+);
          электроны идут по внешней цепи от анода к катоду,
          технический ток — навстречу им.</div>`;
    });
  }

  /* ================= 3. Электролиз, закон Фарадея ================= */
  const PRODUCTS = [
    { id: 'Cu', name: 'Cu — медь на катоде', M: 63.5, z: 2, gas: false },
    { id: 'Ni', name: 'Ni — никель на катоде', M: 59, z: 2, gas: false },
    { id: 'Zn', name: 'Zn — цинк на катоде', M: 65, z: 2, gas: false },
    { id: 'Ag', name: 'Ag — серебро на катоде', M: 108, z: 1, gas: false },
    { id: 'Al', name: 'Al — алюминий из расплава', M: 27, z: 3, gas: false },
    { id: 'Cr', name: 'Cr — хром (хромирование)', M: 52, z: 6, gas: false },
    { id: 'H2', name: 'H₂ — водород на катоде', M: 2, z: 2, gas: true },
    { id: 'O2', name: 'O₂ — кислород на аноде', M: 32, z: 4, gas: true },
    { id: 'Cl2', name: 'Cl₂ — хлор на аноде', M: 71, z: 2, gas: true },
  ];

  function mountElectrolysis(box) {
    box.innerHTML = `
      <h3>Электролиз: масса продукта по закону Фарадея</h3>
      <p class="small">Объединённый закон Фарадея: <i>m</i> = <i>M</i>·<i>I</i>·<i>t</i>/(<i>zF</i>).
      Выход по току учитывает долю заряда, потраченную на побочные процессы
      (у промышленных ванн 85–98 %). Для газов дополнительно считается объём
      при нормальных условиях.</p>
      <div class="row">
        <label>Продукт <select id="ce-p">${PRODUCTS.map((p, i) =>
          `<option value="${i}"${i === 0 ? ' selected' : ''}>${p.name}</option>`).join('')}</select></label>
        <label>Сила тока <i>I</i>, А <input type="text" inputmode="decimal" id="ce-i" value="5"></label>
      </div>
      <div class="row">
        <label>Время <input type="text" inputmode="decimal" id="ce-t" value="2">
          <select id="ce-tu">
            <option value="3600" selected>ч</option>
            <option value="60">мин</option>
            <option value="1">с</option>
          </select></label>
        <label>Выход по току η, % <input type="text" inputmode="decimal" id="ce-eta" value="100"></label>
      </div>
      <div class="out" id="ce-out"></div>`;
    const out = $('ce-out');
    bind(box, function () {
      const p = PRODUCTS[+$('ce-p').value];
      const I = num($('ce-i')), tv = num($('ce-t'));
      const tu = +$('ce-tu').value, eta = num($('ce-eta'));
      if (!(I > 0) || !(tv > 0) || !(eta > 0) || eta > 100) {
        out.innerHTML = '<div class="line warnline">Ток и время должны быть '
          + 'положительными, выход по току — от 0 до 100 %.</div>';
        return;
      }
      const t = tv * tu;                       // с
      const Q = I * t;                         // Кл
      const nE = Q / F;                        // моль электронов
      const nP = nE / p.z * (eta / 100);       // моль продукта
      const m = nP * p.M;                      // г
      const V = nP * VM;                       // л (для газов)
      out.innerHTML = `
        <div class="line"><i>Q</i> = <i>I</i>·<i>t</i> =
          <span class="subst">${fmt(I, 4)} · ${fmt(t, 6)}</span> =
          <b>${fmt(Q, 5)} Кл</b> (А·с = Кл)</div>
        <div class="line"><i>n</i>(e⁻) = <i>Q</i>/<i>F</i> =
          <span class="subst">${fmt(Q, 5)} / ${F}</span> =
          <b>${fmt(nE, 4)} моль</b></div>
        <div class="line"><i>n</i>(${p.id.replace(/(\d)/g, '<sub>$1</sub>')}) =
          η·<i>n</i>(e⁻)/<i>z</i> =
          <span class="subst">${fmt(eta / 100, 3)} · ${fmt(nE, 4)} / ${p.z}</span> =
          <b>${fmt(nP, 4)} моль</b></div>
        <div class="line"><i>m</i> = <i>n</i>·<i>M</i> =
          <span class="subst">${fmt(nP, 4)} · ${fmt(p.M, 4)}</span> =
          <b>${fmt(m, 4)} г</b>${m > 1000 ? ' = ' + fmt(m / 1000, 4) + ' кг' : ''}</div>
        ${p.gas ? `<div class="line"><i>V</i>(н. у.) = <i>n</i>·<i>V</i><sub>м</sub> =
          <span class="subst">${fmt(nP, 4)} · ${VM}</span> =
          <b>${fmt(V, 4)} л</b></div>` : ''}
        <div class="line small">Размерности: [А·с/(Кл/моль)] = моль — заряд делится
          на заряд моля электронов, число <i>z</i> берётся из электродной
          полуреакции.</div>`;
    });
  }

  function boot() {
    const s = $('calc-solution'); if (s) mountSolution(s);
    const n = $('calc-nernst'); if (n) mountNernst(n);
    const e = $('calc-electrolysis'); if (e) mountElectrolysis(e);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
