"""
config.py — Collector configuration loader/saver.

Reads a JSON config file (default `collector_config.json` in the collector
directory). Provides typed access to all tunable options with sane defaults.

Config keys:
    flush_interval : float  seconds between flush windows (default 15)
    api_url        : str    backend base URL (default http://localhost:8000)
    api_token      : str    JWT access token from login (may be empty)
    offline_mode   : bool   if True, never push to API (queue locally)
    start_on_login : bool   register a Windows startup entry
    daemon         : bool   run as background process (no console window)
    online_predict : bool   send feature vectors to /predict for live output
"""

import json
import os
from dataclasses import dataclass, asdict, field
from pathlib import Path

# Default config location: <collector_dir>/collector_config.json
COLLECTOR_DIR      = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = COLLECTOR_DIR / "collector_config.json"

DEFAULTS = {
    "flush_interval": 15,
    "api_url": "http://localhost:8000",
    "api_token": "",
    "offline_mode": False,
    "start_on_login": False,
    "daemon": False,
    "online_predict": False,
}


@dataclass
class CollectorConfig:
    flush_interval: float = 15
    api_url: str = "http://localhost:8000"
    api_token: str = ""
    offline_mode: bool = False
    start_on_login: bool = False
    daemon: bool = False
    online_predict: bool = False

    @property
    def behavior_url(self) -> str:
        return f"{self.api_url.rstrip('/')}/behavior"

    @property
    def predict_url(self) -> str:
        return f"{self.api_url.rstrip('/')}/predict"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "CollectorConfig":
        known = {k: v for k, v in data.items() if k in DEFAULTS}
        return cls(**known)


def load_config(path=None) -> CollectorConfig:
    """Load config from JSON file, merging over defaults."""
    path = Path(path) if path else DEFAULT_CONFIG_PATH
    cfg = CollectorConfig()

    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            cfg = CollectorConfig.from_dict(data)
        except (json.JSONDecodeError, OSError, TypeError):
            # Corrupt config → fall back to defaults
            cfg = CollectorConfig()

    # Apply environment overrides (mainly for testing / CI)
    cfg.api_url = os.getenv("COLLECTOR_API_URL", cfg.api_url)
    cfg.api_token = os.getenv("COLLECTOR_API_TOKEN", cfg.api_token)
    if os.getenv("COLLECTOR_OFFLINE_MODE"):
        cfg.offline_mode = os.getenv("COLLECTOR_OFFLINE_MODE").lower() in ("1", "true", "yes")
    return cfg


def save_config(cfg: CollectorConfig, path=None) -> Path:
    """Persist config to JSON file. Returns the path written."""
    path = Path(path) if path else DEFAULT_CONFIG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(cfg.to_dict(), indent=4, sort_keys=True),
        encoding="utf-8",
    )
    return path
