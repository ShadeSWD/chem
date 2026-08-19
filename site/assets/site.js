/* Данные каркаса страниц. Машинерия — assets/shell.js. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Химия',
    logo: `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#7e22ce"/>
    <text x="15" y="22" text-anchor="middle" font-size="16">⚗️</text>
  </svg>`,
    nav: [
      { h: '', k: 'index', t: 'Обзор' },
      { t: 'Теория', h: 'theory', drop: [
        { h: 'theory', k: 'theory', t: 'Программа курса' },
        { h: 't-atom', k: 'theory', t: '1. Строение атома' },
        { h: 't-bond', k: 'theory', t: '2. Химическая связь' },
        { h: 't-thermo', k: 'theory', t: '3. Термодинамика' },
        { h: 't-kinetics', k: 'theory', t: '4. Кинетика и равновесие' },
        { h: 't-solutions', k: 'theory', t: '5. Растворы' },
        { h: 't-redox', k: 'theory', t: '6. Реакции ОВР' },
        { h: 't-electrochem', k: 'theory', t: '7. Электрохимия' },
        { h: 't-corrosion', k: 'theory', t: '8. Коррозия металлов' },
        { h: 't-materials', k: 'theory', t: '9. Материалы и вода' },
      ] },
      { t: 'Задачи', h: 'tasks', drop: [
        { h: 'tasks', k: 'tasks', t: 'Указатель задач' },
        { h: 'p-stoich', k: 'tasks', t: 'Расчёты по уравнениям' },
        { h: 'p-thermo', k: 'tasks', t: 'Термодинамика и кинетика' },
        { h: 'p-solutions', k: 'tasks', t: 'Растворы, pH, осадки' },
        { h: 'p-electrochem', k: 'tasks', t: 'ОВР, ток, коррозия' },
      ] },
      { h: 'sources', k: 'sources', t: 'Источники' },
    ],
    footer: `<div>Учебный сайт по курсу «Химия» · 1–2 семестры, 252 ч, экзамены · кафедра 2820</div>
    <div>Смежные курсы:
      <a href="https://shadeswd.duckdns.org/corrosion/">коррозия и обрастание</a> ·
      <a href="https://shadeswd.duckdns.org/materials/">материаловедение</a> ·
      <a href="https://shadeswd.duckdns.org/ecology/">экология</a></div>`,
    markers: `<marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
    <marker id="arrB" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#155e75"/></marker>
    <marker id="arrR" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#b3382e"/></marker>
    <marker id="arrG" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#1a7f37"/></marker>`,
  });
})();
