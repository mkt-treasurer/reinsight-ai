"""Reinsurer short code → full name mapping."""

# Base mapping from known abbreviations
REINSURER_NAMES = {
    "AIG": "AIG Korea Inc.",
    "AIG KR": "AIG Korea Inc.",
    "ACE": "ACE American Fire & Marine Insurance",
    "ACE KR": "ACE American Fire & Marine Insurance",
    "AGCS KR": "Allianz Global Corporate & Specialty SE Korea",
    "AGCS SG": "Allianz Global Corporate & Specialty SE Singapore",
    "AWAC": "Allied World Assurance Company, Hong Kong Branch",
    "AWAC SG": "Allied World Assurance Company, Singapore Branch",
    "Arch Re": "Arch Reinsurance Ltd.",
    "Berkley SG": "Berkley Insurance Asia",
    "Berkely SG": "Berkley Insurance Asia",
    "Best Re": "Best Reinsurance",
    "CG SG": "China Reinsurance Group (Singapore Branch)",
    "GAIC SG": "Great American Insurance Company (Singapore Branch)",
    "Great American SG": "Great American Insurance Company (Singapore Branch)",
    "Hannover Re": "Hannover Rueck SE",
    "Hannover Re GM": "Hannover Rueck SE",
    "Hannover Re MY": "Hannover Rueck SE Malaysian Branch",
    "HDI SG": "HDI Global SE Hong Kong",
    "Helvetia CH": "Helvetia Swiss Insurance Company",
    "Helvetia SZ": "Helvetia Swiss Insurance Company",
    "HM": "Hyundai Marine & Fire Insurance",
    "III": "Insurance Ireland International",
    "Kiln HK": "Tokio Marine Kiln Insurance, Hong Kong Branch",
    "Liberty HK": "Liberty Specialty Markets (Hong Kong Branch)",
    "MR KR": "Munich Re Korea Branch",
    "MSIG": "Mitsui Sumitomo Insurance",
    "NH": "NongHyup Property & Casualty Insurance Co., Ltd.",
    "Newline SG": "Newline Insurance Company Singapore Branch",
    "Peak Re": "Peak Reinsurance",
    "Peak Re HK": "Peak Reinsurance Company Limited",
    "PVI Re": "PVI Reinsurance",
    "QBE SG": "QBE Insurance (Singapore) PTE LTD",
    "SCOR Re": "SCOR Reinsurance",
    "SR KR": "Swiss Reinsurance Korea",
    "SS": "Samsung Fire & Marine Insurance",
    "Shinhan EZ": "Shinhan EZ General Insurance",
    "Starr SG": "Starr International Insurance Singapore",
    "TM Seoul": "Tokio Marine & Nichido Fire Insurance",
    "TM KR": "Tokio Marine & Nichido Fire Insurance",
    "Tugu": "Tugu Insurance",
    "Tugu HK": "Tugu Insurance Hong Kong Branch",
    "Zurich": "Zurich Insurance (Singapore Branch)",
    "Zurich SG": "Zurich Insurance (Singapore Branch)",
}


def resolve_full_name(short_code: str) -> str:
    """Resolve short reinsurer code to full name.

    Priority order:
    1. Excel-derived code_table (canonical, no extra "Co., Ltd." suffix
       unless it appears in the Excel) — this is the SoT humans hand-type
       slips against, so it should win.
    2. Legacy REINSURER_NAMES map below — keeps codes/aliases the Excel
       doesn't cover (e.g. "AWAC" → Hong Kong branch, "Hannover Re GM").
    3. Pass-through if neither has a match.
    """
    if not short_code:
        return short_code
    # 1. code_table first — canonical Excel form
    try:
        from app.data.code_table import find_reinsurer
        ri = find_reinsurer(short_code)
        if ri is not None:
            return ri.name
    except Exception:
        pass
    # 2. Exact match in legacy map
    if short_code in REINSURER_NAMES:
        return REINSURER_NAMES[short_code]
    # Case-insensitive match
    for k, v in REINSURER_NAMES.items():
        if k.lower() == short_code.lower():
            return v
    # 3. Already a full name (longer than typical code) → leave as-is
    if len(short_code) > 15:
        return short_code
    return short_code
