"""Tests for :class:`KBParserMode` resolution.

The mode is read at import time, so most of these tests use
``importlib.reload`` to re-trigger the resolution under different
environment variable states.
"""

from __future__ import annotations

import importlib
import os

import pytest


@pytest.fixture
def restore_env():
    """Snapshot ``KB_PARSER_MODE`` and ``KB_PARSER_ON_APPROVED``,
    restore on teardown so subsequent tests see clean state."""
    saved = {
        "KB_PARSER_MODE": os.environ.get("KB_PARSER_MODE"),
        "KB_PARSER_ON_APPROVED": os.environ.get("KB_PARSER_ON_APPROVED"),
    }
    yield
    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


def _reload_config():
    import app.config as cfg
    importlib.reload(cfg)
    return cfg


class TestModeResolution:
    def test_default_is_off(self, restore_env):
        os.environ.pop("KB_PARSER_MODE", None)
        cfg = _reload_config()
        assert cfg.KB_PARSER_MODE == cfg.KBParserMode.OFF

    def test_explicit_off(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "off"
        cfg = _reload_config()
        assert cfg.KB_PARSER_MODE == cfg.KBParserMode.OFF

    def test_shadow_mode(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "shadow"
        cfg = _reload_config()
        assert cfg.KB_PARSER_MODE == cfg.KBParserMode.SHADOW

    def test_unknown_mode_raises(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "weird"
        with pytest.raises(RuntimeError, match="not a valid mode"):
            _reload_config()

    def test_case_and_whitespace_normalised(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "  Shadow  "
        cfg = _reload_config()
        assert cfg.KB_PARSER_MODE == cfg.KBParserMode.SHADOW


class TestOnGate:
    def test_on_without_approval_raises(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "on"
        os.environ.pop("KB_PARSER_ON_APPROVED", None)
        with pytest.raises(RuntimeError, match="KB_PARSER_ON_APPROVED"):
            _reload_config()

    def test_on_with_approval_resolves(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "on"
        os.environ["KB_PARSER_ON_APPROVED"] = "phase-3d-review-001"
        cfg = _reload_config()
        assert cfg.KB_PARSER_MODE == cfg.KBParserMode.ON

    def test_empty_approval_value_is_rejected(self, restore_env):
        os.environ["KB_PARSER_MODE"] = "on"
        os.environ["KB_PARSER_ON_APPROVED"] = ""
        with pytest.raises(RuntimeError):
            _reload_config()
