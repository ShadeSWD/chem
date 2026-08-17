/* Каркас страниц курса «Химия»: шапка с группированной навигацией,
 * подвал и общие SVG-маркеры стрелок. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  const page = (me && me.dataset.page) || '';
  const logoSvg = `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#7e22ce"/>
    <text x="15" y="22" text-anchor="middle" font-size="16">⚗️</text>
  </svg>`;
  const nav = [
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
  ];
  const navLink = (it) =>
    `<a href="${root}${it.h}" class="${page === it.k ? 'on' : ''}">${it.t}</a>`;
  const navHtml = nav.map((g) => {
    if (!g.drop) return navLink(g);
    const on = g.drop.some((it) => page === it.k) ? 'on' : '';
    return `<span class="nav-drop"><a href="${root}${g.h}" class="${on}">${g.t} ▾</a>`
      + `<span class="drop">${g.drop.map(navLink).join('')}</span></span>`;
  }).join('');
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logoSvg}<span>Химия</span></a>
    <nav class="top">${navHtml}</nav>
  </div>`;
  document.body.prepend(header);
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Химия» · 1–2 семестры, 252 ч, экзамены · кафедра 2820</div>
    <div>Смежные курсы:
      <a href="https://shadeswd.duckdns.org/corrosion/">коррозия и обрастание</a> ·
      <a href="https://shadeswd.duckdns.org/materials/">материаловедение</a> ·
      <a href="https://shadeswd.duckdns.org/ecology/">экология</a></div>
  </div>`;
  onReady(() => document.body.appendChild(footer));
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
    <marker id="arrB" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#155e75"/></marker>
    <marker id="arrR" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#b3382e"/></marker>
    <marker id="arrG" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#1a7f37"/></marker>
  </defs>`;
  onReady(() => document.body.appendChild(defs));
})();
