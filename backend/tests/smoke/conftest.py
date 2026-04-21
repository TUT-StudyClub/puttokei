"""Smoke test のスキップ制御。"""

from __future__ import annotations

import os

import pytest


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    if os.getenv("LLM_GEMINI_API_KEY"):
        return

    skip_marker = pytest.mark.skip(reason="LLM_GEMINI_API_KEY が未設定のため smoke test をスキップ")
    for item in items:
        if item.nodeid.startswith("tests/smoke/"):
            item.add_marker(skip_marker)
