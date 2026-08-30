import os
import tempfile

# Garante um MODEL_DIR gravável e ambiente de dev (sem token/redis) ANTES de
# qualquer import de app.config (cujos defaults leem env em tempo de import).
os.environ.setdefault("MODEL_DIR", tempfile.mkdtemp(prefix="ml-models-"))
os.environ.pop("ML_SERVICE_TOKEN", None)
os.environ.pop("REDIS_URL", None)
