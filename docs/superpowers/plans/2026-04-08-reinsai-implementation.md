# ReinsAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reinsurance settlement automation demo with Excel data import, bordereaux reconciliation, dashboard, and AI-powered natural language queries.

**Architecture:** Next.js frontend talks to FastAPI backend, which reads Excel files into PostgreSQL and provides REST APIs. Gemini Flash handles natural language → SQL → answer pipeline.

**Tech Stack:** Next.js 15, FastAPI, PostgreSQL 16, SQLAlchemy, openpyxl, google-generativeai, Docker Compose, Tailwind CSS, Recharts

---

## File Structure

```
reinsai/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app, lifespan, CORS
│   │   ├── config.py                  # Settings from env
│   │   ├── database.py                # SQLAlchemy engine, session
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── contract.py            # Contract ORM model
│   │   │   ├── claim.py               # Claim ORM model
│   │   │   └── cover_note.py          # CoverNote ORM model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── contract.py            # Pydantic schemas
│   │   │   ├── claim.py
│   │   │   ├── dashboard.py
│   │   │   ├── reconciliation.py
│   │   │   └── chat.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── contracts.py           # GET /api/contracts
│   │   │   ├── claims.py              # GET /api/claims
│   │   │   ├── dashboard.py           # GET /api/dashboard/*
│   │   │   ├── reconciliation.py      # GET /api/reconciliation/*
│   │   │   ├── chat.py                # POST /api/chat
│   │   │   └── data.py                # POST /api/data/import
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── importer.py            # Excel parsing + DB insert
│   │       ├── reconciliation.py      # Matching + anomaly detection
│   │       └── ai_chat.py             # Gemini text-to-SQL
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_importer.py
│   │   └── test_reconciliation.py
│   └── data/                          # Excel mount point
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   └── src/
│       ├── app/
│       │   ├── layout.tsx             # Root layout + sidebar
│       │   ├── page.tsx               # Dashboard
│       │   ├── contracts/
│       │   │   └── page.tsx
│       │   ├── claims/
│       │   │   └── page.tsx
│       │   ├── reconciliation/
│       │   │   └── page.tsx
│       │   └── chat/
│       │       └── page.tsx
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── StatCard.tsx
│       │   ├── DataTable.tsx          # Reusable table with pagination/filter
│       │   ├── ChartCard.tsx
│       │   └── ChatMessage.tsx
│       └── lib/
│           └── api.ts                 # Fetch wrapper
└── reference/                         # Source Excel files (gitignored)
```

---

### Task 1: Project Scaffolding + Docker

**Files:**
- Create: `docker-compose.yml`
- Create: `.env`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `frontend/Dockerfile`
- Create: `frontend/package.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.mjs`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`

- [ ] **Step 1: Create .gitignore**

```gitignore
# Python
__pycache__/
*.pyc
.venv/

# Node
node_modules/
.next/

# Env
.env

