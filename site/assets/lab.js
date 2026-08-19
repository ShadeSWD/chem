/* lab.js — стенд виртуальной лаборатории: шаги, действия, журнал.
 *
 * Стенд не «показывает мультик»: пока студент не выполнил действие текущего
 * шага, следующий шаг закрыт. Наблюдаемый результат (цвет, pH, осадок, газ,
 * объём) стенд не назначает, а СЧИТАЕТ — функциями chemcore.js, теми же, что
 * в главах теории. Поэтому и в журнале можно честно сравнивать введённое
 * студентом число с истинным.
 *
 * Разметка страницы:
 *   <div class="lab" data-lab="solution"></div>
 *   <script src="assets/chemcore.js"></script>
 *   <script src="assets/labware.js"></script>
 *   <script src="assets/lab.js"></script>
 *   <script src="assets/lab-solution.js"></script>
 *
 * Определение работы (в отдельном файле lab-<имя>.js):
 *   Lab.define('solution', {
 *     scene: { w: 640, h: 320 },
 *     init()            — начальное состояние (обычный объект);
 *     draw(st, t)       — разметка сцены; t ∈ [0,1) — фаза анимации;
 *     steps: [{ name, hint, controls, done(st), observe(st) }],
 *     journal: [{ id, label, unit, truth(st), tol, hint }],
 *   });
 *
 * Управление (controls) — декларативное:
 *   { kind:'button', label, act(st, ui) }
 *   { kind:'number', id, label, unit, min, max, step, value }
 *   { kind:'select', id, label, options:[{v,t}] }
 *   { kind:'act',    label, need:['id'], act(st, vals, ui) }
 * Значения number/select лежат в ui.vals и доступны действию.
 */
