# -*- coding: utf-8 -*-
"""Контрольный счёт расчётного ядра практикума (site/assets/chemcore.js).

Смысл набора: наблюдаемый на стенде результат должен быть ПОСЧИТАН, а не
назначен под красивую картинку. Поэтому каждое значение здесь считается
второй раз — независимо, на python, из определения (или взято из разобранной
задачи методички кафедры), и сверяется с тем, что выдаёт ядро в node.

Источники контрольных значений:
  * практические занятия кафедры (Практика 11, 12, 13 — концентрации, pH, ПР);
  * лекции 11–14 (ионное произведение воды, ПР, жёсткость);
  * определения формул (закон Фарадея, правило Вант-Гоффа, Нернст).
"""
import json
import math
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'site', 'assets', 'chemcore.js')

pytestmark = pytest.mark.skipif(not shutil.which('node'),
                               reason='node не установлен')


def core(exprs):
    """Считает список выражений в ядре и возвращает список значений."""
    script = (
        'const C = require(%s);\n'
        'const out = [%s];\n'
        'process.stdout.write(JSON.stringify(out));'
    ) % (json.dumps(CORE), ','.join('(' + e + ')' for e in exprs))
    r = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    assert r.returncode == 0, 'ядро не выполнилось: %s' % r.stderr.strip()[:600]
    return json.loads(r.stdout)


def one(expr):
    return core([expr])[0]


def close(a, b, tol=1e-9):
    assert a == pytest.approx(b, rel=tol, abs=tol), '%r != %r' % (a, b)


# ---------------------------------------------------------------- 1. массы

def test_01_molar_mass_matches_manual_sum():
    """M считается как сумма округлённых атомных масс — соглашение курса."""
    got = core(['C.molarMass("HNO3")', 'C.molarMass("FeSO4")',
                'C.molarMass("CuSO4")', 'C.molarMass("NaOH")',
                'C.molarMass("Al2(SO4)3")', 'C.molarMass("HBr")'])
    # независимо: HNO3 = 1+14+3*16; FeSO4 = 56+32+4*16; CuSO4 = 64+32+4*16
    expect = [1 + 14 + 3 * 16, 56 + 32 + 4 * 16, 64 + 32 + 4 * 16,
              23 + 16 + 1, 2 * 27 + 3 * (32 + 4 * 16), 1 + 80]
    assert got == expect
    # значения из методички: M(HNO3)=63, M(FeSO4)=152, M(CuSO4)=160, M(HBr)=81
    assert got[0] == 63 and got[1] == 152 and got[2] == 160 and got[5] == 81


def test_02_crystal_hydrate_mass():
    """CuSO4·5H2O = 160 + 5·18 = 250 г/моль."""
    close(one('C.molarMass("CuSO4*5H2O")'), 160 + 5 * 18)
    close(one('C.molarMass("CuSO4·5H2O")'), 250)


# ------------------------------------------------------------------- 2. pH

def test_03_ph_strong_acid_practicum_12_task_1():
    """Практика 12, задача 1: 0,243 г HBr в 300 мл → C = 0,01, pH = 2."""
    c = one('C.molarFromMass(0.243, 81, 0.3)')
    close(c, 0.243 / (81 * 0.3))
    close(c, 0.01, tol=1e-12)
    close(one('C.pHStrongAcid(0.01, 1)'), 2.0, tol=1e-6)


def test_04_ph_strong_base_practicum_12_task_2():
    """Практика 12, задача 2: 2,04 г RbOH в 200 мл → C = 0,1, pH = 13."""
    c = one('C.molarFromMass(2.04, 102, 0.2)')
    close(c, 0.1, tol=1e-12)
    close(one('C.pHStrongBase(0.1, 1)'), 14 + math.log10(0.1))
    close(one('C.pHStrongBase(0.1, 1)'), 13.0, tol=1e-12)


def test_05_ph_from_kw_pair():
    """Лекция 11: [OH⁻] = 1e-9 → [H⁺] = 1e-5 → pH = 5."""
    close(one('-C.lg(C.KW / 1e-9)'), 5.0, tol=1e-9)


def test_06_ph_weak_acid_matches_ostwald():
    """Слабая кислота: точный корень и приближение √(Ka·C) сходятся."""
    exact = one('C.pHWeakAcid(0.1, 1.8e-5)')
    approx = one('C.pHWeakAcidApprox(0.1, 1.8e-5)')
    # независимо: x² + Ka·x − Ka·C = 0
    ka, conc = 1.8e-5, 0.1
    x = (-ka + math.sqrt(ka * ka + 4 * ka * conc)) / 2
    close(exact, -math.log10(x))
    close(approx, -math.log10(math.sqrt(ka * conc)))
    assert abs(exact - approx) < 0.01, 'расхождение с формулой курса > 0,01 pH'
    assert 2.8 < exact < 2.9


