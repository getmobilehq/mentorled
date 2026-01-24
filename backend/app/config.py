from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import json

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://mentorled:mentorled_dev@localhost:5432/mentorled"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Anthropic
    ANTHROPIC_API_KEY: str
    DEFAULT_MODEL: str = "claude-3-haiku-20240307"  # Using Haiku for both models (Sonnet requires newer SDK)
    FAST_MODEL: str = "claude-3-haiku-20240307"

    # Auth
    SECRET_KEY: str = "your-secret-key-change-in-production"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003"
    ]

    # Agent Settings
    SCREENING_CONFIDENCE_THRESHOLD: float = 0.7
    RISK_ALERT_THRESHOLD: float = 0.5

    # Cost Tracking (USD per 1M tokens - approximate)
    COST_PER_1M_INPUT_TOKENS: float = 3.0
    COST_PER_1M_OUTPUT_TOKENS: float = 15.0

    # Email Settings (Phase 3)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "MentorLed"
    ENABLE_EMAIL: bool = False

    # Slack Notifications (Phase 3)
    SLACK_WEBHOOK_URL: str = ""
    ENABLE_SLACK_NOTIFICATIONS: bool = False
    SLACK_MENTION_USER: str = ""  # Slack user ID to mention for urgent alerts

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If it's not valid JSON, treat as comma-separated string
                return [origin.strip() for origin in v.split(',')]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
