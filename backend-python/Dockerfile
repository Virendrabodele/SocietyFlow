FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --upgrade pip

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Create 'app' symlink so "from app.X import Y" works
# (the codebase uses app.X style imports throughout)
RUN ln -sfn /app /app/app 2>/dev/null || true
RUN chmod +x /app/start.sh

EXPOSE 10000

# Set Python path so all imports resolve from /app
ENV PYTHONPATH=/app

# Run migrations with retry, then start the server
CMD ["/app/start.sh"]

RUN ln -s /app /app/app
ENV PYTHONPATH=/app
CMD alembic upgrade head && uvicorn main:app
