# Stage 1: Builder - Installs all dependencies including dev/test deps
FROM python:3.10-slim AS builder

WORKDIR /app

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies to the standard system locations
COPY requirements.txt .
RUN pip install -r requirements.txt


# Stage 2: Tester - Runs the tests
FROM builder AS tester
# The tester stage inherits everything from the builder, so dependencies are already installed.
COPY ./src /app/src
COPY ./tests /app/tests

# Run tests. If this command fails, the docker build will fail.
RUN pytest


# Stage 3: Final Image - Contains only the final application
FROM python:3.10-slim

WORKDIR /app

# Explicitly copy the installed packages and binaries from the builder stage
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy the application source code
COPY ./src /app/src

RUN addgroup --system appgroup && \
    adduser --system --no-create-home --ingroup appgroup appuser

RUN mkdir -p /app/src/app/db/chroma && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.app.app:app", "--host", "0.0.0.0", "--port", "8000"]