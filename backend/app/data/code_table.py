"""Canonical line / insurer / reinsurer / currency tables.

Generated from CODE 관리.xlsx. Edit `is_foreign` flags by hand when
reinsurer classification is wrong — heuristics get the parent vs.
Korean-branch distinction wrong sometimes. The classification drives
the SLIP_FOREIGN_RULE pipeline (no Korean text in slips for foreign
reinsurers), so accuracy here matters.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Line:
    no: int
    name_kr: str
    code: str
    category: str


@dataclass(frozen=True)
class Insurer:
    no: int | None
    name: str
    code: str


@dataclass(frozen=True)
class Reinsurer:
    no: int | None
    name: str
    code: str
    is_foreign: bool


LINES: tuple[Line, ...] = (
    Line(no=1, name_kr='퇴직보험', code='Annuity', category='Casualty'),
    Line(no=2, name_kr='자동차보험', code='Auto', category='Casualty'),
    Line(no=3, name_kr='금융기관종합', code='BBB', category='Casualty'),
    Line(no=4, name_kr='일반배상책임보험', code='CGL', category='Casualty'),
    Line(no=5, name_kr='상금보험', code='Contingency', category='Casualty'),
    Line(no=6, name_kr='사이버시큐리티보험', code='Cyber', category='Casualty'),
    Line(no=7, name_kr='임원배상책임보험', code='D&O', category='Casualty'),
    Line(no=8, name_kr='개인신용보장보험', code='DCDS', category='Casualty'),
    Line(no=9, name_kr='회사금융종합보험', code='DDD', category='Casualty'),
    Line(no=10, name_kr='E-biz 배상책임보험', code='E-BIZ', category='Casualty'),
    Line(no=11, name_kr='전자기기', code='EEI', category='Casualty'),
    Line(no=12, name_kr='전자금융거래', code='EFTL', category='Casualty'),
    Line(no=13, name_kr='환경오염배상책임보험', code='EIL', category='Casualty'),
    Line(no=14, name_kr='보증연장보험', code='EW', category='Casualty'),
    Line(no=15, name_kr='금융기관전문인배상책임보험', code='FIPI', category='Casualty'),
    Line(no=16, name_kr='가스배상책임보험', code='GAS', category='Casualty'),
    Line(no=17, name_kr='단말기보험', code='Handset', category='Casualty'),
    Line(no=18, name_kr='정보 및 네트워크 배상책임보험', code='INT E&O', category='Casualty'),
    Line(no=19, name_kr='유괴납치', code='K&R', category='Casualty'),
    Line(no=20, name_kr='의사배상책임보험', code='Med-mal', category='Casualty'),
    Line(no=21, name_kr='모바일 프로모션', code='Mobile', category='Casualty'),
    Line(no=22, name_kr='경영리스크보호', code='MRPI', category='Casualty'),
    Line(no=23, name_kr='상해보험', code='PA', category='Casualty'),
    Line(no=24, name_kr='전문인배상책임보험', code='PI', category='Casualty'),
    Line(no=25, name_kr='개인정보배상책임보험', code='PIL', category='Casualty'),
    Line(no=26, name_kr='생산물배상책임보험', code='PIL', category='Casualty'),
    Line(no=27, name_kr='생산물회수보험', code='Recall', category='Casualty'),
    Line(no=28, name_kr='적재물배상', code='Road Haulers', category='Casualty'),
    Line(no=29, name_kr='신용보험', code='TC', category='Casualty'),
    Line(no=30, name_kr='포괄배상책임', code='UL', category='Casualty'),
    Line(no=31, name_kr='자문료', code='Advisory fee', category='Engineering'),
    Line(no=32, name_kr='선수금 환급보증', code='AP Bond', category='Engineering'),
    Line(no=33, name_kr='건설공사', code='CAR', category='Engineering'),
    Line(no=34, name_kr='완성토목', code='CCAR', category='Engineering'),
    Line(no=35, name_kr='기관기계종합', code='CMI', category='Engineering'),
    Line(no=36, name_kr='중장비안전', code='CPM', category='Engineering'),
    Line(no=37, name_kr='10년 구조물보험', code='DLI', category='Engineering'),
    Line(no=38, name_kr='조립보험', code='EAR', category='Engineering'),
    Line(no=39, name_kr='근재보험', code='EL', category='Engineering'),
    Line(no=40, name_kr='계약이행보증', code='P Bond', category='Engineering'),
    Line(no=41, name_kr='산재보험', code='WC', category='Engineering'),
    Line(no=42, name_kr='항공보험', code='Aviation', category='Marine'),
    Line(no=43, name_kr='건조보험', code="Builders' Risks", category='Marine'),
    Line(no=44, name_kr='적하보험', code='Cargo', category='Marine'),
    Line(no=45, name_kr='전시적하', code='Exhibition', category='Marine'),
    Line(no=46, name_kr='선박보험', code='Hull', category='Marine'),
    Line(no=47, name_kr='해상기타', code='MMIP', category='Marine'),
    Line(no=48, name_kr='해양책임', code='P&I', category='Marine'),
    Line(no=49, name_kr='해상특약', code='Treaty', category='Marine'),
    Line(no=50, name_kr='영문화재보험', code='F.O.C', category='Property'),
    Line(no=51, name_kr='재산종합', code='PAR', category='Property'),
    Line(no=52, name_kr='특약', code='Treaty', category='Treaty'),
    Line(no=53, name_kr='성과급', code='Incentive', category='-'),
    Line(no=54, name_kr='생명공학배상책임보험(Life Sciences Insurance)', code='LS', category='Casualty'),
    Line(no=55, name_kr='행사취소보험', code='Cancellation of Event Indemnity Insurance', category='Casualty'),
    Line(no=56, name_kr='화재보험', code='PAR', category='Property'),
    Line(no=57, name_kr='금융사고보상보험(III)', code='Financial Loss Compensation Insurance', category='Casualty'),
    Line(no=58, name_kr='도난보험', code='Crime', category='Property'),
    Line(no=59, name_kr='건설기계업자배상책임', code='CSL', category='Casualty'),
    Line(no=60, name_kr='테러보험', code='Terrorism', category='Casualty'),
    Line(no=61, name_kr='승강기사고배상책임보험', code='CGL', category='Casualty'),
    Line(no=62, name_kr='시설소유오염배상책임보험', code='PPL', category='Casualty'),
    Line(no=63, name_kr='잔존물회수보험', code='RVI', category='Casualty'),
    Line(no=64, name_kr='신차교환보상비용보험', code='NCR', category='Casualty'),
)

INSURERS: tuple[Insurer, ...] = (
    Insurer(no=1, name='ACE', code='ACE'),
    Insurer(no=2, name='AIG', code='AIG'),
    Insurer(no=3, name='건설공제조합', code='CG'),
    Insurer(no=4, name='DB손해보험', code='DB'),
    Insurer(no=5, name='흥국화재', code='HK'),
    Insurer(no=6, name='현대해상', code='HM'),
    Insurer(no=7, name='한화손보', code='HW'),
    Insurer(no=8, name='KB손보', code='KB'),
    Insurer(no=9, name='코리안리', code='KR'),
    Insurer(no=10, name='롯데손보', code='LT'),
    Insurer(no=11, name='MG손보', code='MG'),
    Insurer(no=12, name='미쓰이', code='MSIK'),
    Insurer(no=13, name='메리츠화재', code='MZ'),
    Insurer(no=14, name='농협손보', code='NH'),
    Insurer(no=15, name='삼성화재', code='SS'),
    Insurer(no=16, name='The-K손보', code='TK'),
    Insurer(no=17, name='Qatar General Insurance', code='QGIRC'),
    Insurer(no=18, name="Compagnie d'Assurance des Hydrocarbures", code='CASH'),
    Insurer(no=19, name='Trust Algeria Insurance Company', code='Trust Algeria'),
    Insurer(no=20, name='WAFA Assurance', code='WAFA'),
    Insurer(no=21, name='Kuwait Insurance Company S.A.K', code='Kuwait Insurance'),
    Insurer(no=22, name='Pacific MMI', code='Pacific MMI'),
    Insurer(no=23, name='ABU DHABI NATIONAL INSURANCE COMPANY', code='ADNIC'),
    Insurer(no=24, name="Al.Hamra'a Insurance Company", code="Al.Hamra'a Insurance Company"),
    Insurer(no=25, name='Allianz Global Corporate & Specialty SE KR', code='AGCS KR'),
    Insurer(no=26, name='수협중앙회', code='Suhyup'),
    Insurer(no=27, name='하나손해보험', code='Hana'),
    Insurer(no=None, name='신한 EZ', code='Shinhan EZ'),
)

REINSURERS: tuple[Reinsurer, ...] = (
    Reinsurer(no=1, name='ACE American Fire & Marine Insurance', code='ACE', is_foreign=False),
    Reinsurer(no=2, name='AIG Korea', code='AIG', is_foreign=False),
    Reinsurer(no=3, name='Dongbu Insurance', code='DB', is_foreign=False),
    Reinsurer(no=4, name='Heungkuk Fire & Marine Insurance', code='HK', is_foreign=False),
    Reinsurer(no=5, name='Hyundai Marine & Fire Insurance', code='HM', is_foreign=False),
    Reinsurer(no=6, name='Hanwha General Insurance', code='HW', is_foreign=False),
    Reinsurer(no=7, name='KB Insurance', code='KB', is_foreign=False),
    Reinsurer(no=8, name='Korean Reinsurance Company', code='KR', is_foreign=False),
    Reinsurer(no=9, name='Lotte Insurance', code='LT', is_foreign=False),
    Reinsurer(no=10, name='MG Non-Life Insurance', code='MG', is_foreign=False),
    Reinsurer(no=11, name='Mitsui Sumitomo Insurance', code='MSIG', is_foreign=False),
    Reinsurer(no=12, name='Meritz Fire & Marine Insurance', code='MZ', is_foreign=False),
    Reinsurer(no=13, name='Munich Reinsurance', code='MR KR', is_foreign=False),
    Reinsurer(no=14, name='NongHyup Property & Casualty Insurance', code='NH', is_foreign=False),
    Reinsurer(no=15, name='Samsung Fire & Marine Insurance', code='SS', is_foreign=False),
    Reinsurer(no=16, name='Scor Reinsurance', code='Scor Re KR', is_foreign=False),
    Reinsurer(no=17, name='Scor RE Switzerland AG', code='Scor SW', is_foreign=True),
    Reinsurer(no=18, name='Seoul Guarantee Insurance', code='SGI', is_foreign=False),
    Reinsurer(no=19, name='Swiss Reinsurance', code='SR KR', is_foreign=False),
    Reinsurer(no=21, name='Swiss Re International SE', code="SR Int'l SG", is_foreign=True),
    Reinsurer(no=22, name='Tokio Marine & Nichido Fire Insurance', code='TM SEOUL', is_foreign=False),
    Reinsurer(no=23, name='Allianz Global Corporate & Specialty SE', code='AGCS HK', is_foreign=True),
    Reinsurer(no=26, name='Allied World Assurance Company', code='AWAC SG', is_foreign=True),
    Reinsurer(no=28, name='Amlin Europe N.V.', code='Amlin', is_foreign=True),
    Reinsurer(no=29, name='Antares', code='Antares', is_foreign=True),
    Reinsurer(no=30, name='Arch Reinsurance Eupore U/W DAC', code='Arch', is_foreign=True),
    Reinsurer(no=31, name='Arab Insurance Group(B.S.C.)', code='ARIG', is_foreign=True),
    Reinsurer(no=32, name='ArgoGlobal Asia', code='Argo', is_foreign=True),
    Reinsurer(no=33, name='Ariel Re', code='Ariel Re', is_foreign=True),
    Reinsurer(no=34, name='Ascot', code='Ascot', is_foreign=True),
    Reinsurer(no=35, name='Asia Capital Reinsurance Group', code='ACR SG', is_foreign=True),
    Reinsurer(no=36, name='Asia Capital Reinsurance Group', code='ACR KR', is_foreign=False),
    Reinsurer(no=37, name='Assicurazioni Generali S.P.A', code='Assicurazioni Generali', is_foreign=True),
    Reinsurer(no=38, name='Atrium', code='Atrium', is_foreign=True),
    Reinsurer(no=39, name='Axa Corporate Solutions Assurance', code='AXA SG', is_foreign=True),
    Reinsurer(no=41, name='Berkley Insurance', code='Berkley HK', is_foreign=True),
    Reinsurer(no=43, name='Berkshire Hathaway International Insurance', code='BHSI HK', is_foreign=True),
    Reinsurer(no=45, name='Catlin Insurance Company Limited', code='CICL', is_foreign=True),
    Reinsurer(no=46, name='Central Reinsurance Corporation', code='Central Re', is_foreign=True),
    Reinsurer(no=47, name='China Re', code='China Re', is_foreign=True),
    Reinsurer(no=48, name='Chaucer SG', code='Chaucer SG', is_foreign=True),
    Reinsurer(no=49, name='Emirates Insurance', code='Emirates Insurance', is_foreign=True),
    Reinsurer(no=50, name='Euler Hermes', code='Euler Hermes', is_foreign=True),
    Reinsurer(no=51, name='Financial Insurance Company', code='FICL', is_foreign=True),
    Reinsurer(no=52, name='First Capital Insurance', code='First capital', is_foreign=True),
    Reinsurer(no=53, name='General Insurance Corporation of INDIA', code='GIC', is_foreign=True),
    Reinsurer(no=54, name='Gulf Reinsurance', code='Gulf Re', is_foreign=True),
    Reinsurer(no=55, name='Hannover Rueck SE', code='Hannover Re GM', is_foreign=True),
    Reinsurer(no=58, name='HCC International Insurance Company', code='HCC', is_foreign=True),
    Reinsurer(no=59, name='HDI-Gerling industrie versicherung AG', code='HDI', is_foreign=True),
    Reinsurer(no=60, name='Helvetia Schweizerische Versicherungsgesellschaft AG', code='Helvetia HK', is_foreign=True),
    Reinsurer(no=62, name='India International Insurance', code='III', is_foreign=True),
    Reinsurer(no=63, name='Kuwait Reinsurance', code='Kuwait Re', is_foreign=True),
    Reinsurer(no=64, name='Labuan Reinsurance', code='Labuan Re', is_foreign=True),
    Reinsurer(no=65, name='Liberty Mutual Insurance Europe', code='Liberty HK', is_foreign=True),
    Reinsurer(no=67, name='Malaysian Reinsurance Berhad', code='Malaysian Re', is_foreign=True),
    Reinsurer(no=68, name='Mapfre Reinsurance', code='Mapfre Re', is_foreign=True),
    Reinsurer(no=69, name='Markel Switzerland', code='Markel', is_foreign=True),
    Reinsurer(no=70, name='Montpelier Reinsurance', code='Montpelier', is_foreign=True),
    Reinsurer(no=71, name='MS Amlin AG, Labuan Branch', code='MS Amlin', is_foreign=True),
    Reinsurer(no=72, name='National Insurance', code='National Insurance', is_foreign=True),
    Reinsurer(no=73, name='New India Assurance', code='Newindia', is_foreign=True),
    Reinsurer(no=74, name='Newline', code='Newline', is_foreign=True),
    Reinsurer(no=75, name='Novae Syndicate 2007', code='Novae', is_foreign=True),
    Reinsurer(no=76, name='Odyssey Reinsurance', code='Odyssey Re', is_foreign=True),
    Reinsurer(no=77, name='Partner Reinsurance', code='Partner Re', is_foreign=True),
    Reinsurer(no=78, name='Peak Reinsurance', code='Peak Re', is_foreign=True),
    Reinsurer(no=79, name='PICC Guangdong', code='PICC', is_foreign=True),
    Reinsurer(no=80, name='Qatar Reinsuracne', code='Qatar Re', is_foreign=True),
    Reinsurer(no=81, name='R+V Verischerung AG Re', code='R+V', is_foreign=True),
    Reinsurer(no=82, name='SART Underwriting', code='Sart U/W', is_foreign=True),
    Reinsurer(no=84, name='Saudi Reinsurance', code='Saudi Re', is_foreign=True),
    Reinsurer(no=85, name='SAVA RE', code='SAVA', is_foreign=True),
    Reinsurer(no=86, name='Singapore Reinsurance', code='Singapore Re', is_foreign=True),
    Reinsurer(no=87, name='Sirius International Insurance Corporation', code='Sirius', is_foreign=True),
    Reinsurer(no=88, name='Sompo Canopius', code='Canopius', is_foreign=True),
    Reinsurer(no=89, name='Sompo Japan Nipponkoa Insurance', code='Sompo HK', is_foreign=True),
    Reinsurer(no=91, name='Starr International Insurance', code='Starr HK', is_foreign=True),
    Reinsurer(no=94, name='Tokio Marine Kiln Insurance', code='TM KILN HK', is_foreign=True),
    Reinsurer(no=96, name='Taiping Reinsurance', code='Taiping Re', is_foreign=True),
    Reinsurer(no=97, name='Talbot', code='Talbot', is_foreign=True),
    Reinsurer(no=98, name='Transatlantic Reinsurance', code='Transatlantic Re', is_foreign=True),
    Reinsurer(no=99, name='Triglav Re, Reinsurance', code='Triglav Re', is_foreign=True),
    Reinsurer(no=100, name='Tugu Insurance', code='Tugu', is_foreign=True),
    Reinsurer(no=101, name='Unity Reinsurance', code='Unity Re', is_foreign=True),
    Reinsurer(no=102, name='XL RE Insurance', code='XL RE SG', is_foreign=True),
    Reinsurer(no=103, name='XL Insurance', code='XL SG', is_foreign=True),
    Reinsurer(no=105, name='Zurich Insurance', code='Zurich SG', is_foreign=True),
    Reinsurer(no=107, name='Others', code='Others', is_foreign=True),
    Reinsurer(no=108, name='Tokio Marine Insurance Singapore Ltd.', code='TM SG', is_foreign=True),
    Reinsurer(no=109, name='Allianz SE Reinsurance Branch Asia Pacific', code='', is_foreign=True),
    Reinsurer(no=110, name='QBE Insurance(Singapore) PTE LTD', code='QBE SG', is_foreign=True),
    Reinsurer(no=111, name='Trust International Insurance & Reinsurance , Labuan Branch', code='Trust Re', is_foreign=True),
    Reinsurer(no=112, name='Allianz Global Corporate & Specialty SE KR', code='AGCS KR', is_foreign=False),
)

CURRENCIES: tuple[str, ...] = ('KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'HKD', 'SGD', 'AUD', 'DZD', 'MAD', 'PGK', 'BND')


def _normalize(s: str) -> str:
    return (s or "").strip().lower()


def _strip_corp_suffix(s: str) -> str:
    """Strip common corporate suffixes for fuzzy matching only."""
    import re as _re
    out = s
    for pat in (
        r"\s*co\.?,?\s*ltd\.?$",
        r"\s*co\.,?\s*ltd\.?$",
        r"\s*company$",
        r"\s*corp(?:oration)?\.?$",
        r"\s*inc\.?$",
        r"\s*ltd\.?$",
        r"\s*limited$",
        r"\s*plc$",
    ):
        out = _re.sub(pat, "", out, flags=_re.IGNORECASE).strip()
    return out


def find_reinsurer(query: str) -> Reinsurer | None:
    """Match a reinsurer by exact code or name (case-insensitive).

    Falls back through three increasingly loose stages so AI-extracted
    names that wrap or strip corporate suffixes still match the canonical
    Excel form:
      1. exact code or name
      2. corporate-suffix-stripped equality (e.g. "Korean Reinsurance
         Company" matches Excel "Korean Reinsurance")
      3. bidirectional substring (longer query wraps shorter canonical
         and vice versa)
    """
    if not query:
        return None
    q = _normalize(query)
    for ri in REINSURERS:
        if _normalize(ri.code) == q or _normalize(ri.name) == q:
            return ri
    qs = _strip_corp_suffix(q)
    for ri in REINSURERS:
        ns = _strip_corp_suffix(_normalize(ri.name))
        if ns and (ns == qs):
            return ri
    for ri in REINSURERS:
        n = _normalize(ri.name)
        c = _normalize(ri.code)
        if q in n or n in q or q in c:
            return ri
    return None


def find_insurer(query: str) -> Insurer | None:
    """Match an insurer by exact code or name (case-insensitive)."""
    if not query:
        return None
    q = _normalize(query)
    for ins in INSURERS:
        if _normalize(ins.code) == q or _normalize(ins.name) == q:
            return ins
    qs = _strip_corp_suffix(q)
    for ins in INSURERS:
        ns = _strip_corp_suffix(_normalize(ins.name))
        if ns and (ns == qs):
            return ins
    for ins in INSURERS:
        n = _normalize(ins.name)
        c = _normalize(ins.code)
        if q in n or n in q or q in c:
            return ins
    return None


def canonicalize_company_name(name: str) -> str:
    """Return the canonical (Title-Case, no extra suffix) form of a company
    name, matched against the Excel-derived insurer/reinsurer tables.

    Used to normalize AI-extracted strings like "KOREAN REINSURANCE COMPANY"
    that come straight off the source PDF in all-caps. If the name doesn't
    match any known entity, return the original input unchanged so we don't
    silently mangle unfamiliar reinsurers.
    """
    if not name:
        return name
    ri = find_reinsurer(name)
    if ri is not None:
        return ri.name
    ins = find_insurer(name)
    if ins is not None:
        return ins.name
    return name


def is_foreign_reinsurer(name_or_code: str) -> bool:
    """Return True if the reinsurer requires English-only slip text."""
    if not name_or_code:
        return False
    ri = find_reinsurer(name_or_code)
    if ri is not None:
        return ri.is_foreign
    import re as _re
    s = name_or_code.strip()
    if _re.search(r"[㄰-㆏가-힯]", s):
        return False
    sl = s.lower()
    if _re.search(r"\bkorea(n)?\b", sl) or _re.search(r"\bseoul\b", sl):
        return False
    if sl.endswith(" kr") or sl.endswith(" korea"):
        return False
    return True
