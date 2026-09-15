from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    # True 면 알파렌즈(argo) 외부 툴을 MCP 로 함께 사용(설정된 경우). False=내부 툴만.
    use_mcp: bool = False


class ChatResponse(BaseModel):
    answer: str
    sql_query: str | None = None
    data: list[dict] | None = None
