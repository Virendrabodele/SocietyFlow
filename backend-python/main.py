from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.v1.routes import (
    auth, societies, members, billing,
    invoices, payments, reports, bank_accounts, health
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="SocietyFlow API",
    description="Society Management System - Python/FastAPI Backend",
    version="1.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(societies.router, prefix="/api/v1/societies", tags=["Societies"])
app.include_router(members.router, prefix="/api/v1/societies", tags=["Members"])
app.include_router(billing.router, prefix="/api/v1/societies", tags=["Billing"])
app.include_router(invoices.router, prefix="/api/v1/societies", tags=["Invoices"])
app.include_router(payments.router, prefix="/api/v1/societies", tags=["Payments"])
app.include_router(bank_accounts.router, prefix="/api/v1/societies", tags=["Bank Accounts"])
app.include_router(reports.router, prefix="/api/v1/societies", tags=["Reports"])

@app.on_event("startup")
async def startup():
    print(f"🚀 SocietyFlow API started [{settings.ENV}]")

@app.on_event("shutdown")
async def shutdown():
    print("🛑 SocietyFlow API shutting down...")
