FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 ironmind \
    && useradd --system --uid 10001 --gid ironmind --create-home ironmind

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ironmind:ironmind . .
RUN chmod +x scripts/entrypoint.sh \
    && mkdir -p /app/models \
    && chown -R ironmind:ironmind /app

USER ironmind
EXPOSE 8100

ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
