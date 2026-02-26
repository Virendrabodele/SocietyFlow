from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    ENV: str = "development"
    API_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/societyflow"

    # JWT
    JWT_ACCESS_SECRET: str = "change-me-access-secret"
    JWT_REFRESH_SECRET: str = "change-me-refresh-secret"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5500", "http://localhost:3000"]

    # Encryption (AES-256 - must be 32 chars)
    ENCRYPTION_KEY: str = "change-me-32-byte-encryption-key"

    # Email (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
