from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: user or assistant")
    content: str = Field(..., description="Message content")

class UserScope(BaseModel):
    """Optional end-user identity supplied by an integrator (Odoo, website, ...).

    When `user_id` is sent, sessions are stamped with it and only that user can list/read/write
    them. When omitted, sessions are tenant-wide (legacy behaviour).
    """
    user_id: Optional[str] = Field(None, description='External user id, e.g. "odoo:mydb:7"')
    user_name: Optional[str] = Field(None, description="Display name of the end user")
    user_role: Optional[str] = Field(
        None,
        description="admin | internal | portal | customer | vendor | public. Only trusted with a "
                    "secret API key; publishable keys are always treated as public.",
    )

class ChatPayload(UserScope):
    tenant_id: Optional[str] = Field(None, description="Tenant ID (optional: defaults to the API key's tenant; must match it if sent)")
    question: str = Field(..., description="User question")
    session_id: Optional[str] = Field(None, description="Chat session ID")

class ChatResponse(BaseModel):
    response: str
    reasoning: Optional[str] = None
    search_results: Optional[List] = None
    session_id: Optional[str] = None
    # Ids of the stored messages (send message_id to POST /api/chat/feedback).
    message_id: Optional[int] = None
    user_message_id: Optional[int] = None


class FeedbackPayload(BaseModel):
    tenant_id: Optional[str] = Field(None, description="Defaults to the API key's tenant; must match it if sent")
    session_id: str = Field(..., min_length=1)
    message_id: Optional[int] = Field(None, description="Assistant message id (defaults to the session's last answer)")
    rating: Literal["up", "down"]
    comment: Optional[str] = Field(None, max_length=2000)
    user_id: Optional[str] = Field(None, description="External user id owning the session (optional)")

class ChatSessionCreate(UserScope):
    tenant_id: Optional[str] = Field(None, description="Tenant ID (optional: defaults to the API key's tenant; must match it if sent)")
    title: Optional[str] = None

class ChatSessionsListRequest(UserScope):
    tenant_id: Optional[str] = Field(None, description="Tenant ID (optional: defaults to the API key's tenant; must match it if sent)")

class ChatSessionResponse(BaseModel):
    session_id: str
    title: Optional[str]
    created_at: str
    user_id: Optional[str] = None
    pinned: bool = False


class ChatSessionUpdate(UserScope):
    """Rename and/or pin a chat in the user's history."""
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    pinned: Optional[bool] = None


class ChatSessionDelete(UserScope):
    """Remove a chat from the user's history (staff reports keep it)."""

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
    user_id: Optional[str] = None

    class Config:
        from_attributes = True

class SessionsGroupedByDate(BaseModel):
    pinned: List[ChatSessionResponse] = []
    today: List[ChatSessionResponse] = []
    yesterday: List[ChatSessionResponse] = []
    this_week: List[ChatSessionResponse] = []
    older: List[ChatSessionResponse] = []