def test_07_hydrolysis_acetate():
    """CH3COONa 0,1 моль/л: pH = 7 + ½(pKa + lg C)."""
    ka = 1.8e-5
    expect = 7 + 0.5 * (-math.log10(ka) + math.log10(0.1))
    close(one('C.pHSaltWeakAcid(0.1, 1.8e-5)'), expect)
    assert expect > 7, 'соль слабой кислоты должна давать щелочную среду'


def test_08_hydrolysis_ammonium_is_acidic():
    """NH4Cl 0,1 моль/л: среда кислая, pH < 7."""
    kb = 1.8e-5
    expect = 7 - 0.5 * (-math.log10(kb) + math.log10(0.1))
    close(one('C.pHSaltWeakBase(0.1, 1.8e-5)'), expect)
    assert expect < 7


# ------------------------------------------------------------- 3. индикаторы

def test_09_indicator_colour_follows_ph():
    """Цвет берётся по интервалу перехода, а не назначается вручную."""
    got = core(['C.indicatorColor("phenolphthalein", 3).t',
                'C.indicatorColor("phenolphthalein", 12).t',
                'C.indicatorColor("methylOrange", 1).t',
                'C.indicatorColor("methylOrange", 7).t',
                'C.indicatorColor("litmus", 2).t',
                'C.indicatorColor("litmus", 12).t'])
    assert got == ['бесцветный', 'малиновый', 'красный', 'жёлтый',
                   'красный', 'синий']


# ------------------------------------------------------------------ 4. ПР

def test_10_precipitate_agcl_practicum_13_task_1():
    """Практика 13, задача 1: равные объёмы 0,002 М AgNO3 и 0,002 М NaCl.

    После слияния по 0,001; IP = 1e-6 > ПР = 1,8e-10 → осадок выпадет.
    """
    m = one('C.mix(0.002, 1, 0.002, 1)')
    close(m['c1'], 0.001)
    close(m['c2'], 0.001)
    r = one('C.willPrecipitate("AgCl", 0.001, 0.001, 1, 1)')
    close(r['IP'], 0.001 * 0.001)
    close(r['Ksp'], 1.8e-10)
    assert r['precipitates'] is True


def test_11_no_precipitate_pbcl2_practicum_13_task_2():
    """Практика 13, задача 2: Pb²⁺ 0,02 и Cl⁻ 0,01 после слияния.

    IP = 0,02·0,01² = 2e-6 < ПР(PbCl2) = 1,6e-5 → осадок НЕ выпадет.
    """
    r = one('C.willPrecipitate("PbCl2", 0.02, 0.01, 1, 2)')
    close(r['IP'], 0.02 * 0.01 ** 2)
    close(r['IP'], 2e-6)
    assert r['precipitates'] is False


def test_12_solubility_from_ksp():
    """Растворимость AgCl: s = √ПР."""
    close(one('C.solubility("AgCl", 1, 1)'), math.sqrt(1.8e-10))


# ----------------------------------------------------------- 5. приготовление

def test_13_mass_for_molar_practicum_11_task_2():
    """Практика 11, задача 2: 500 мл 0,1 М CuSO4 → 8 г."""
    close(one('C.massForMolar(0.1, 0.5, 160)'), 160 * 0.5 * 0.1)
    close(one('C.massForMolar(0.1, 0.5, 160)'), 8.0)


def test_14_fraction_to_molar_practicum_11_task_3():
    """Практика 11, задача 3: 20 % NaOH, ρ = 1,225 → 490 г на 2 л."""
    # масса раствора 2000·1,225 = 2450 г, навеска 20 % от неё = 490 г
    close(one('C.massFraction(490, 2450)'), 20.0)
    close(one('C.molarFromFraction(20, 1.225, 40)'), 20 * 1.225 * 10 / 40)
    close(one('C.molarFromFraction(20, 1.225, 40)'), 6.125)


def test_15_dilution_rule():
    """C1V1 = C2V2."""
    close(one('C.dilute(6.125, 100, 1)'), 6.125 * 100 / 1)


def test_16_hydrate_weighing():
    """Навеска кристаллогидрата больше безводной в Mh/Ma раз."""
    r = one('C.massHydrate(0.1, 0.5, "CuSO4", "CuSO4*5H2O")')
    close(r['m'], 0.1 * 0.5 * 250)
    close(r['mAnhydrous'], 8.0)
    close(r['m'] / r['mAnhydrous'], 250 / 160)


# ------------------------------------------------------------ 6. титрование

