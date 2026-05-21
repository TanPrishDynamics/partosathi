# ── e-Partogram Backend — Production Dockerfile ──────────────────────────────
# Security hardening:
#   - Non-root user (appuser:appuser)
#   - No package-cache in image layer (--no-cache-dir)
#   - Gunicorn WSGI server instead of Flask dev server
#   - Health-check endpoint for orchestrators
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Create non-root user before any COPY/RUN
RUN groupadd --system appuser && useradd --system --gid appuser --no-create-home appuser

WORKDIR /app

# Install deps as root (pip needs write access), then drop privileges
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hand ownership to non-root user; block world-write
RUN chown -R appuser:appuser /app && chmod -R o-w /app

USER appuser

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/api/health')" || exit 1

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:create_app()"]
