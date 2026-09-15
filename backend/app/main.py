from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, async_session
from app.routers import data, contracts, claims, dashboard, reconciliation, chat, cover_notes, company, audit, search, policies, documents, claim_workflow, data_audit, contract_workflow, soc_generator, soc_stream, soc_test_suite, code_table, slip_testbench, rq_slip, weekly, ops, news, bd, survey
from app.services.importer import import_all
from app.services.policy_builder import build_policies, link_claims_to_policies
from app.services.file_scanner import scan_and_match

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _background_import():
    """Run import only if DB is empty (skip on hot reload)."""
    await asyncio.sleep(1)
    async with async_session() as db:
        from sqlalchemy import text
        count = (await db.execute(text("SELECT count(*) FROM contracts"))).scalar()
        if count and count > 0:
            logger.info(f"DB already has {count} contracts, skipping import")
            return

        try:
            result = await import_all(db)
            logger.info(f"Auto-import completed: {result}")
            policy_result = await build_policies(db)
            link_result = await link_claims_to_policies(db)
            logger.info(f"Policy build: {policy_result}, {link_result}")
            scan_result = await scan_and_match(db)
            logger.info(f"File scan: {scan_result}")
        except Exception as e:
            logger.error(f"Auto-import failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    asyncio.create_task(_background_import())
    yield


app = FastAPI(title="ReinsAI", lifespan=lifespan)

from fastapi.staticfiles import StaticFiles
from pathlib import Path
data_dir = Path("/app/data")
if data_dir.exists():
    app.mount("/files", StaticFiles(directory=str(data_dir)), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)
app.include_router(contracts.router)
app.include_router(claims.router)
app.include_router(cover_notes.router)
app.include_router(company.router)
app.include_router(dashboard.router)
app.include_router(reconciliation.router)
app.include_router(chat.router)
app.include_router(audit.router)
app.include_router(search.router)
app.include_router(policies.router)
app.include_router(documents.router)
app.include_router(claim_workflow.router)
app.include_router(data_audit.router)
app.include_router(contract_workflow.router)
app.include_router(soc_generator.router)
app.include_router(soc_stream.router)
app.include_router(soc_test_suite.router)
app.include_router(code_table.router)
app.include_router(slip_testbench.router)
app.include_router(rq_slip.router)  # placement RQ-slip generator (isolated, experimental)
app.include_router(weekly.router)  # weekly result&plan dashboard (isolated, experimental)
app.include_router(ops.router)  # operations dashboard — contract-mgmt ledger (isolated, experimental)
app.include_router(news.router)  # news-insights dashboard (isolated, experimental)
app.include_router(bd.router)  # business-development lead board (isolated, read-only)
app.include_router(survey.router)  # satisfaction survey — feature feedback (isolated, experimental)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
