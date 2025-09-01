# Stage 1: Builder
FROM python:3.10-slim AS builder

WORKDIR /install

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --prefix="/install" -r requirements.txt

# Stage 2: Final Image
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /install /usr/local
COPY ./src /app/src

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN mkdir -p /app/src/app/db/chroma && \
    chown -R appuser:appgroup /app/src/app/db

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.app.app:app", "--host", "0.0.0.0", "--port", "8000"]