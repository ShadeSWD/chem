# -*- coding: utf-8 -*-
"""Структурные требования к лабораторному практикуму.

Семь работ собирались по одному контракту, и этот набор его удерживает:
страница подключает стенд и ядро в правильном порядке, содержит блок о том,
что работа выполняется в лаборатории под руководством преподавателя, раздел
техники безопасности и контрольные вопросы; определение работы объявляет себя
тем же именем, что стоит в data-lab, и не проскакивает первый шаг.
"""
import os
import re

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
ASSETS = os.path.join(SITE, 'assets')

LABS = ['solution', 'titration', 'ions', 'hardness', 'kinetics',
        'electrochem', 'redox']


def page(name):
    with open(os.path.join(SITE, 'l-%s.html' % name), encoding='utf-8') as fh:
        return fh.read()


def module(name):
    with open(os.path.join(ASSETS, 'lab-%s.js' % name), encoding='utf-8') as fh:
        return fh.read()


def test_index_page_exists():
    assert os.path.isfile(os.path.join(SITE, 'lab.html')), 'нет страницы практикума'


def test_index_links_every_lab():
    html = open(os.path.join(SITE, 'lab.html'), encoding='utf-8').read()
    for name in LABS:
        assert 'l-%s' % name in html, 'практикум не ссылается на работу %s' % name


def test_engine_files_present():
    for f in ('chemcore.js', 'labware.js', 'lab.js'):
        assert os.path.isfile(os.path.join(ASSETS, f)), 'нет модуля %s' % f


@pytest.mark.parametrize('name', LABS)
def test_lab_files_exist(name):
    assert os.path.isfile(os.path.join(SITE, 'l-%s.html' % name))
    assert os.path.isfile(os.path.join(ASSETS, 'lab-%s.js' % name))


@pytest.mark.parametrize('name', LABS)
def test_page_mounts_the_stand(name):
    html = page(name)
    assert 'data-lab="%s"' % name in html, 'на странице нет стенда работы'


@pytest.mark.parametrize('name', LABS)
def test_scripts_are_included_in_order(name):
    """Порядок важен: определение работы обращается к ядру и к посуде."""
    html = page(name)
    order = ['assets/chemcore.js', 'assets/labware.js', 'assets/lab.js',
             'assets/lab-%s.js' % name]
    pos = []
    for src in order:
        i = html.find(src)
        assert i > 0, 'страница не подключает %s' % src
        pos.append(i)
    assert pos == sorted(pos), 'скрипты подключены не в том порядке: %s' % order


@pytest.mark.parametrize('name', LABS)
def test_module_defines_matching_lab(name):
    js = module(name)
    assert re.search(r"""define\(\s*['"]%s['"]""" % name, js), \
        'lab-%s.js не объявляет работу с этим именем' % name


@pytest.mark.parametrize('name', LABS)
def test_module_has_enough_steps_and_journal(name):
    js = module(name)
    assert 'steps:' in js and 'journal:' in js, 'нет шагов или журнала'
    # шаги перечислены объектами с именем; их должно быть не меньше шести
    assert len(re.findall(r'\bname:\s*[\'"]', js)) >= 6, \
        'в работе меньше шести шагов'
    assert len(re.findall(r'\btruth\s*[:(]', js)) >= 3, \
        'в журнале меньше трёх проверяемых величин'


@pytest.mark.parametrize('name', LABS)
def test_result_is_computed_by_core(name):
    """Наблюдаемое должно считаться ядром, а не назначаться в коде работы."""
    js = module(name)
    assert 'ChemCore' in js, 'работа не обращается к расчётному ядру'


@pytest.mark.parametrize('name', LABS)
def test_safety_blocks_present(name):
    html = page(name)
    assert 'id="safety"' in html, 'нет раздела техники безопасности'
    assert 'warn' in html, 'нет предупреждающего блока'
    # перенос строки внутри фразы — обычное дело в вёрстке, поэтому сравниваем
    # по тексту со схлопнутыми пробелами
    low = re.sub(r'\s+', ' ', html.lower())
    assert 'под руководством преподавателя' in low, \
        'не сказано, что работа выполняется под руководством преподавателя'
    assert 'лаборатории' in low


@pytest.mark.parametrize('name', LABS)
def test_page_sections(name):
    html = page(name)
    for anchor in ('id="goal"', 'id="kit"', 'id="run"', 'id="result"',
                   'id="conclusion"', 'id="q"'):
        assert anchor in html, 'на странице нет раздела %s' % anchor
    assert html.count('<details class="q">') >= 5, \
        'меньше пяти контрольных вопросов'


@pytest.mark.parametrize('name', LABS)
def test_page_head_is_complete(name):
    html = page(name)
    assert '<title>' in html and '</title>' in html
    m = re.search(r'<meta name="description" content="([^"]{80,})"', html)
    assert m, 'нет содержательного описания страницы'
    assert 'assets/style.css' in html
    assert 'assets/shell.js' in html and 'assets/site.js' in html


@pytest.mark.parametrize('name', LABS)
def test_substitution_format_used(name):
    """Расчёт оформляется шаблоном кластера: формула — подстановка — результат."""
    html = page(name)
    assert 'class="subst"' in html, 'расчёты не оформлены подстановкой'


def test_nav_lists_practicum():
    js = open(os.path.join(ASSETS, 'site.js'), encoding='utf-8').read()
    assert "'lab'" in js or '"lab"' in js, 'практикума нет в навигации'
    for name in LABS:
        assert 'l-%s' % name in js, 'работы %s нет в навигации' % name
