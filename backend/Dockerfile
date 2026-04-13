# 要件書 §7.3 のマルチステージ構成に準拠。
# - builder で uv による依存解決を行い、
# - runner には .venv とアプリコードのみ持ち込む。

FROM python:3.12-slim AS builder
WORKDIR /app

RUN pip install --no-cache-dir uv==0.10.2

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim AS runner
WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY src/ src/
COPY db/ db/
COPY alembic.ini ./

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8080
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
