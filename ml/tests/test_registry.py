import importlib

import pytest


@pytest.fixture()
def reg(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_DIR", str(tmp_path))
    import app.config as config
    importlib.reload(config)
    import app.registry as registry
    importlib.reload(registry)
    return registry


def test_versions_increment_and_latest(reg):
    assert reg.list_versions("baseline") == []
    m1 = reg.save_model("baseline", metadata={"a": 1}, created_at="2026-08-29T00:00:00Z")
    m2 = reg.save_model("baseline", metadata={"a": 2}, created_at="2026-08-29T01:00:00Z")
    assert m1["version"] == "v1"
    assert m2["version"] == "v2"
    assert reg.list_versions("baseline") == ["v1", "v2"]
    assert reg.resolve_version("baseline", "latest") == "v2"
    assert reg.load_metadata("baseline")["a"] == 2
    assert reg.load_metadata("baseline", "v1")["a"] == 1


def test_save_and_load_artifact(reg):
    reg.save_model("mdl", model={"weights": [1, 2, 3]}, created_at="2026-08-29T00:00:00Z")
    loaded = reg.load_model("mdl", "latest")
    assert loaded == {"weights": [1, 2, 3]}


def test_missing_model_returns_none(reg):
    assert reg.resolve_version("nope") is None
    assert reg.load_metadata("nope") is None
    assert reg.load_model("nope") is None