def test_17_equivalence_volume():
    """10 мл 0,1 М HCl титруется 0,1 М NaOH → ровно 10 мл."""
    close(one('C.equivalenceVolume(0.1, 10, 1, 0.1, 1)'), 10.0)
    # двухосновная кислота требует вдвое больше щёлочи
    close(one('C.equivalenceVolume(0.1, 10, 2, 0.1, 1)'), 20.0)


def test_18_titration_curve_strong_strong():
    """Кривая сильная-сильная: считаем три точки независимо."""
    va, ca, cb = 10.0, 0.1, 0.1
    # до точки эквивалентности: избыток кислоты
    vb = 9.9
    n_excess = (ca * va - cb * vb) / 1000
    expect = -math.log10(n_excess / ((va + vb) / 1000))
    close(one('C.titrationPH(10, 0.1, 9.9, 0.1, null)'), expect, tol=1e-6)
    # в точке эквивалентности pH = 7
    close(one('C.titrationPH(10, 0.1, 10, 0.1, null)'), 7.0, tol=1e-9)
    # после: избыток щёлочи
    vb = 10.1
    n_excess = (cb * vb - ca * va) / 1000
    expect = 14 + math.log10(n_excess / ((va + vb) / 1000))
    close(one('C.titrationPH(10, 0.1, 10.1, 0.1, null)'), expect, tol=1e-6)


def test_19_titration_jump_is_large_and_symmetric():
    """Скачок сильная-сильная перекрывает интервал фенолфталеина."""
    j = one('C.titrationJump(10, 0.1, 0.1, null)')
    close(j['Veq'], 10.0)
    close(j['pHeq'], 7.0, tol=1e-9)
    assert j['pH99'] < 4.5 and j['pH101'] > 9.5, j
    # интервал перехода фенолфталеина 8,2–10,0 лежит внутри скачка
    assert j['pH99'] < 8.2 < j['pH101']


def test_20_titration_weak_acid_equivalence_is_basic():
    """Слабая кислота: в точке эквивалентности среда щелочная (гидролиз)."""
    j = one('C.titrationJump(10, 0.1, 0.1, 1.8e-5)')
    # в точке эквивалентности соль 0,05 моль/л → pH = 7 + ½(pKa + lg 0,05)
    expect = 7 + 0.5 * (-math.log10(1.8e-5) + math.log10(0.05))
    close(j['pHeq'], expect, tol=1e-6)
    assert j['pHeq'] > 8, 'метилоранж для слабой кислоты не годится'
    # полуточка эквивалентности: pH = pKa
    half = one('C.titrationPH(10, 0.1, 5, 0.1, 1.8e-5)')
    close(half, -math.log10(1.8e-5), tol=1e-6)


def test_21_concentration_from_titration():
    """Обратная задача титрования: 12,5 мл 0,1 М щёлочи на 10 мл кислоты."""
    close(one('C.concFromTitration(0.1, 12.5, 1, 10, 1)'), 0.1 * 12.5 / 10)
    close(one('C.concFromTitration(0.1, 12.5, 1, 10, 1)'), 0.125)


# ------------------------------------------------------------------ 7. газы

def test_22_gas_volume_from_carbonate():
    """CaCO3 + 2HCl → CaCl2 + H2O + CO2↑; 5 г CaCO3 → 1,12 л CO2."""
    r = one('C.gasFromMass(5, 100, 1, 1)')
    close(r['n'], 5 / 100)
    close(r['V'], 5 / 100 * 22.4)
    close(r['V'], 1.12)
    close(one('C.molarMass("CaCO3")'), 100)


def test_23_gas_volume_zinc_hydrogen():
    """Zn + H2SO4 → ZnSO4 + H2↑; 6,5 г Zn → 2,24 л H2."""
    close(one('C.molarMass("Zn")'), 65)
    r = one('C.gasFromMass(6.5, 65, 1, 1)')
    close(r['V'], 0.1 * 22.4)
    close(r['V'], 2.24)


# --------------------------------------------------------- 8. электрохимия

def test_24_faraday_mass_copper():
    """m = M·I·t/(n·F); Cu, I = 2 А, t = 1930 с, n = 2."""
    expect = 64 * 2 * 1930 / (2 * 96485)
    close(one('C.faradayMass(64, 2, 1930, 2)'), expect)
    assert 1.27 < expect < 1.29


def test_25_faraday_volume_hydrogen():
    """V = Vм·I·t/(n·F) — та же формула с молярным объёмом."""
    expect = 22.4 * 2 * 1930 / (2 * 96485)
    close(one('C.faradayVolume(2, 1930, 2)'), expect)
    # проверка согласованности: масса водорода / M = объём / Vм
    m = one('C.faradayMass(2, 2, 1930, 2)')
    close(m / 2, expect / 22.4)


