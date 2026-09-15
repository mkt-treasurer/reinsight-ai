import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.schemas.chat import ChatRequest
from app.services.agent.agent import run_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def stream_chat(req: ChatRequest):
    # See soc_stream.py for why we manage the session inside the generator
    # rather than via Depends(get_db).
    async def event_stream():
        async with async_session() as db:
            async for event in run_agent(req.message, db, use_mcp=req.use_mcp):
                yield f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False, default=str)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("")
async def post_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Non-streaming fallback - collects all events and returns final answer."""
    steps = []
    answer = ""
    async for event in run_agent(req.message, db, use_mcp=req.use_mcp):
        if event["event"] in (
            "thinking",
            "tool_call",
            "tool_result",
            "mcp_tool_call",
            "mcp_tool_result",
            "code",
            "image",
        ):
            steps.append(event)
        elif event["event"] == "answer":
            answer = event["data"]["content"]

    return {
        "answer": answer,
        "steps": steps,
        "sql_query": None,
        "data": None,
    }
