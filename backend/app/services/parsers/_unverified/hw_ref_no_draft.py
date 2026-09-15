"""HW (Hanwha General Insurance) reference-number draft parser.

Phase 2 미진입 코드. 픽스처 0건, DB query (515건의 ``claims``
row, 2026-05-04) + 영업팀 메일 1건 (``C2023020370509-1-16``) 만을
근거로 정규식을 추론한 상태입니다.

**import 금지.** Phase 2 진입 시 실 HW 보더루/SOC 픽스처를 받아
다음을 재검증한 뒤 ``ref_no_parser`` 본 모듈로 승격하세요:

- ``RF`` 접두 의미 (Reinsurance Facultative? Re-Filing? — 미확인)
- ``(Cargo)`` / ``(Hull)`` 태그가 라인코드(letter)와 어떻게
  관계하는지 (``E=Cargo``, ``I=Hull`` 추측은 데이터에 모순됨)
- C-prefix dash 세그먼트 의미 (``-1-2-2012100301`` 처럼 가변
  segment 구조의 정확한 스키마)
- YY 2자리 연도 윈도우 (현재 ``YY <= 50 → 20YY`` 임의 cutoff)
- 메일 사례 ``20260413171106853750`` 같은 timestamp 합성 — 우리
  코드 산출물 아님이 확인됐지만 외부 시스템에서 오는지 미확인

이 모듈의 함수를 호출하면 그 결과는 검증되지 않은 추정값이라는
점을 호출 측이 인지해야 합니다. 잘못된 매칭이 발생할 경우 본
모듈을 비활성화하고 결정론 파이프라인 외부에서 처리하세요.
"""

from __future__ import annotations

import re
from typing import Optional

from ..errors import RefNoParseError
from ..ref_no_parser import ParsedRefNo


# Modern 11-digit shape: YY + MM + DD + 5-digit serial
_HW_MODERN = re.compile(r"^(?P<yy>\d{2})(?P<mm>\d{2})(?P<dd>\d{2})(?P<serial>\d{5})$")

# Older lettered shape: YYYY + MM + single uppercase letter (line code) +
# 3 to 4 digit serial, optionally followed by a parenthetical line tag
# such as (Cargo) or (Hull).
_HW_LETTERED = re.compile(
    r"^(?P<year>\d{4})(?P<mm>\d{2})(?P<lc>[A-Z])(?P<serial>\d{3,4})(?P<tag>\([A-Za-z]+\))?$"
)

# Reinsurance Facultative prefix
_HW_RF = re.compile(r"^RF(?P<serial>\d{9})$")

# Legacy C-prefixed structured ref. UNVERIFIED segment semantics.
_HW_C = re.compile(
    r"^C(?P<year>\d{4})(?P<mm>\d{2})(?P<rest>\d{2}\d+)(?P<segs>(?:-\d+)+)$"
)

_HW_SENTINELS = frozenset({"2nd", "3rd", "3rd & Final"})

# 2-digit-year window: YY ≤ 50 read as 20YY, the rest as 19YY. Cutoff
# is provisional and based on the absence of pre-2010 modern-format data
# in the current sample.
_HW_YY_CUTOFF = 50


def _is_event_name(s: str) -> bool:
    """Catastrophe names like 'Typhoon CHABA' aren't ref numbers."""
    return bool(re.match(r"^(Typhoon|Earthquake|Storm|Cyclone|Hurricane)\b", s, re.IGNORECASE))


def _clean(raw: str) -> str:
    if raw is None:
        raise RefNoParseError("ref_no is None")
    s = str(raw).strip()
    if not s:
        raise RefNoParseError("ref_no is empty")
    return re.sub(r"\s+", " ", s)


def parse_hw_ref_no_draft(raw: str) -> ParsedRefNo:
    """**UNVERIFIED**. Parse a Hanwha (HW) reference number.

    Recognised shapes (priority order):
    1. Modern 11-digit ``YYMMDDNNNNN`` (97% of production data).
    2. Older lettered ``YYYYMM<L>NNNN`` with optional ``(Cargo)`` /
       ``(Hull)`` tag.
    3. Facultative ``RF`` + 9 digits.
    4. Legacy ``C{YYYYMMDD}{serial}-{seg}+`` with variable trailing
       dash-separated segments.

    Sentinel labels (``2nd``, ``Typhoon CHABA``) are returned with
    ``is_sentinel=True``.

    DO NOT import or call from production code paths. See module
    docstring for the verification gaps.
    """
    s = _clean(raw)

    if s in _HW_SENTINELS or _is_event_name(s):
        return ParsedRefNo(
            raw=raw,
            cedant="HW",
            normalized=s,
            key=s,
            format_variant="sentinel",
            is_sentinel=True,
        )

    if m := _HW_MODERN.match(s):
        yy = int(m.group("yy"))
        year = (2000 + yy) if yy <= _HW_YY_CUTOFF else (1900 + yy)
        month = int(m.group("mm"))
        day = int(m.group("dd"))
        notes: list[str] = []
        month_out = month if 1 <= month <= 12 else None
        day_out = day if month_out is not None and 1 <= day <= 31 else None
        if month_out is None:
            notes.append(f"invalid month {month:02d}")
        elif day_out is None:
            notes.append(f"invalid day {day:02d}")
        return ParsedRefNo(
            raw=raw,
            cedant="HW",
            normalized=s,
            key=s,
            format_variant="hw_modern",
            year=year,
            month=month_out,
            day=day_out,
            serial=m.group("serial"),
            notes=tuple(notes),
        )

    if m := _HW_LETTERED.match(s):
        year = int(m.group("year"))
        month = int(m.group("mm"))
        notes = []
        if not (1900 <= year <= 2100):
            raise RefNoParseError(f"HW lettered ref year out of range: {year}")
        month_out = month if 1 <= month <= 12 else None
        if month_out is None:
            notes.append(f"invalid month {month:02d}")
        if m.group("tag"):
            notes.append(f"line tag {m.group('tag')!r}")
        return ParsedRefNo(
            raw=raw,
            cedant="HW",
            normalized=s,
            key=s,
            format_variant="hw_lettered",
            year=year,
            month=month_out,
            day=None,
            serial=m.group("serial"),
            line_code=m.group("lc"),
            notes=tuple(notes),
        )

    if m := _HW_RF.match(s):
        return ParsedRefNo(
            raw=raw,
            cedant="HW",
            normalized=s,
            key=s,
            format_variant="hw_rf",
            serial=m.group("serial"),
        )

    if m := _HW_C.match(s):
        year = int(m.group("year"))
        month = int(m.group("mm"))
        notes = []
        if not (1900 <= year <= 2100):
            raise RefNoParseError(f"HW C-prefixed ref year out of range: {year}")
        month_out = month if 1 <= month <= 12 else None
        if month_out is None:
            notes.append(f"invalid month {month:02d}")
        segs = [seg for seg in m.group("segs").split("-") if seg]
        revision: Optional[int] = None
        if segs:
            try:
                revision = int(segs[-1])
            except ValueError:
                notes.append(f"non-integer trailing segment: {segs[-1]!r}")
        notes.append(f"trailing segments: {segs}")
        return ParsedRefNo(
            raw=raw,
            cedant="HW",
            normalized=s,
            key=s,
            format_variant="hw_c",
            year=year,
            month=month_out,
            day=None,
            serial=m.group("rest"),
            revision=revision,
            notes=tuple(notes),
        )

    raise RefNoParseError(f"HW ref_no does not match any known pattern: {raw!r}")
