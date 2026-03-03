FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Create symlink so "from app.X import Y" works
RUN ln -sfn /app /app/app 2>/dev/null || true

# Set Python path
ENV PYTHONPATH=/app

EXPOSE 10000

# Run migrations then start server
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
