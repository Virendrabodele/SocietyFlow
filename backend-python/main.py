import json
import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.security import decode_access_token
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
    # Import ALL models first so Base.metadata knows every table
    import app.models.models  # noqa: F401
    from app.db.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f"🚀 SocietyFlow API started [{settings.ENV}]")


@app.on_event("shutdown")
async def shutdown():
    print("🛑 SocietyFlow API shutting down...")


# Activity logging middleware — runs AFTER startup so tables exist
society_path_re = re.compile(r"/api/v1/societies/([^/]+)")

@app.middleware("http")
async def capture_frontend_activity(request: Request, call_next):
    raw_body = await request.body()
    response = await call_next(request)

    # Skip logging for health checks to avoid noise
    if request.url.path.startswith("/health"):
        return response

    try:
        from app.db.database import AsyncSessionLocal
        from app.models.models import FrontendActivityLog

        user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            try:
                payload = decode_access_token(token)
                user_id = payload.get("userId")
            except Exception:
                user_id = None

        society_id = None
        match = society_path_re.search(request.url.path)
        if match:
            society_id = match.group(1)

        parsed_body = None
        if raw_body:
            try:
                parsed_body = json.loads(raw_body.decode("utf-8"))
            except Exception:
                parsed_body = {"raw": raw_body.decode("utf-8", errors="ignore")[:500]}

        async with AsyncSessionLocal() as session:
            session.add(
                FrontendActivityLog(
                    user_id=user_id,
                    society_id=society_id,
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    query_params=dict(request.query_params),
                    request_body=parsed_body,
                    source_ip=request.client.host if request.client else None,
                )
            )
            await session.commit()
    except Exception:
        pass  # Never let logging crash the app

    return response