'use strict';
(function (global) {
  const Lab = global.Lab || (global.Lab = {});
  const REG = Lab.REG || (Lab.REG = {});
  const CC = global.ChemCore;
  const W = global.Labware;

  Lab.define = function (name, def) { REG[name] = def; };

  /* Форматирование чисел по-русски: запятая, разумная точность. */
  function fmt(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    const s = (d === undefined ? CC.sig(x, 3) : +x.toFixed(d));
    return String(s).replace('.', ',');
  }
  Lab.fmt = fmt;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ------------------------------------------------------------------ */

  function mount(box, def, name) {
    const scene = def.scene || { w: 640, h: 320 };
    const st = def.init ? def.init() : {};
    st._log = [];                       // журнал наблюдений
    st._step = 0;                       // индекс текущего шага
    const steps = def.steps || [];
    const journal = def.journal || [];
    const key = 'chemlab:' + name;

    box.innerHTML = `
      <div class="lab-scene">
        <svg viewBox="0 0 ${scene.w} ${scene.h}" class="geo-board lab-board" role="img"
             aria-label="${esc(def.alt || 'лабораторный стол')}"><g data-role="art"></g></svg>
        <div class="lab-bar">
          <button type="button" class="btn" data-role="play">⏸ Пауза</button>
          <label>скорость <input type="range" min="20" max="200" step="10" value="100" data-role="speed">
            <span class="readout" data-role="speedout">×1,0</span></label>
          <button type="button" class="btn" data-role="reset">↺ Начать заново</button>
        </div>
      </div>
      <div class="lab-panel">
        <div class="lab-steps" data-role="dots"></div>
        <div class="lab-step" data-role="stepbox"></div>
        <div class="lab-msg" data-role="msg"></div>
      </div>
      <div class="lab-obs">
        <h4>Таблица наблюдений</h4>
        <table class="dt"><thead><tr><th>Шаг</th><th>Что сделано</th><th>Что наблюдается</th></tr></thead>
        <tbody data-role="obs"><tr><td colspan="3" class="dim">пока пусто — выполните первый шаг</td></tr></tbody></table>
      </div>
      ${journal.length ? `<div class="lab-journal">
        <h4>Журнал работы</h4>
        <p class="small">Внесите показания и расчёты. Стенд сверит их с истинными
        значениями и покажет относительную погрешность. Данные сохраняются в этом браузере.</p>
        <div data-role="journal"></div>
        <div class="lab-jbar">
          <button type="button" class="btn primary" data-role="check">Проверить журнал</button>
          <button type="button" class="btn" data-role="clear">Очистить</button>
        </div>
        <div class="lab-jout" data-role="jout"></div>
      </div>` : ''}`;

    const art = box.querySelector('[data-role=art]');
    const dots = box.querySelector('[data-role=dots]');
    const stepbox = box.querySelector('[data-role=stepbox]');
    const msgEl = box.querySelector('[data-role=msg]');
    const obsEl = box.querySelector('[data-role=obs]');
    const playBtn = box.querySelector('[data-role=play]');
    const speedEl = box.querySelector('[data-role=speed]');
    const speedOut = box.querySelector('[data-role=speedout]');

    const ui = { vals: {}, playing: true, speed: 1, t: 0, visible: true, last: 0 };

    /* ---------- сцена ---------- */
    function paint() { art.innerHTML = def.draw(st, ui.t); }

    function tick(ts) {
      if (ui.playing && ui.visible) {
        if (ui.last) ui.t = (ui.t + (ts - ui.last) / (3000 / ui.speed)) % 1;
        ui.last = ts;
        paint();
      } else ui.last = 0;
      requestAnimationFrame(tick);
    }

    playBtn.addEventListener('click', () => {
      ui.playing = !ui.playing; ui.last = 0;
      playBtn.textContent = ui.playing ? '⏸ Пауза' : '▶ Пуск';
    });
    speedEl.addEventListener('input', () => {
      ui.speed = +speedEl.value / 100;
      speedOut.textContent = '×' + ui.speed.toFixed(1).replace('.', ',');
    });

    /* ---------- сообщения ---------- */
    function say(text, kind) {
      msgEl.className = 'lab-msg' + (kind ? ' ' + kind : '');
      msgEl.innerHTML = text || '';
      ui._said = true;
    }
    ui.say = say;

    /* ---------- таблица наблюдений ---------- */
    function logRow(what, obs) {
      st._log.push({ n: st._step + 1, what, obs });
      obsEl.innerHTML = st._log.map((r) =>
        `<tr><td class="num">${r.n}</td><td>${r.what}</td><td>${r.obs}</td></tr>`).join('');
    }
    ui.log = logRow;

    /* ---------- шаги ---------- */
    function renderDots() {
      dots.innerHTML = steps.map((s, i) => {
        const cls = i === st._step ? 'on' : (i < st._step ? 'done' : '');
        return `<button type="button" class="lab-dot ${cls}" data-i="${i}"
          ${i > st._step ? 'disabled' : ''} title="${esc(s.name)}">${i + 1}</button>`;
      }).join('');
      [...dots.querySelectorAll('button')].forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (i <= st._step) { st._step = i; renderStep(); }
      }));
    }

    function renderStep() {
      renderDots();
      const s = steps[st._step];
      if (!s) {
        stepbox.innerHTML = '<h4>Работа выполнена</h4><p>Все шаги пройдены. '
          + 'Заполните журнал и ответьте на контрольные вопросы.</p>';
        say('');
        paint();
        return;
      }
      const ctrls = (s.controls || []).map((c, i) => control(c, i)).join('');
      stepbox.innerHTML = `<h4>Шаг ${st._step + 1} из ${steps.length}. ${esc(s.name)}</h4>
        <p>${s.hint}</p>
        <div class="lab-controls">${ctrls}</div>`;
      wire(s);
      say('');
      paint();
    }

    function control(c, i) {
      const id = 'c' + i;
      if (c.kind === 'number') {
        if (ui.vals[c.id] === undefined) ui.vals[c.id] = c.value;
        return `<label class="lab-ctl">${esc(c.label)}
          <input type="number" data-val="${c.id}" value="${c.value}"
            min="${c.min}" max="${c.max}" step="${c.step || 1}">
          ${c.unit ? `<span class="dim">${esc(c.unit)}</span>` : ''}</label>`;
      }
      if (c.kind === 'select') {
        if (ui.vals[c.id] === undefined) ui.vals[c.id] = c.options[0].v;
        return `<label class="lab-ctl">${esc(c.label)}
          <select data-val="${c.id}">${c.options.map((o) =>
            `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join('')}</select></label>`;
      }
      return `<button type="button" class="btn ${c.primary ? 'primary' : ''}"
        data-act="${i}" id="${id}">${esc(c.label)}</button>`;
    }

    function wire(s) {
      [...stepbox.querySelectorAll('[data-val]')].forEach((el) => {
        const k = el.dataset.val;
        el.value = ui.vals[k];
        el.addEventListener('input', () => {
          ui.vals[k] = el.type === 'number' ? parseFloat(String(el.value).replace(',', '.')) : el.value;
        });
      });
      [...stepbox.querySelectorAll('[data-act]')].forEach((el) => {
        const c = s.controls[+el.dataset.act];
        el.addEventListener('click', () => {
          ui._said = false;
          try { c.act(st, ui.vals, ui); } catch (e) { say(esc(e.message), 'bad'); }
          paint();
          if (s.done && s.done(st)) advance(s);
        });
      });
    }

    function advance(s) {
      if (s.observe) {
        const o = s.observe(st);
        if (o) logRow(o.what, o.obs);
      }
      /* Предупреждение самого действия («мениск не на метке») важнее
         дежурного «шаг выполнен» — поэтому общий текст пишем только тогда,
         когда шаг ничего не сказал сам. */
      const spoke = ui._said, kept = msgEl.innerHTML, keptCls = msgEl.className;
      if (st._step < steps.length - 1) {
        st._step += 1;
        renderStep();
        if (spoke) { msgEl.innerHTML = kept; msgEl.className = keptCls; }
        else say('Шаг выполнен — переходите к следующему.', 'ok');
      } else {
        st._step = steps.length;
        renderStep();
      }
    }

    box.querySelector('[data-role=reset]').addEventListener('click', () => {
      const fresh = def.init ? def.init() : {};
      Object.keys(st).forEach((k) => { delete st[k]; });
      Object.assign(st, fresh, { _log: [], _step: 0 });
      obsEl.innerHTML = '<tr><td colspan="3" class="dim">пока пусто — выполните первый шаг</td></tr>';
      ui.vals = {};
      renderStep();
    });

    /* ---------- журнал ---------- */
    if (journal.length) {
      const jbox = box.querySelector('[data-role=journal]');
      const jout = box.querySelector('[data-role=jout]');
      const saved = load();

      jbox.innerHTML = `<table class="dt"><thead><tr><th>Величина</th><th>Ваше значение</th>
        <th>Единица</th></tr></thead><tbody>${journal.map((j) =>
        `<tr><td>${j.label}${j.hint ? `<div class="small dim">${j.hint}</div>` : ''}</td>
         <td><input type="text" class="lab-jin" data-j="${j.id}"
              value="${saved[j.id] !== undefined ? esc(saved[j.id]) : ''}"
              inputmode="decimal" size="10"></td>
         <td class="dim">${esc(j.unit || '')}</td></tr>`).join('')}</tbody></table>`;

      function values() {
        const v = {};
        [...jbox.querySelectorAll('[data-j]')].forEach((el) => { v[el.dataset.j] = el.value.trim(); });
        return v;
      }
      function save() {
        try { localStorage.setItem(key, JSON.stringify(values())); } catch (e) { /* приватный режим */ }
      }
      function load() {
        try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
      }
      jbox.addEventListener('input', save);

      box.querySelector('[data-role=check]').addEventListener('click', () => {
        const v = values();
        let ok = 0, filled = 0;
        const rows = journal.map((j) => {
          const raw = (v[j.id] || '').replace(',', '.');
          const truth = j.truth(st);
          if (raw === '') {
            return `<tr><td>${j.label}</td><td class="dim">не заполнено</td>
              <td class="dim">—</td><td class="dim">—</td></tr>`;
          }
          filled++;
          const x = parseFloat(raw);
          if (!isFinite(x)) {
            return `<tr><td>${j.label}</td><td class="bad">не число</td>
              <td>${fmt(truth)}</td><td class="bad">—</td></tr>`;
          }
          /* Относительная погрешность не определена при истинном нуле
             (а такие величины в практикуме есть — например pH = 0 или
             нулевая остаточная жёсткость). В этом случае допуск читается
             как абсолютный. */
          const tol = (j.tol === undefined ? 2 : j.tol);
          const err = CC.relError(x, truth);
          const good = truth === 0 ? Math.abs(x) <= tol : err <= tol;
          if (good) ok++;
          return `<tr><td>${j.label}</td><td class="${good ? 'ok' : 'bad'}">${fmt(x)}</td>
            <td>${fmt(truth)}</td>
            <td class="${good ? 'ok' : 'bad'}">${isFinite(err) ? fmt(err, 1) + ' %'
              : fmt(Math.abs(x - truth), 2) + ' (абс.)'}</td></tr>`;
        }).join('');
        jout.innerHTML = `<table class="dt"><thead><tr><th>Величина</th><th>Ваше</th>
          <th>Истинное</th><th>Погрешность</th></tr></thead><tbody>${rows}</tbody></table>
          <p class="${ok === journal.length ? 'lab-ok' : 'lab-bad'}">
          Засчитано ${ok} из ${journal.length}${filled < journal.length
            ? ` (не заполнено: ${journal.length - filled})` : ''}.
          ${ok === journal.length ? 'Журнал принят.'
            : 'Значения с погрешностью больше допустимой не засчитываются — проверьте расчёт.'}</p>`;
        save();
      });

      box.querySelector('[data-role=clear]').addEventListener('click', () => {
        [...jbox.querySelectorAll('[data-j]')].forEach((el) => { el.value = ''; });
        jout.innerHTML = '';
        save();
      });
    }

    if ('IntersectionObserver' in global) {
      new IntersectionObserver((es) => { ui.visible = es[0].isIntersecting; },
        { threshold: 0.02 }).observe(box);
    }

    renderStep();
    requestAnimationFrame(tick);
    box.dataset.labReady = name;
    box.labApi = { st, ui, steps, journal, paint, renderStep };
  }

  Lab.mountAll = function (scope) {
    (scope || document).querySelectorAll('[data-lab]').forEach((box) => {
      if (box.dataset.labReady) return;
      const def = REG[box.dataset.lab];
      if (!def) { box.innerHTML = '<div class="small">работа не найдена: ' + box.dataset.lab + '</div>'; return; }
      mount(box, def, box.dataset.lab);
    });
  };

  const ready = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => Lab.mountAll());
})(window);
