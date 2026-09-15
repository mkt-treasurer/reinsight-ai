"""ARQ worker for async document parsing jobs."""

import asyncio
import logging
from arq import create_pool, cron
from arq.connections import RedisSettings

from app.config import settings
from app.database import async_session, init_db
from app.services.doc_parser import parse_documents

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def parse_docs_job(ctx: dict, doc_type: str | None = None, batch_size: int = 20):
    """Parse a batch of documents. Called by ARQ."""
    async with async_session() as db:
        result = await parse_documents(db, limit=batch_size, doc_type=doc_type)
        logger.info(f"Parse job done: {result}")
        return result


async def parse_all_docs_job(ctx: dict):
    """Parse ALL unparsed documents in batches."""
    total_parsed = 0
    total_failed = 0
    batch = 0

    while True:
        batch += 1
        async with async_session() as db:
            result = await parse_documents(db, limit=20)

        total_parsed += result["parsed"]
        total_failed += result["failed"]
        logger.info(f"Batch {batch}: parsed={result['parsed']}, failed={result['failed']}, total_so_far={total_parsed}")

        # If we got fewer than limit, we're done
        if result["total"] < 20:
            break

        # Rate limit: don't hammer Gemini
        await asyncio.sleep(1)

    return {"total_parsed": total_parsed, "total_failed": total_failed, "batches": batch}


async def extract_claim_files_job(ctx: dict):
    """Extract amounts from all claim files (xlsx only, fast)."""
    from app.services.claim_file_audit import extract_and_cache
    async with async_session() as db:
        result = await extract_and_cache(db)
        logger.info(f"Claim file extraction done: {result}")
        return result


async def tag_all_files_job(ctx: dict):
    """Register + tag ALL claim files. xlsx fast, PDF/MSG via Gemini."""
    from app.services.file_tagger import register_all_files, tag_files_batch

    async with async_session() as db:
        reg = await register_all_files(db)
        logger.info(f"Registered: {reg}")

    total_tagged = 0
    total_failed = 0
    batch = 0
    while True:
        batch += 1
        async with async_session() as db:
            result = await tag_files_batch(db, batch_size=10)
        total_tagged += result["tagged"]
        total_failed += result["failed"]
        logger.info(f"Tag batch {batch}: tagged={result['tagged']}, remaining={result['remaining']}")
        if result["remaining"] == 0:
            break
        await asyncio.sleep(0.5)  # Rate limit for Gemini

    return {"total_tagged": total_tagged, "total_failed": total_failed, "batches": batch}


async def refresh_news_job(ctx: dict):
    """Pre-warm the news-insights feed so the first visitor each morning gets a
    cached page instead of waiting ~15s for the live build. Best-effort — a
    failure just leaves the GET endpoint to build on demand."""
    from app.services import news_feed

    payload = await news_feed.build_and_cache()
    counts = {t["id"]: len(t["items"]) for t in payload.get("topics", [])}
    logger.info("News feed refreshed: %s", counts)
    return counts


async def startup(ctx: dict):
    await init_db()
    logger.info("Worker started")


async def shutdown(ctx: dict):
    logger.info("Worker shutting down")


class WorkerSettings:
    functions = [parse_docs_job, parse_all_docs_job, extract_claim_files_job, tag_all_files_job]
    # Daily news-feed pre-warm at 21:00 UTC = 06:00 KST. Container clock is UTC.
    cron_jobs = [cron(refresh_news_job, hour=21, minute=0, run_at_startup=False)]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 3
    job_timeout = 600  # 10 min per job


if __name__ == "__main__":
    from arq.worker import run_worker
    run_worker(WorkerSettings)
