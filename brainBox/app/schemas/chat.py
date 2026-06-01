from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: user or assistant")
    content: str = Field(..., description="Message content")

class ChatPayload(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID")
    question: str = Field(..., description="User question")
    session_id: Optional[str] = Field(None, description="Chat session ID")

class ChatResponse(BaseModel):
    response: str
    reasoning: Optional[str] = None
    search_results: Optional[List] = None

class ChatSessionCreate(BaseModel):
    tenant_id: str
    title: Optional[str] = None

class ChatSessionResponse(BaseModel):
    session_id: str
    title: Optional[str]
    created_at: str

class ChatMessageDetail(BaseModel):
    id: int
    role: str
    content: str
    created_at: str
    user_initials: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class ChatSessionDetail(BaseModel):
    session_id: str
    title: Optional[str]
    messages: List[ChatMessageDetail]
    created_at: str

    class Config:
        from_attributes = True

class SessionsGroupedByDate(BaseModel):
    today: List[ChatSessionResponse] = []
    yesterday: List[ChatSessionResponse] = []
    this_week: List[ChatSessionResponse] = []
    older: List[ChatSessionResponse] = []
