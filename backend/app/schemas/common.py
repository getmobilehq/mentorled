from pydantic import BaseModel, EmailStr, UUID4
from datetime import datetime
from typing import Optional

class MessageResponse(BaseModel):
    message: str
    status: str = "success"

class ErrorResponse(BaseModel):
    detail: str
    status: str = "error"

class PaginationParams(BaseModel):
    skip: int = 0
    limit: int = 100

class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