def test_26_current_yield():
    close(one('C.currentYield(1.15, 1.2805)'), 1.15 / 1.2805 * 100)


def test_27_nernst_and_emf():
    """φ = φ° + (0,059/n)·lg C; ЭДС = φк − φа."""
    close(one('C.nernst(-0.76, 2, 0.01)'), -0.76 + 0.059 / 2 * math.log10(0.01))
    close(one('C.nernst(-0.76, 2, 0.01)'), -0.819, tol=1e-3)
    # медно-цинковый элемент при стандартных условиях: 1,10 В
    close(one('C.emf(0.34, -0.76)'), 1.10, tol=1e-9)


# ---------------------------------------------------------- 9. жёсткость

def test_28_hardness_from_masses_lecture_13():
    """Лекция 13: 1 мэкв Ca²⁺ = 20 мг, Mg²⁺ = 12 мг."""
    close(one('C.hardnessFromMass(80, 24)'), 80 / 20 + 24 / 12)
    close(one('C.hardnessFromMass(80, 24)'), 6.0)
    assert one('C.hardnessGrade(6)') == 'средней жёсткости'
    assert one('C.hardnessGrade(2)') == 'мягкая'
    assert one('C.hardnessGrade(10)') == 'жёсткая'
    assert one('C.hardnessGrade(14)') == 'очень жёсткая'


def test_29_hardness_molar_and_titration_agree():
    """Два способа выразить одну жёсткость должны давать одно число."""
    # 0,003 моль/л Ca²⁺ = 6 мэкв/л
    close(one('C.hardnessFromMolar(0.003, 0)'), 6.0)
    # то же титрованием: 100 мл пробы, 0,05 М трилон Б, 6 мл
    close(one('C.hardnessFromTitration(0.05, 6, 100)'), 0.05 * 6 * 2 * 1000 / 100)
    close(one('C.hardnessFromTitration(0.05, 6, 100)'), 6.0)


def test_30_softening_dose():
    """На 1 мэкв жёсткости — 1 мэкв реагента; Мэкв(Na2CO3) = 53 г/моль."""
    close(one('C.softeningDose(6, 10, 53)'), 6 * 10 * 53 / 1000)
    close(one('C.softeningDose(6, 10, 53)'), 3.18)


# ------------------------------------------------------------- 10. кинетика

def test_31_vant_hoff():
    """v₂/v₁ = γ^(ΔT/10); γ = 3, ΔT = 30 → 27 раз."""
    close(one('C.vantHoff(3, 30)'), 3 ** 3)
    close(one('C.vantHoff(3, 30)'), 27.0)
    # время сокращается во столько же раз
    close(one('C.timeVantHoff(54, 3, 30)'), 2.0)


def test_32_rate_law():
    """v = k·C(A)²·C(B) — закон действующих масс."""
    expect = 0.5 * (0.2 ** 2) * 0.3
    close(one('C.rateLaw(0.5, [{C:0.2,order:2},{C:0.3,order:1}])'), expect)


def test_33_arrhenius_consistent_with_vant_hoff():
    """Аррениус при Ea ≈ 50 кДж/моль даёт γ порядка 2 — как в лекции 8."""
    ratio = one('C.arrhenius(50, 298, 308)')
    expect = math.exp(50 * 1000 / 8.314 * (1 / 298 - 1 / 308))
    close(ratio, expect)
    assert 1.8 < ratio < 2.3


# ------------------------------------------------------------ 11. термохимия

def test_34_hess_law():
    """ΔH = Σ ΔH(продуктов) − Σ ΔH(исходных)."""
    expr = ('C.heatOfReaction([{n:1,dH:-394},{n:2,dH:-286}],'
            '[{n:1,dH:-75},{n:2,dH:0}])')
    close(one(expr), (-394 + 2 * -286) - (-75))
    close(one(expr), -891.0)


def test_35_temperature_rise():
    """Δt = Q/(c·m); 5,7 кДж на 200 г воды."""
    close(one('C.tempRise(5.7, 200, 4.18)'), 5.7 * 1000 / (4.18 * 200))


# ------------------------------------------------------------ 12. служебное

def test_36_relative_error():
    close(one('C.relError(0.0985, 0.1)'), abs(0.0985 - 0.1) / 0.1 * 100)
    close(one('C.relError(0.0985, 0.1)'), 1.5, tol=1e-9)


def test_37_significant_rounding():
    got = core(['C.sig(1.28051, 3)', 'C.sig(0.000123456, 3)', 'C.sig(0, 3)'])
    assert got == [1.28, 0.000123, 0]
