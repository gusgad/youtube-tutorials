"""Deterministic log-handling tools for the triage agent.

The LLM decides severity, root cause, and remediation; these tools only
load and pre-digest raw log data so the model works from structured facts.
"""

import os
import re
from collections import Counter
from pathlib import Path

# Logs ship inside the agent package so the same code works locally and on
# Agent Engine. Override with LOG_DIR to point at a real log directory.
_DEFAULT_LOG_DIR = Path(__file__).parent / "sample_logs"
_MAX_CHARS = 40_000

_LINE_RE = re.compile(
    r"^(?P<ts>\S+[ T]\S+?)\s+(?P<level>TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\s+"
    r"(?:\[(?P<service>[^\]]+)\]\s+)?(?P<message>.*)$"
)


def _log_dir() -> Path:
    return Path(os.environ.get("LOG_DIR", str(_DEFAULT_LOG_DIR)))


def _signature(message: str) -> str:
    """Collapse variable parts of a message so similar errors group together."""
    sig = re.sub(r"\b0x[0-9a-fA-F]+\b", "<hex>", message)
    sig = re.sub(r"\b[0-9a-f]{8}-[0-9a-f-]{27,}\b", "<uuid>", sig)
    sig = re.sub(r"\b\d+(\.\d+)?(ms|s|MB|GB|%)?\b", "<n>", sig)
    sig = re.sub(r"/[\w./-]{2,}", "<path>", sig)
    return sig.strip()[:160]


def list_log_files() -> dict:
    """List log files available for triage.

    Returns:
        dict with 'files' (name and size in bytes for each log file found).
    """
    d = _log_dir()
    if not d.is_dir():
        return {"status": "error", "message": f"Log directory not found: {d}"}
    files = [
        {"name": p.name, "size_bytes": p.stat().st_size}
        for p in sorted(d.iterdir())
        if p.is_file() and not p.name.startswith(".")
    ]
    return {"status": "ok", "directory": str(d), "files": files}


def read_log_file(filename: str) -> dict:
    """Read one log file and return its raw contents (truncated if very large).

    Args:
        filename: Name of a file returned by list_log_files. Path components
            are rejected; only files inside the configured log directory load.

    Returns:
        dict with 'content' plus a 'truncated' flag.
    """
    if "/" in filename or "\\" in filename or filename.startswith("."):
        return {"status": "error", "message": "Plain file names only."}
    path = _log_dir() / filename
    if not path.is_file():
        return {"status": "error", "message": f"No such log file: {filename}"}
    text = path.read_text(errors="replace")
    truncated = len(text) > _MAX_CHARS
    return {
        "status": "ok",
        "filename": filename,
        "truncated": truncated,
        "content": text[:_MAX_CHARS],
    }


def compute_log_stats(raw_logs: str) -> dict:
    """Pre-digest raw log text into structured stats for triage.

    Args:
        raw_logs: Raw log text (one entry per line, common
            'TIMESTAMP LEVEL [service] message' shape).

    Returns:
        dict with total/parsed line counts, counts by level and by service,
        the time range covered, and the most frequent WARN+ signatures with
        an example line for each.
    """
    lines = [ln for ln in raw_logs.splitlines() if ln.strip()]
    by_level: Counter = Counter()
    by_service: Counter = Counter()
    sig_counts: Counter = Counter()
    sig_example: dict[str, str] = {}
    timestamps: list[str] = []
    parsed = 0

    for ln in lines:
        m = _LINE_RE.match(ln.strip())
        if not m:
            continue
        parsed += 1
        level = m["level"].replace("WARNING", "WARN")
        by_level[level] += 1
        by_service[m["service"] or "unknown"] += 1
        timestamps.append(m["ts"])
        if level in ("WARN", "ERROR", "CRITICAL", "FATAL"):
            sig = f"{level}|{m['service'] or 'unknown'}|{_signature(m['message'])}"
            sig_counts[sig] += 1
            sig_example.setdefault(sig, ln.strip())

    top = [
        {"count": n, "signature": s, "example": sig_example[s]}
        for s, n in sig_counts.most_common(15)
    ]
    return {
        "status": "ok",
        "total_lines": len(lines),
        "parsed_lines": parsed,
        "by_level": dict(by_level),
        "by_service": dict(by_service),
        "time_range": {
            "first": min(timestamps) if timestamps else None,
            "last": max(timestamps) if timestamps else None,
        },
        "top_issues": top,
    }