# Data
reference/
backend/data/*.xlsx
```

- [ ] **Step 2: Create .env and .env.example**

`.env`:
```
DATABASE_URL=postgresql+asyncpg://reinsai:reinsai@postgres:5432/reinsai
GEMINI_API_KEY=<실제 키 — 이 문서에는 적지 않는다>
```

`.env.example`:
```
DATABASE_URL=postgresql+asyncpg://reinsai:reinsai@postgres:5432/reinsai
GEMINI_API_KEY=your-gemini-api-key-here
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: reinsai
      POSTGRES_PASSWORD: reinsai
      POSTGRES_DB: reinsai
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U reinsai"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    environment:
      - DATABASE_URL=postgresql+asyncpg://reinsai:reinsai@postgres:5432/reinsai
    volumes:
      - ./backend/app:/app/app
      - ./reference:/app/data
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    volumes:
      - ./frontend/src:/app/src
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 4: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 5: Create backend/requirements.txt**

```
fastapi==0.115.12
uvicorn[standard]==0.34.2
sqlalchemy[asyncio]==2.0.40
asyncpg==0.30.0
psycopg2-binary==2.9.10
openpyxl==3.1.5
google-generativeai==0.8.5
pydantic-settings==2.8.1
python-multipart==0.0.20
```

- [ ] **Step 6: Create backend/app/__init__.py, config.py, main.py**

`backend/app/__init__.py`: empty file

`backend/app/config.py`:
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://reinsai:reinsai@postgres:5432/reinsai"
    gemini_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
```

`backend/app/main.py`:
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="ReinsAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Create frontend scaffolding**

Run:
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Then create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]
```

- [ ] **Step 8: Verify Docker Compose starts**

Run:
```bash
docker compose up --build -d
```

Expected: All 3 containers running. `curl http://localhost:8000/api/health` returns `{"status":"ok"}`. `http://localhost:3000` shows Next.js page.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffolding with Docker Compose (Next.js + FastAPI + PostgreSQL)"
```

---

### Task 2: Database Models + Migration

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/contract.py`
- Create: `backend/app/models/claim.py`
- Create: `backend/app/models/cover_note.py`

- [ ] **Step 1: Create database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    from app.models import contract, claim, cover_note  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
```

- [ ] **Step 2: Create contract model**

`backend/app/models/__init__.py`: empty file

`backend/app/models/contract.py`:
```python
from sqlalchemy import Column, Integer, String, Numeric, Date, Text
from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    year = Column(Integer, index=True)
    cont_month = Column(String(20))
    no = Column(String(20))
    cover_note_no = Column(String(50), index=True)
    assured = Column(String(200))
    project_name = Column(String(200))
    line = Column(String(50), index=True)
    line2 = Column(String(50))
    new_renew = Column(String(10))
    renewable = Column(String(10))
    retail = Column(String(10))
    original_cedant = Column(String(50))
    cedant = Column(String(50), index=True)
    period_from = Column(Date)
    period_to = Column(Date)
    installment = Column(String(20))
    ppw = Column(String(50))
    currency = Column(String(10))
    gross_prem_100 = Column(Numeric)
    gross_prem_inst = Column(Numeric)
    reinsurer = Column(String(50), index=True)
    share = Column(Numeric)
    ri_prem = Column(Numeric)
    ri_commission = Column(Numeric)
    net_ri_prem = Column(Numeric)
    net_ri_prem_kwon = Column(Numeric)
    net_to_uwr = Column(Numeric)
    rec_date = Column(Date)
    paid_date = Column(Date)
    co_brokerage = Column(Numeric)
    partner = Column(String(100))
    remarks = Column(Text)
```

- [ ] **Step 3: Create claim model**

`backend/app/models/claim.py`:
```python
from sqlalchemy import Column, Integer, String, Numeric, Date, Text
from app.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sheet_name = Column(String(20))
    booking_month = Column(String(20))
    soc_received = Column(String(50))
    soc_sent = Column(String(50))
    account_name = Column(String(200), index=True)
    line = Column(String(50), index=True)
    policy_period = Column(Date)
    dol = Column(Date)
    reinsurer = Column(String(50), index=True)
    currency = Column(String(10))
    total_amount = Column(Numeric)
    share = Column(Numeric)
    origin_currency = Column(Numeric)
    roe = Column(Numeric)
    krw_amount = Column(Numeric)
    soc_amount = Column(Numeric)
    cedant = Column(String(50), index=True)
    status = Column(String(20), index=True)
    received_date = Column(Date)
    paid_date = Column(Date)
    account_mgr = Column(String(50))
    ref_no = Column(String(100), index=True)
    remarks = Column(Text)
```

- [ ] **Step 4: Create cover_note model**

`backend/app/models/cover_note.py`:
```python
from sqlalchemy import Column, Integer, String, Date, Text
from app.database import Base


class CoverNote(Base):
    __tablename__ = "cover_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issuing_date = Column(Date)
    cover_note_number = Column(String(50), index=True)
    assured = Column(String(200))
    reassured = Column(String(50))
    line = Column(String(50))
    account = Column(String(50))
    remarks = Column(Text)
```

- [ ] **Step 5: Verify tables created**

Run:
```bash
docker compose up --build -d
docker compose exec postgres psql -U reinsai -c "\dt"
```

Expected: Tables `contracts`, `claims`, `cover_notes` listed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/database.py backend/app/models/
git commit -m "feat: database models for contracts, claims, cover_notes"
```

---

### Task 3: Excel Import Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/importer.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/data.py`
- Modify: `backend/app/main.py` (add router)

- [ ] **Step 1: Create importer service**

`backend/app/services/__init__.py`: empty file

`backend/app/services/importer.py`:
```python
import logging
from datetime import datetime
from pathlib import Path

import openpyxl
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.claim import Claim
from app.models.cover_note import CoverNote

logger = logging.getLogger(__name__)

DATA_DIR = Path("/app/data")

# AI계약관리.xlsx header row is row 8, data starts row 9
CONTRACT_HEADER_ROW = 8
CONTRACT_COL_MAP = {
    "A": "cont_month",
    "B": "no",
    "C": "cover_note_no",
    "D": "assured",
    "E": "project_name",
    "F": "line",
    "G": "line2",
    "H": "new_renew",
    "I": "renewable",
    "J": "retail",
    "K": "original_cedant",
    "L": "cedant",
    "M": "period_from",
    "N": "period_to",
    "O": "installment",
    "P": "ppw",
    "Q": "currency",
    "R": "gross_prem_100",
    "S": "gross_prem_inst",
    "T": "reinsurer",
    "U": "share",
    "V": "ri_prem",
    "W": "ri_commission",
    "X": "net_ri_prem",
    "Y": "net_ri_prem_kwon",
    "Z": "net_to_uwr",
    "AA": "rec_date",
    "AB": "paid_date",
    "AC": "co_brokerage",
    "AD": "partner",
}

# Claim list header row is row 2
CLAIM_COL_MAP = {
    "B": "booking_month",
    "C": "soc_received",
    "D": "soc_sent",
    "E": "account_name",
    "F": "line",
    "G": "policy_period",
    "H": "dol",
    "I": "reinsurer",
    "J": "currency",
    "K": "total_amount",
    "L": "share",
    "M": "origin_currency",
    "N": "roe",
    "O": "krw_amount",
    "P": "soc_amount",
    "Q": "cedant",
    "R": "status",
    "S": "received_date",
    "T": "paid_date",
    "U": "account_mgr",
    "V": "remarks",
    "W": "ref_no",
}


def _safe_date(val):
    if isinstance(val, datetime):
        return val.date()
    return None


def _safe_numeric(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return val
    try:
        return float(str(val).replace(",", ""))
    except (ValueError, TypeError):
        return None


def _safe_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


async def import_contracts(db: AsyncSession):
    """Import AI계약관리.xlsx into contracts table."""
    file_path = DATA_DIR / "보험료" / "AI계약관리.xlsx"
    if not file_path.exists():
        logger.warning(f"Contract file not found: {file_path}")
        return 0

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    count = 0

    for sheet_name in wb.sheetnames:
        if not sheet_name.startswith("Actual"):
            continue

        year_str = sheet_name.replace("Actual", "")
        try:
            year = int(year_str)
        except ValueError:
            continue

        ws = wb[sheet_name]
        for row_idx, row in enumerate(ws.iter_rows(min_row=CONTRACT_HEADER_ROW + 1, values_only=False), start=CONTRACT_HEADER_ROW + 1):
            cells = {cell.column_letter if len(cell.column_letter) == 1 else (chr(64 + cell.column // 27) + chr(64 + cell.column % 27) if cell.column > 26 else cell.column_letter): cell.value for cell in row}

            # Build column letter mapping
            cell_map = {}
            for cell in row:
                col_idx = cell.column
                if col_idx <= 26:
                    letter = chr(64 + col_idx)
                else:
                    letter = chr(64 + (col_idx - 1) // 26) + chr(65 + (col_idx - 1) % 26)
                cell_map[letter] = cell.value

            # Skip empty rows
            if not cell_map.get("C") and not cell_map.get("D"):
                continue

            contract = Contract(
                year=year,
                cont_month=_safe_str(cell_map.get("A")),
                no=_safe_str(cell_map.get("B")),
                cover_note_no=_safe_str(cell_map.get("C")),
                assured=_safe_str(cell_map.get("D")),
                project_name=_safe_str(cell_map.get("E")),
                line=_safe_str(cell_map.get("F")),
                line2=_safe_str(cell_map.get("G")),
                new_renew=_safe_str(cell_map.get("H")),
                renewable=_safe_str(cell_map.get("I")),
                retail=_safe_str(cell_map.get("J")),
                original_cedant=_safe_str(cell_map.get("K")),
                cedant=_safe_str(cell_map.get("L")),
                period_from=_safe_date(cell_map.get("M")),
                period_to=_safe_date(cell_map.get("N")),
                installment=_safe_str(cell_map.get("O")),
                ppw=_safe_str(cell_map.get("P")),
                currency=_safe_str(cell_map.get("Q")),
                gross_prem_100=_safe_numeric(cell_map.get("R")),
                gross_prem_inst=_safe_numeric(cell_map.get("S")),
                reinsurer=_safe_str(cell_map.get("T")),
                share=_safe_numeric(cell_map.get("U")),
                ri_prem=_safe_numeric(cell_map.get("V")),
                ri_commission=_safe_numeric(cell_map.get("W")),
                net_ri_prem=_safe_numeric(cell_map.get("X")),
                net_ri_prem_kwon=_safe_numeric(cell_map.get("Y")),
                net_to_uwr=_safe_numeric(cell_map.get("Z")),
                rec_date=_safe_date(cell_map.get("AA")),
                paid_date=_safe_date(cell_map.get("AB")),
                co_brokerage=_safe_numeric(cell_map.get("AC")),
                partner=_safe_str(cell_map.get("AD")),
            )
            db.add(contract)
            count += 1

            if count % 500 == 0:
                await db.flush()

    await db.commit()
    wb.close()
    logger.info(f"Imported {count} contracts")
    return count


async def import_claims(db: AsyncSession):
    """Import Claim list(통합) & pending List.xlsx into claims table."""
    file_path = DATA_DIR / "보험금" / "Claim list(통합) & pending List.xlsx"
    if not file_path.exists():
        logger.warning(f"Claims file not found: {file_path}")
        return 0

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    count = 0

    # Only import from ALL sheet to avoid duplicates
    if "ALL" not in wb.sheetnames:
        wb.close()
        return 0

    ws = wb["ALL"]
    for row_idx, row in enumerate(ws.iter_rows(min_row=3, values_only=False), start=3):
        cell_map = {}
        for cell in row:
            col_idx = cell.column
            if col_idx <= 26:
                letter = chr(64 + col_idx)
            else:
                letter = chr(64 + (col_idx - 1) // 26) + chr(65 + (col_idx - 1) % 26)
            cell_map[letter] = cell.value

        # Skip empty rows
        if not cell_map.get("E") and not cell_map.get("I"):
            continue

        claim = Claim(
            sheet_name="ALL",
            booking_month=_safe_str(cell_map.get("B")),
            soc_received=_safe_str(cell_map.get("C")),
            soc_sent=_safe_str(cell_map.get("D")),
            account_name=_safe_str(cell_map.get("E")),
            line=_safe_str(cell_map.get("F")),
            policy_period=_safe_date(cell_map.get("G")),
            dol=_safe_date(cell_map.get("H")),
            reinsurer=_safe_str(cell_map.get("I")),
            currency=_safe_str(cell_map.get("J")),
            total_amount=_safe_numeric(cell_map.get("K")),
            share=_safe_numeric(cell_map.get("L")),
            origin_currency=_safe_numeric(cell_map.get("M")),
            roe=_safe_numeric(cell_map.get("N")),
            krw_amount=_safe_numeric(cell_map.get("O")),
            soc_amount=_safe_numeric(cell_map.get("P")),
            cedant=_safe_str(cell_map.get("Q")),
            status=_safe_str(cell_map.get("R")),
            received_date=_safe_date(cell_map.get("S")),
            paid_date=_safe_date(cell_map.get("T")),
            account_mgr=_safe_str(cell_map.get("U")),
            remarks=_safe_str(cell_map.get("V")),
            ref_no=_safe_str(cell_map.get("W")),
        )
        db.add(claim)
        count += 1

        if count % 500 == 0:
            await db.flush()

    await db.commit()
    wb.close()
    logger.info(f"Imported {count} claims")
    return count


async def import_cover_notes(db: AsyncSession):
    """Import Cover Note.xlsx into cover_notes table."""
    file_path = DATA_DIR / "보험료" / "Cover Note.xlsx"
    if not file_path.exists():
        logger.warning(f"Cover note file not found: {file_path}")
        return 0

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    count = 0

    ws = wb[wb.sheetnames[0]]
    for row_idx, row in enumerate(ws.iter_rows(min_row=4, values_only=False), start=4):
        cell_map = {}
        for cell in row:
            col_idx = cell.column
            letter = chr(64 + col_idx)
            cell_map[letter] = cell.value

        if not cell_map.get("B"):
            continue

        cn = CoverNote(
            issuing_date=_safe_date(cell_map.get("A")),
            cover_note_number=_safe_str(cell_map.get("B")),
            assured=_safe_str(cell_map.get("C")),
            reassured=_safe_str(cell_map.get("D")),
            line=_safe_str(cell_map.get("E")),
            account=_safe_str(cell_map.get("F")),
            remarks=_safe_str(cell_map.get("G")),
        )
        db.add(cn)
        count += 1

    await db.commit()
    wb.close()
    logger.info(f"Imported {count} cover notes")
    return count


async def import_all(db: AsyncSession):
    """Run full import. Clears existing data first."""
    await db.execute(text("TRUNCATE contracts, claims, cover_notes RESTART IDENTITY"))
    await db.commit()

    contracts = await import_contracts(db)
    claims = await import_claims(db)
    cover_notes = await import_cover_notes(db)

    return {"contracts": contracts, "claims": claims, "cover_notes": cover_notes}
```

- [ ] **Step 2: Create data router**

`backend/app/routers/__init__.py`: empty file

`backend/app/routers/data.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.importer import import_all

router = APIRouter(prefix="/api/data", tags=["data"])


@router.post("/import")
async def run_import(db: AsyncSession = Depends(get_db)):
    result = await import_all(db)
    return {"status": "completed", "counts": result}
```

- [ ] **Step 3: Register router and add auto-import on startup**

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, async_session
from app.routers import data
from app.services.importer import import_all

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Auto-import on startup
    async with async_session() as db:
        try:
            result = await import_all(db)
            logger.info(f"Auto-import completed: {result}")
        except Exception as e:
            logger.error(f"Auto-import failed: {e}")
    yield


app = FastAPI(title="ReinsAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Test import by restarting backend**

Run:
```bash
docker compose up --build -d
docker compose logs -f backend
```

Expected: Logs show "Imported N contracts", "Imported N claims", "Imported N cover notes". Then verify:
```bash
docker compose exec postgres psql -U reinsai -c "SELECT count(*) FROM contracts;"
docker compose exec postgres psql -U reinsai -c "SELECT count(*) FROM claims;"
docker compose exec postgres psql -U reinsai -c "SELECT count(*) FROM cover_notes;"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ backend/app/routers/ backend/app/main.py
git commit -m "feat: Excel import service for contracts, claims, cover_notes"
```

---

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/contract.py`
- Create: `backend/app/schemas/claim.py`
- Create: `backend/app/schemas/dashboard.py`
- Create: `backend/app/schemas/reconciliation.py`
- Create: `backend/app/schemas/chat.py`

- [ ] **Step 1: Create all schemas**

`backend/app/schemas/__init__.py`: empty file

`backend/app/schemas/contract.py`:
```python
from datetime import date
from pydantic import BaseModel


class ContractOut(BaseModel):
    id: int
    year: int | None = None
    cont_month: str | None = None
    no: str | None = None
    cover_note_no: str | None = None
    assured: str | None = None
    project_name: str | None = None
    line: str | None = None
    line2: str | None = None
    new_renew: str | None = None
    currency: str | None = None
    gross_prem_100: float | None = None
    gross_prem_inst: float | None = None
    reinsurer: str | None = None
    share: float | None = None
    ri_prem: float | None = None
    ri_commission: float | None = None
    net_ri_prem: float | None = None
    cedant: str | None = None
    period_from: date | None = None
    period_to: date | None = None
    rec_date: date | None = None
    paid_date: date | None = None
    partner: str | None = None
    remarks: str | None = None

    class Config:
        from_attributes = True


class ContractListResponse(BaseModel):
    items: list[ContractOut]
    total: int
    page: int
    page_size: int
```

`backend/app/schemas/claim.py`:
```python
from datetime import date
from pydantic import BaseModel


class ClaimOut(BaseModel):
    id: int
    booking_month: str | None = None
    soc_received: str | None = None
    soc_sent: str | None = None
    account_name: str | None = None
    line: str | None = None
    dol: date | None = None
    reinsurer: str | None = None
    currency: str | None = None
    total_amount: float | None = None
    share: float | None = None
    krw_amount: float | None = None
    soc_amount: float | None = None
    cedant: str | None = None
    status: str | None = None
    received_date: date | None = None
    paid_date: date | None = None
    account_mgr: str | None = None
    ref_no: str | None = None
    remarks: str | None = None

    class Config:
        from_attributes = True


class ClaimListResponse(BaseModel):
    items: list[ClaimOut]
    total: int
    page: int
    page_size: int
```

`backend/app/schemas/dashboard.py`:
```python
from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_contracts: int
    total_claims: int
    total_premium_krw: float
    total_claims_krw: float
    open_claims: int
    closed_claims: int
    unique_reinsuers: int
    unique_cedants: int


class ChartDataPoint(BaseModel):
    label: str
    value: float


class DashboardCharts(BaseModel):
    premium_by_month: list[ChartDataPoint]
    claims_by_line: list[ChartDataPoint]
    premium_by_reinsurer: list[ChartDataPoint]
    claims_by_status: list[ChartDataPoint]
```

`backend/app/schemas/reconciliation.py`:
```python
from pydantic import BaseModel


class ReconciliationMatch(BaseModel):
    contract_id: int
    claim_id: int
    assured: str | None = None
    reinsurer: str | None = None
    premium_amount: float | None = None
    claim_amount: float | None = None
    difference: float | None = None
    match_type: str  # "exact", "partial", "mismatch"


class ReconciliationAnomaly(BaseModel):
    type: str  # "missing_claim", "missing_contract", "amount_mismatch", "duplicate"
    description: str
    contract_id: int | None = None
    claim_id: int | None = None
    amount: float | None = None


class ReconciliationSummary(BaseModel):
    total_contracts: int
    total_claims: int
    matched: int
    unmatched_contracts: int
    unmatched_claims: int
    anomalies_count: int
    total_premium: float
    total_claims_amount: float
    difference: float


class ReconciliationResult(BaseModel):
    summary: ReconciliationSummary
    matches: list[ReconciliationMatch]
    anomalies: list[ReconciliationAnomaly]
```

`backend/app/schemas/chat.py`:
```python
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    sql_query: str | None = None
    data: list[dict] | None = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: Pydantic schemas for all API responses"
```

---

### Task 5: Backend API Routers (Contracts, Claims, Dashboard)

**Files:**
- Create: `backend/app/routers/contracts.py`
- Create: `backend/app/routers/claims.py`
- Create: `backend/app/routers/dashboard.py`
- Modify: `backend/app/main.py` (register routers)

- [ ] **Step 1: Create contracts router**

`backend/app/routers/contracts.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.schemas.contract import ContractOut, ContractListResponse

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


@router.get("", response_model=ContractListResponse)
async def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    year: int | None = None,
    line: str | None = None,
    reinsurer: str | None = None,
    cedant: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Contract)
    count_query = select(func.count(Contract.id))

    if year:
        query = query.where(Contract.year == year)
        count_query = count_query.where(Contract.year == year)
    if line:
        query = query.where(Contract.line == line)
        count_query = count_query.where(Contract.line == line)
    if reinsurer:
        query = query.where(Contract.reinsurer == reinsurer)
        count_query = count_query.where(Contract.reinsurer == reinsurer)
    if cedant:
        query = query.where(Contract.cedant == cedant)
        count_query = count_query.where(Contract.cedant == cedant)
    if search:
        query = query.where(Contract.assured.ilike(f"%{search}%"))
        count_query = count_query.where(Contract.assured.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar()
    items = (
        await db.execute(
            query.order_by(Contract.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return ContractListResponse(
        items=[ContractOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Contract not found")
    return ContractOut.model_validate(contract)
```

- [ ] **Step 2: Create claims router**

`backend/app/routers/claims.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.claim import Claim
from app.schemas.claim import ClaimOut, ClaimListResponse

router = APIRouter(prefix="/api/claims", tags=["claims"])


@router.get("", response_model=ClaimListResponse)
async def list_claims(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    line: str | None = None,
    reinsurer: str | None = None,
    cedant: str | None = None,
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Claim)
    count_query = select(func.count(Claim.id))

    if line:
        query = query.where(Claim.line == line)
        count_query = count_query.where(Claim.line == line)
    if reinsurer:
        query = query.where(Claim.reinsurer == reinsurer)
        count_query = count_query.where(Claim.reinsurer == reinsurer)
    if cedant:
        query = query.where(Claim.cedant == cedant)
        count_query = count_query.where(Claim.cedant == cedant)
    if status:
        query = query.where(Claim.status == status)
        count_query = count_query.where(Claim.status == status)
    if search:
        query = query.where(Claim.account_name.ilike(f"%{search}%"))
        count_query = count_query.where(Claim.account_name.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar()
    items = (
        await db.execute(
            query.order_by(Claim.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return ClaimListResponse(
        items=[ClaimOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{claim_id}", response_model=ClaimOut)
async def get_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Claim not found")
    return ClaimOut.model_validate(claim)
```

- [ ] **Step 3: Create dashboard router**

`backend/app/routers/dashboard.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.models.claim import Claim
from app.schemas.dashboard import DashboardSummary, DashboardCharts, ChartDataPoint

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_contracts = (await db.execute(select(func.count(Contract.id)))).scalar() or 0
    total_claims = (await db.execute(select(func.count(Claim.id)))).scalar() or 0

    total_premium = (
        await db.execute(select(func.coalesce(func.sum(Contract.ri_prem), 0)))
    ).scalar()

    total_claims_krw = (
        await db.execute(
            select(func.coalesce(func.sum(Claim.krw_amount), 0))
        )
    ).scalar()

    open_claims = (
        await db.execute(
            select(func.count(Claim.id)).where(Claim.status == "Open")
        )
    ).scalar() or 0

    closed_claims = (
        await db.execute(
            select(func.count(Claim.id)).where(Claim.status == "Closed")
        )
    ).scalar() or 0

    unique_reinsurers = (
        await db.execute(select(func.count(distinct(Contract.reinsurer))))
    ).scalar() or 0

    unique_cedants = (
        await db.execute(select(func.count(distinct(Contract.cedant))))
    ).scalar() or 0

    return DashboardSummary(
        total_contracts=total_contracts,
        total_claims=total_claims,
        total_premium_krw=float(total_premium),
        total_claims_krw=float(total_claims_krw),
        open_claims=open_claims,
        closed_claims=closed_claims,
        unique_reinsuers=unique_reinsurers,
        unique_cedants=unique_cedants,
    )


@router.get("/charts", response_model=DashboardCharts)
async def get_charts(db: AsyncSession = Depends(get_db)):
    # Premium by month (2026 year)
    prem_by_month = (
        await db.execute(
            select(
                Contract.cont_month,
                func.sum(Contract.ri_prem),
            )
            .where(Contract.year == 2026)
            .group_by(Contract.cont_month)
            .order_by(Contract.cont_month)
        )
    ).all()

    # Claims by line
    claims_by_line = (
        await db.execute(
            select(
                Claim.line,
                func.sum(Claim.krw_amount),
            )
            .where(Claim.line.isnot(None))
            .group_by(Claim.line)
            .order_by(func.sum(Claim.krw_amount).desc())
            .limit(10)
        )
    ).all()

    # Premium by reinsurer (top 10)
    prem_by_reinsurer = (
        await db.execute(
            select(
                Contract.reinsurer,
                func.sum(Contract.ri_prem),
            )
            .where(Contract.reinsurer.isnot(None))
            .group_by(Contract.reinsurer)
            .order_by(func.sum(Contract.ri_prem).desc())
            .limit(10)
        )
    ).all()

    # Claims by status
    claims_by_status = (
        await db.execute(
            select(
                Claim.status,
                func.count(Claim.id),
            )
            .where(Claim.status.isnot(None))
            .group_by(Claim.status)
        )
    ).all()

    return DashboardCharts(
        premium_by_month=[
            ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0))
            for r in prem_by_month
        ],
        claims_by_line=[
            ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0))
            for r in claims_by_line
        ],
        premium_by_reinsurer=[
            ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0))
            for r in prem_by_reinsurer
        ],
        claims_by_status=[
            ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0))
            for r in claims_by_status
        ],
    )
```

- [ ] **Step 4: Register all routers in main.py**

Add to `backend/app/main.py` after the existing `data` router import:
```python
from app.routers import data, contracts, claims, dashboard

# ... in the app setup section:
app.include_router(data.router)
app.include_router(contracts.router)
app.include_router(claims.router)
app.include_router(dashboard.router)
```

- [ ] **Step 5: Test API endpoints**

Run:
```bash
docker compose up --build -d
curl http://localhost:8000/api/dashboard/summary | python3 -m json.tool
curl "http://localhost:8000/api/contracts?page=1&page_size=5" | python3 -m json.tool
curl "http://localhost:8000/api/claims?page=1&page_size=5" | python3 -m json.tool
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/ backend/app/schemas/ backend/app/main.py
git commit -m "feat: API endpoints for contracts, claims, and dashboard"
```

---

### Task 6: Reconciliation Service + Router

**Files:**
- Create: `backend/app/services/reconciliation.py`
- Create: `backend/app/routers/reconciliation.py`
- Modify: `backend/app/main.py` (register router)

- [ ] **Step 1: Create reconciliation service**

`backend/app/services/reconciliation.py`:
```python
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.claim import Claim
from app.schemas.reconciliation import (
    ReconciliationMatch,
    ReconciliationAnomaly,
    ReconciliationSummary,
    ReconciliationResult,
)

logger = logging.getLogger(__name__)


async def run_reconciliation(db: AsyncSession) -> ReconciliationResult:
    """Match contracts with claims by assured/account_name + reinsurer."""

    # Load all contracts and claims
    contracts = (await db.execute(select(Contract))).scalars().all()
    claims = (await db.execute(select(Claim))).scalars().all()

    # Build lookup indices
    # Key: (normalized_assured, normalized_reinsurer) -> list of records
    def normalize(s: str | None) -> str:
        if not s:
            return ""
        return s.strip().lower().replace("(주)", "").replace("co.,ltd", "").replace("co., ltd", "").strip()

    contract_index: dict[tuple[str, str], list] = {}
    for c in contracts:
        key = (normalize(c.assured), normalize(c.reinsurer))
        contract_index.setdefault(key, []).append(c)

    claim_index: dict[tuple[str, str], list] = {}
    for cl in claims:
        key = (normalize(cl.account_name), normalize(cl.reinsurer))
        claim_index.setdefault(key, []).append(cl)

    matches = []
    anomalies = []
    matched_contract_ids = set()
    matched_claim_ids = set()

    # Match by (assured, reinsurer)
    for key, contract_group in contract_index.items():
        if key in claim_index:
            claim_group = claim_index[key]
            total_premium = sum(float(c.ri_prem or 0) for c in contract_group)
            total_claim = sum(float(cl.krw_amount or 0) for cl in claim_group)
            diff = total_premium - total_claim

            match_type = "exact" if abs(diff) < 1 else ("partial" if abs(diff) / max(abs(total_premium), 1) < 0.05 else "mismatch")

            matches.append(ReconciliationMatch(
                contract_id=contract_group[0].id,
                claim_id=claim_group[0].id,
                assured=contract_group[0].assured,
                reinsurer=contract_group[0].reinsurer,
                premium_amount=total_premium,
                claim_amount=total_claim,
                difference=diff,
                match_type=match_type,
            ))

            if match_type == "mismatch":
                anomalies.append(ReconciliationAnomaly(
                    type="amount_mismatch",
                    description=f"{contract_group[0].assured} / {contract_group[0].reinsurer}: premium {total_premium:,.0f} vs claim {total_claim:,.0f} (diff: {diff:,.0f})",
                    contract_id=contract_group[0].id,
                    claim_id=claim_group[0].id,
                    amount=diff,
                ))

            for c in contract_group:
                matched_contract_ids.add(c.id)
            for cl in claim_group:
                matched_claim_ids.add(cl.id)

    # Unmatched contracts
    for key, contract_group in contract_index.items():
        if key not in claim_index:
            for c in contract_group:
                if c.id not in matched_contract_ids:
                    anomalies.append(ReconciliationAnomaly(
                        type="missing_claim",
                        description=f"No matching claim for contract: {c.assured} / {c.reinsurer}",
                        contract_id=c.id,
                        amount=float(c.ri_prem or 0),
                    ))

    # Unmatched claims
    for key, claim_group in claim_index.items():
        if key not in contract_index:
            for cl in claim_group:
                if cl.id not in matched_claim_ids:
                    anomalies.append(ReconciliationAnomaly(
                        type="missing_contract",
                        description=f"No matching contract for claim: {cl.account_name} / {cl.reinsurer}",
                        claim_id=cl.id,
                        amount=float(cl.krw_amount or 0),
                    ))

    total_premium = sum(float(c.ri_prem or 0) for c in contracts)
    total_claims_amt = sum(float(cl.krw_amount or 0) for cl in claims)

    summary = ReconciliationSummary(
        total_contracts=len(contracts),
        total_claims=len(claims),
        matched=len(matches),
        unmatched_contracts=len([a for a in anomalies if a.type == "missing_claim"]),
        unmatched_claims=len([a for a in anomalies if a.type == "missing_contract"]),
        anomalies_count=len(anomalies),
        total_premium=total_premium,
        total_claims_amount=total_claims_amt,
        difference=total_premium - total_claims_amt,
    )

    return ReconciliationResult(
        summary=summary,
        matches=matches[:200],  # Limit for API response size
        anomalies=anomalies[:200],
    )
```

- [ ] **Step 2: Create reconciliation router**

`backend/app/routers/reconciliation.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.reconciliation import run_reconciliation
from app.schemas.reconciliation import ReconciliationResult, ReconciliationSummary

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


@router.get("/results", response_model=ReconciliationResult)
async def get_results(db: AsyncSession = Depends(get_db)):
    return await run_reconciliation(db)


@router.get("/summary", response_model=ReconciliationSummary)
async def get_summary(db: AsyncSession = Depends(get_db)):
    result = await run_reconciliation(db)
    return result.summary
```

- [ ] **Step 3: Register router in main.py**

Add import and include:
```python
from app.routers import data, contracts, claims, dashboard, reconciliation
app.include_router(reconciliation.router)
```

- [ ] **Step 4: Test reconciliation**

Run:
```bash
curl http://localhost:8000/api/reconciliation/summary | python3 -m json.tool
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/reconciliation.py backend/app/routers/reconciliation.py backend/app/main.py
git commit -m "feat: bordereaux reconciliation service with anomaly detection"
```

---

### Task 7: AI Chat Service + Router

**Files:**
- Create: `backend/app/services/ai_chat.py`
- Create: `backend/app/routers/chat.py`
- Modify: `backend/app/main.py` (register router)

- [ ] **Step 1: Create AI chat service**

`backend/app/services/ai_chat.py`:
```python
import json
import logging
import google.generativeai as genai
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

DB_SCHEMA_CONTEXT = """
You are a SQL assistant for a reinsurance settlement system. The database has these PostgreSQL tables:

TABLE contracts:
- id (serial PK), year (int), cont_month (varchar) -- e.g. "January", "February"
- no (varchar), cover_note_no (varchar), assured (varchar) -- 피보험자
- project_name (varchar), line (varchar) -- 보험종목 e.g. "Property", "Casualty"
- line2 (varchar), new_renew (varchar) -- "N"=new, "R"=renew
- original_cedant (varchar), cedant (varchar) -- 출재사, e.g. "KR", "HW", "DB"
- period_from (date), period_to (date), currency (varchar)
- gross_prem_100 (numeric) -- 총보험료, gross_prem_inst (numeric)
- reinsurer (varchar) -- 재보험사 e.g. "ACE KR", "NH", "SS", "HM"
- share (numeric) -- 지분율 0~1, ri_prem (numeric) -- 재보험료
- ri_commission (numeric), net_ri_prem (numeric), net_to_uwr (numeric)
- rec_date (date) -- 수금일, paid_date (date) -- 지급일
- co_brokerage (numeric), partner (varchar)

TABLE claims:
- id (serial PK), booking_month (varchar), soc_received (varchar), soc_sent (varchar)
- account_name (varchar) -- 계정명/피보험자, line (varchar) -- 보험종목
- policy_period (date), dol (date) -- 사고일
- reinsurer (varchar), currency (varchar), total_amount (numeric)
- share (numeric), origin_currency (numeric), roe (numeric) -- 환율
- krw_amount (numeric) -- 원화환산보험금, soc_amount (numeric)
- cedant (varchar), status (varchar) -- "Open" or "Closed"
- received_date (date), paid_date (date), account_mgr (varchar)
- ref_no (varchar), remarks (text)

TABLE cover_notes:
- id (serial PK), issuing_date (date), cover_note_number (varchar)
- assured (varchar), reassured (varchar), line (varchar)
- account (varchar), remarks (text)

IMPORTANT RULES:
- Generate only SELECT queries. Never INSERT, UPDATE, DELETE, DROP.
- Use Korean-aware matching: ILIKE for text search.
- Return the SQL query wrapped in ```sql ... ``` code block.
- After the SQL block, explain what the query does in Korean.
- If the question is ambiguous, make reasonable assumptions and state them.
"""


def _configure_gemini():
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-2.0-flash")


def _extract_sql(response_text: str) -> str | None:
    if "```sql" in response_text:
        start = response_text.index("```sql") + 6
        end = response_text.index("```", start)
        return response_text[start:end].strip()
    if "```" in response_text:
        start = response_text.index("```") + 3
        end = response_text.index("```", start)
        return response_text[start:end].strip()
    return None


async def chat(message: str, db: AsyncSession) -> dict:
    model = _configure_gemini()

    prompt = f"{DB_SCHEMA_CONTEXT}\n\nUser question: {message}"

    response = model.generate_content(prompt)
    response_text = response.text

    sql_query = _extract_sql(response_text)
    data = None

    if sql_query:
        # Safety check
        sql_lower = sql_query.lower().strip()
        if any(kw in sql_lower for kw in ["insert", "update", "delete", "drop", "alter", "truncate"]):
            return {
                "answer": "안전상의 이유로 데이터 변경 쿼리는 실행할 수 없습니다.",
                "sql_query": sql_query,
                "data": None,
            }

        try:
            result = await db.execute(text(sql_query))
            rows = result.fetchall()
            columns = result.keys()
            data = [dict(zip(columns, row)) for row in rows[:100]]

            # Generate natural language answer with the data
            data_str = json.dumps(data[:20], default=str, ensure_ascii=False)
            answer_prompt = f"""Based on this SQL query result, answer the user's question in Korean.
Be concise and use numbers/tables when appropriate.

User question: {message}
SQL: {sql_query}
Result ({len(data)} rows): {data_str}"""

            answer_response = model.generate_content(answer_prompt)
            answer = answer_response.text
        except Exception as e:
            logger.error(f"SQL execution error: {e}")
            answer = f"쿼리 실행 중 오류가 발생했습니다: {str(e)}\n\n생성된 쿼리:\n```sql\n{sql_query}\n```"
    else:
        answer = response_text

    return {
        "answer": answer,
        "sql_query": sql_query,
        "data": data,
    }
```

- [ ] **Step 2: Create chat router**

`backend/app/routers/chat.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.ai_chat import chat
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def post_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    result = await chat(req.message, db)
    return ChatResponse(**result)
```

- [ ] **Step 3: Register router in main.py**

```python
from app.routers import data, contracts, claims, dashboard, reconciliation, chat
app.include_router(chat.router)
```

- [ ] **Step 4: Test chat**

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "2026년 재보험사별 보험료 합계를 알려줘"}'
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai_chat.py backend/app/routers/chat.py backend/app/main.py
git commit -m "feat: AI chat service with Gemini text-to-SQL"
```

---

### Task 8: Frontend - Layout + API Client

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Create API client**

`frontend/src/lib/api.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// Types
export interface DashboardSummary {
  total_contracts: number;
  total_claims: number;
  total_premium_krw: number;
  total_claims_krw: number;
  open_claims: number;
  closed_claims: number;
  unique_reinsuers: number;
  unique_cedants: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface DashboardCharts {
  premium_by_month: ChartDataPoint[];
  claims_by_line: ChartDataPoint[];
  premium_by_reinsurer: ChartDataPoint[];
  claims_by_status: ChartDataPoint[];
}

export interface Contract {
  id: number;
  year: number | null;
  cont_month: string | null;
  cover_note_no: string | null;
  assured: string | null;
  line: string | null;
  reinsurer: string | null;
  currency: string | null;
  ri_prem: number | null;
  net_ri_prem: number | null;
  cedant: string | null;
  rec_date: string | null;
  paid_date: string | null;
}

export interface Claim {
  id: number;
  booking_month: string | null;
  account_name: string | null;
  line: string | null;
  reinsurer: string | null;
  currency: string | null;
  total_amount: number | null;
  krw_amount: number | null;
  cedant: string | null;
  status: string | null;
  ref_no: string | null;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReconciliationSummary {
  total_contracts: number;
  total_claims: number;
  matched: number;
  unmatched_contracts: number;
  unmatched_claims: number;
  anomalies_count: number;
  total_premium: number;
  total_claims_amount: number;
  difference: number;
}

export interface ReconciliationMatch {
  contract_id: number;
  claim_id: number;
  assured: string | null;
  reinsurer: string | null;
  premium_amount: number | null;
  claim_amount: number | null;
  difference: number | null;
  match_type: string;
}

export interface ReconciliationAnomaly {
  type: string;
  description: string;
  contract_id: number | null;
  claim_id: number | null;
  amount: number | null;
}

export interface ReconciliationResult {
  summary: ReconciliationSummary;
  matches: ReconciliationMatch[];
  anomalies: ReconciliationAnomaly[];
}

export interface ChatResponse {
  answer: string;
  sql_query: string | null;
  data: Record<string, unknown>[] | null;
}
```

- [ ] **Step 2: Create Sidebar component**

`frontend/src/components/Sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "대시보드", icon: "📊" },
  { href: "/contracts", label: "계약 관리", icon: "📋" },
  { href: "/claims", label: "보험금", icon: "💰" },
  { href: "/reconciliation", label: "보더로 대조", icon: "🔍" },
  { href: "/chat", label: "AI 질의", icon: "💬" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <div className="text-xl font-bold mb-8 px-2">
        ReinsAI
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Update root layout**

`frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReinsAI - 재보험 AI 정청산",
  description: "재보험 중개사를 위한 AI 정청산 자동화 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-slate-50`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: frontend layout with sidebar and API client"
```

---

### Task 9: Frontend - Dashboard Page

**Files:**
- Create: `frontend/src/components/StatCard.tsx`
- Create: `frontend/src/components/ChartCard.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Install recharts**

```bash
cd frontend && npm install recharts
```

- [ ] **Step 2: Create StatCard**

`frontend/src/components/StatCard.tsx`:
```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    blue: "border-blue-500 bg-blue-50",
    green: "border-green-500 bg-green-50",
    red: "border-red-500 bg-red-50",
    yellow: "border-yellow-500 bg-yellow-50",
    purple: "border-purple-500 bg-purple-50",
  };

  return (
    <div className={`rounded-xl border-l-4 ${colorClasses[color] || colorClasses.blue} p-5 bg-white shadow-sm`}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create ChartCard**

`frontend/src/components/ChartCard.tsx`:
```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

interface ChartCardProps {
  title: string;
  data: { label: string; value: number }[];
  type?: "bar" | "pie";
}

function formatKRW(value: number): string {
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}만`;
  return value.toLocaleString();
}

export default function ChartCard({ title, data, type = "bar" }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatKRW} />
              <Tooltip formatter={(val: number) => formatKRW(val)} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val: number) => formatKRW(val)} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create dashboard page**

`frontend/src/app/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchApi, DashboardSummary, DashboardCharts } from "@/lib/api";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";

function formatKRW(value: number): string {
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1)}억원`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}만원`;
  return `${value.toLocaleString()}원`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi<DashboardSummary>("/api/dashboard/summary"),
      fetchApi<DashboardCharts>("/api/dashboard/charts"),
    ]).then(([s, c]) => {
      setSummary(s);
      setCharts(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-slate-400">로딩 중...</div>;
  if (!summary || !charts) return <div className="text-center py-20 text-red-500">데이터 로드 실패</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">정산 대시보드</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard title="총 계약 건수" value={summary.total_contracts.toLocaleString()} color="blue" />
        <StatCard title="총 보험금 건수" value={summary.total_claims.toLocaleString()} color="green" />
        <StatCard title="총 재보험료" value={formatKRW(summary.total_premium_krw)} color="purple" />
        <StatCard title="총 보험금(원화)" value={formatKRW(summary.total_claims_krw)} color="red" />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard title="미결 클레임" value={summary.open_claims.toLocaleString()} color="yellow" />
        <StatCard title="완결 클레임" value={summary.closed_claims.toLocaleString()} color="green" />
        <StatCard title="재보험사 수" value={summary.unique_reinsuers} color="blue" />
        <StatCard title="출재사 수" value={summary.unique_cedants} color="purple" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="월별 재보험료 (2026)" data={charts.premium_by_month} type="bar" />
        <ChartCard title="종목별 보험금" data={charts.claims_by_line} type="bar" />
        <ChartCard title="재보험사별 보험료 (Top 10)" data={charts.premium_by_reinsurer} type="bar" />
        <ChartCard title="클레임 상태 분포" data={charts.claims_by_status} type="pie" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: dashboard page with stats and charts"
```

---

### Task 10: Frontend - Contracts + Claims Pages

**Files:**
- Create: `frontend/src/components/DataTable.tsx`
- Create: `frontend/src/app/contracts/page.tsx`
- Create: `frontend/src/app/claims/page.tsx`

- [ ] **Step 1: Create reusable DataTable**

`frontend/src/components/DataTable.tsx`:
```tsx
"use client";

import { useState } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSearch?: (search: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onSearch,
  searchPlaceholder = "검색...",
  filters,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = () => {
    onSearch?.(searchValue);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        {onSearch && (
          <div className="flex gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchPlaceholder}
              className="px-3 py-2 border rounded-lg text-sm w-64"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              검색
            </button>
          </div>
        )}
        {filters}
        <span className="ml-auto text-sm text-slate-500">
          총 {total.toLocaleString()}건
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="text-left px-4 py-3 font-medium text-slate-600">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-3">
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-slate-400">
                  데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create contracts page**

`frontend/src/app/contracts/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchApi, Contract, ListResponse } from "@/lib/api";
import DataTable from "@/components/DataTable";

function formatAmount(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const columns = [
  { key: "year" as const, label: "연도" },
  { key: "cont_month" as const, label: "월" },
  { key: "cover_note_no" as const, label: "커버노트" },
  { key: "assured" as const, label: "피보험자" },
  { key: "line" as const, label: "종목" },
  { key: "reinsurer" as const, label: "재보험사" },
  { key: "cedant" as const, label: "출재사" },
  { key: "currency" as const, label: "통화" },
  {
    key: "ri_prem" as const,
    label: "재보험료",
    render: (val: unknown) => formatAmount(val as number | null),
  },
  {
    key: "rec_date" as const,
    label: "수금일",
    render: (val: unknown) => (val ? String(val) : "-"),
  },
];

export default function ContractsPage() {
  const [data, setData] = useState<ListResponse<Contract> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (search) params.set("search", search);
    fetchApi<ListResponse<Contract>>(`/api/contracts?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, search]);

  if (loading && !data) return <div className="text-center py-20 text-slate-400">로딩 중...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">계약 관리</h1>
      {data && (
        <DataTable
          columns={columns}
          data={data.items}
          total={data.total}
          page={data.page}
          pageSize={data.page_size}
          onPageChange={setPage}
          onSearch={setSearch}
          searchPlaceholder="피보험자 검색..."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create claims page**

`frontend/src/app/claims/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchApi, Claim, ListResponse } from "@/lib/api";
import DataTable from "@/components/DataTable";

function formatAmount(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const columns = [
  { key: "booking_month" as const, label: "부킹월" },
  { key: "account_name" as const, label: "계정명" },
  { key: "line" as const, label: "종목" },
  { key: "reinsurer" as const, label: "재보험사" },
  { key: "cedant" as const, label: "출재사" },
  {
    key: "status" as const,
    label: "상태",
    render: (val: unknown) => {
      const status = val as string | null;
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            status === "Open"
              ? "bg-yellow-100 text-yellow-800"
              : status === "Closed"
              ? "bg-green-100 text-green-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {status || "-"}
        </span>
      );
    },
  },
  {
    key: "krw_amount" as const,
    label: "원화보험금",
    render: (val: unknown) => formatAmount(val as number | null),
  },
  { key: "ref_no" as const, label: "Ref No." },
  { key: "account_mgr" as const, label: "담당자" },
];

export default function ClaimsPage() {
  const [data, setData] = useState<ListResponse<Claim> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (search) params.set("search", search);
    fetchApi<ListResponse<Claim>>(`/api/claims?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, search]);

  if (loading && !data) return <div className="text-center py-20 text-slate-400">로딩 중...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">보험금 관리</h1>
      {data && (
        <DataTable
          columns={columns}
          data={data.items}
          total={data.total}
          page={data.page}
          pageSize={data.page_size}
          onPageChange={setPage}
          onSearch={setSearch}
          searchPlaceholder="계정명 검색..."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: contracts and claims list pages with DataTable"
```

---

### Task 11: Frontend - Reconciliation Page

**Files:**
- Create: `frontend/src/app/reconciliation/page.tsx`

- [ ] **Step 1: Create reconciliation page**

`frontend/src/app/reconciliation/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchApi, ReconciliationResult } from "@/lib/api";
import StatCard from "@/components/StatCard";

function formatAmount(val: number | null): string {
  if (val === null) return "-";
  if (Math.abs(val) >= 1e8) return `${(val / 1e8).toFixed(1)}억`;
  if (Math.abs(val) >= 1e4) return `${(val / 1e4).toFixed(0)}만`;
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function ReconciliationPage() {
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"matches" | "anomalies">("matches");

  useEffect(() => {
    fetchApi<ReconciliationResult>("/api/reconciliation/results")
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-slate-400">대조 분석 중...</div>;
  if (!result) return <div className="text-center py-20 text-red-500">데이터 로드 실패</div>;

  const { summary, matches, anomalies } = result;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">보더로 대조</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard title="매칭 건수" value={summary.matched} color="green" />
        <StatCard title="이상 건수" value={summary.anomalies_count} color="red" />
        <StatCard title="미매칭 계약" value={summary.unmatched_contracts} color="yellow" />
        <StatCard title="미매칭 클레임" value={summary.unmatched_claims} color="yellow" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard title="총 재보험료" value={formatAmount(summary.total_premium)} color="blue" />
        <StatCard title="총 보험금" value={formatAmount(summary.total_claims_amount)} color="purple" />
        <StatCard
          title="차이"
          value={formatAmount(summary.difference)}
          color={summary.difference > 0 ? "green" : "red"}
        />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("matches")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "matches" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"
          }`}
        >
          매칭 결과 ({matches.length})
        </button>
        <button
          onClick={() => setTab("anomalies")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "anomalies" ? "bg-red-600 text-white" : "bg-white text-slate-600 border"
          }`}
        >
          이상 건 ({anomalies.length})
        </button>
      </div>

      {tab === "matches" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">피보험자</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">재보험사</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">보험료</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">보험금</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">차이</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">상태</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">{m.assured || "-"}</td>
                  <td className="px-4 py-3">{m.reinsurer || "-"}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(m.premium_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(m.claim_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(m.difference)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.match_type === "exact"
                          ? "bg-green-100 text-green-800"
                          : m.match_type === "partial"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {m.match_type === "exact" ? "일치" : m.match_type === "partial" ? "유사" : "불일치"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "anomalies" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">유형</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">설명</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">금액</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.type === "amount_mismatch"
                          ? "bg-red-100 text-red-800"
                          : a.type === "missing_claim"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {a.type === "amount_mismatch"
                        ? "금액불일치"
                        : a.type === "missing_claim"
                        ? "클레임누락"
                        : "계약누락"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.description}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/reconciliation/
git commit -m "feat: reconciliation page with match results and anomaly list"
```

---

### Task 12: Frontend - Chat Page

**Files:**
- Create: `frontend/src/components/ChatMessage.tsx`
- Create: `frontend/src/app/chat/page.tsx`

- [ ] **Step 1: Create ChatMessage component**

`frontend/src/components/ChatMessage.tsx`:
```tsx
interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sqlQuery?: string | null;
  data?: Record<string, unknown>[] | null;
}

export default function ChatMessage({ role, content, sqlQuery, data }: ChatMessageProps) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          role === "user"
            ? "bg-blue-600 text-white"
            : "bg-white border shadow-sm"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm">{content}</div>

        {sqlQuery && (
          <details className="mt-3">
            <summary className="text-xs text-slate-400 cursor-pointer">SQL 쿼리 보기</summary>
            <pre className="mt-2 p-2 bg-slate-900 text-green-400 rounded text-xs overflow-x-auto">
              {sqlQuery}
            </pre>
          </details>
        )}

        {data && data.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-slate-400 cursor-pointer">
              데이터 보기 ({data.length}건)
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    {Object.keys(data[0]).map((key) => (
                      <th key={key} className="border px-2 py-1 bg-slate-50 font-medium">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 20).map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, cidx) => (
                        <td key={cidx} className="border px-2 py-1">
                          {String(val ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create chat page**

`frontend/src/app/chat/page.tsx`:
```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { fetchApi, ChatResponse } from "@/lib/api";
import ChatMessage from "@/components/ChatMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
  sqlQuery?: string | null;
  data?: Record<string, unknown>[] | null;
}

const SUGGESTIONS = [
  "2026년 재보험사별 보험료 합계를 알려줘",
  "미결 클레임 중 금액이 큰 상위 10건은?",
  "Property 종목의 월별 보험료 추이를 보여줘",
  "ACE KR의 2026년 총 보험료와 커미션은?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetchApi<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: text.trim() }),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          sqlQuery: res.sql_query,
          data: res.data,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <h1 className="text-2xl font-bold mb-4">AI 질의</h1>

      <div className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-6">재보험 데이터에 대해 자연어로 질문하세요</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-2 bg-white border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage key={idx} {...msg} />
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border shadow-sm rounded-2xl px-4 py-3 text-sm text-slate-400">
              분석 중...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-white p-4 rounded-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="질문을 입력하세요..."
            className="flex-1 px-4 py-2.5 border rounded-lg text-sm"
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: AI chat page with natural language query interface"
```

---

### Task 13: Final Integration + Verification

**Files:**
- Verify all Docker containers run together
- End-to-end test all pages

- [ ] **Step 1: Rebuild and start all containers**

```bash
docker compose down -v
docker compose up --build -d
```

Wait for backend logs to show import completion:
```bash
docker compose logs -f backend
```

- [ ] **Step 2: Verify all API endpoints**

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/dashboard/summary
curl "http://localhost:8000/api/contracts?page=1&page_size=3"
curl "http://localhost:8000/api/claims?page=1&page_size=3"
curl http://localhost:8000/api/reconciliation/summary
curl -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" -d '{"message":"총 계약 건수는?"}'
```

- [ ] **Step 3: Verify frontend pages**

Open browser:
- `http://localhost:3000` — Dashboard with stats and charts
- `http://localhost:3000/contracts` — Contracts list with search
- `http://localhost:3000/claims` — Claims list with status badges
- `http://localhost:3000/reconciliation` — Reconciliation results
- `http://localhost:3000/chat` — AI chat working

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete ReinsAI prototype with all features integrated"
```
