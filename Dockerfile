# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ ./
RUN npm run build
# vite outDir '../static/react' → outputs to /app/static/react

# Stage 2: Build Python dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY pyproject.toml .
COPY README.md .
RUN mkdir -p research_and_analyst
COPY research_and_analyst/__init__.py research_and_analyst/

RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 3: Final image
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python packages from builder
COPY --from=builder /root/.local /root/.local

# Frontend build from frontend-builder
COPY --from=frontend-builder /app/static/react ./static/react

# Application code (excludes node_modules via .dockerignore)
COPY . .

RUN mkdir -p /app/generated_report /app/logs

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "research_and_analyst.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
