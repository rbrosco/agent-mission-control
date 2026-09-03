#!/usr/bin/env python3
"""Agent Mission Control — read-only fleet dashboard for local Hermes.

Single-file server, Python standard library only (no pip, no npm).
Binds to 127.0.0.1 ONLY. Every SQLite connection is opened strictly
read-only (file:...?mode=ro + PRAGMA query_only=1) and never writes to
any Hermes datastore. Consolidates data across all Hermes profiles
(dev, reach, scout, scribe, ...).

Run:
    python3 server.py
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")).expanduser()
# HERMES_HOME here is the *profile* home (e.g. .../profiles/dev), matching
# the original single-profile server. PROFILES_ROOT is the parent that
# contains every profile directory, used for fleet-wide aggregation.
PROFILES_ROOT = HERMES_HOME.parent if HERMES_HOME.name != ".hermes" else HERMES_HOME / "profiles"
if not PROFILES_ROOT.exists():
    # Fallback: derive from the well-known layout used across this box.
    PROFILES_ROOT = Path.home() / ".hermes" / "profiles"

GLOBAL_HERMES_HOME = Path.home() / ".hermes"
GLOBAL_KANBAN_DB = GLOBAL_HERMES_HOME / "kanban.db"
GLOBAL_CRON_DIR = GLOBAL_HERMES_HOME / "cron"
GATEWAY_STATE_JSON = GLOBAL_HERMES_HOME / "gateway_state.json"

BIND_HOST = "0.0.0.0"
BIND_PORT = int(os.environ.get("MC_PORT", "51763"))

# Basic auth credentials (set via env vars, with fallback)
AUTH_USER = os.environ.get("MC_USER", "admin")
AUTH_PASS = os.environ.get("MC_PASS", "change-me")

STATIC_DIR = Path(__file__).resolve().parent
INDEX_HTML = STATIC_DIR / "index.html"

# Upload target: same directory as server.py / index.html.
UPLOAD_DIR = STATIC_DIR
ALLOWED_UPLOAD_EXTENSIONS = {".html", ".png", ".jpg", ".jpeg", ".webp", ".svg"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB safety cap

# Design source of truth: the untouched uploaded template. index.html is a
# working COPY that gets wired to real data over time; TEMPLATE_HTML is the
# pristine original, always served as-is at /template for design reference.
TEMPLATE_HTML = STATIC_DIR / "hermes-dashboard-template.html"

# ---------------------------------------------------------------------------
# Chat integration (the ONLY route in this file with real side effects)
# ---------------------------------------------------------------------------
# /api/chat/send shells out to the real Hermes CLI for a given profile
# (e.g. `scout chat -q "..." --oneshot -Q`). This is a REAL model call:
# it costs real API money and can take up to ~2 minutes. It is restricted
# to a fixed whitelist of profile aliases below — never accept an
# arbitrary/unvalidated profile string here.
ALLOWED_CHAT_PROFILES = {"dev", "reach", "scout", "scribe"}
CHAT_SUBPROCESS_TIMEOUT_SECONDS = 120
CHAT_MAX_MESSAGE_LENGTH = 4000
# Dedicated thread pool so a slow/hanging chat subprocess never blocks other
# requests. ThreadingHTTPServer already handles each request on its own
# thread, but we still route the blocking subprocess.run() through this
# pool explicitly so the intent is unambiguous and bounded (max 4 concurrent
# chat calls at once, to avoid a flood of subprocesses).
CHAT_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="chat-send")


def _discover_profiles() -> list[str]:
    """List profile directory names under PROFILES_ROOT that have a state.db."""
    if not PROFILES_ROOT.exists():
        return []
    names = []
    for entry in sorted(PROFILES_ROOT.iterdir()):
        if entry.is_dir() and (entry / "state.db").exists():
            names.append(entry.name)
    return names


PROFILE_NAMES = _discover_profiles()


# ---------------------------------------------------------------------------
# Strictly read-only SQLite helpers
# ---------------------------------------------------------------------------

def _ro_connect(db_path: Path) -> sqlite3.Connection:
    """Open a SQLite database strictly read-only.

    Two independent layers of protection:
      1. The URI query string `mode=ro` — SQLite refuses to open the file
         for writing at the OS level.
      2. `PRAGMA query_only=1` — even INSIDE this connection, any statement
         that would write is rejected by SQLite itself.

    `immutable=0` (the default) is used deliberately, NOT immutable=1:
    the Hermes gateway may still be writing to these files while this
    dashboard reads them, and `immutable=1` assumes the file never
    changes on disk, which would serve stale/cached data or error out.
    """
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    uri = f"file:{db_path.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=5)
    conn.execute("PRAGMA query_only=1")
    conn.row_factory = sqlite3.Row
    return conn


def _rows_to_dicts(rows) -> list[dict]:
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Data accessors — fleet-wide (across all profiles)
# ---------------------------------------------------------------------------

def get_sessions(limit: int = 50, profile: str | None = None) -> list[dict]:
    """Sessions across all profiles (or a single profile), newest first."""
    profiles = [profile] if profile else PROFILE_NAMES
    all_rows: list[dict] = []
    for prof in profiles:
        db_path = PROFILES_ROOT / prof / "state.db"
        try:
            conn = _ro_connect(db_path)
        except FileNotFoundError:
            continue
        try:
            cur = conn.execute(
                """
                SELECT id, source, chat_id, thread_id, profile_name, model,
                       started_at, ended_at, last_activity_at,
                       message_count, tool_call_count,
                       input_tokens, output_tokens,
                       estimated_cost_usd, actual_cost_usd,
                       title, cwd
                FROM sessions
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = _rows_to_dicts(cur.fetchall())
            for row in rows:
                row["profile"] = prof
            all_rows.extend(rows)
        finally:
            conn.close()

    all_rows.sort(key=lambda r: r.get("started_at") or 0, reverse=True)
    return all_rows[:limit]


def get_messages(limit: int = 50, session_id: str | None = None, profile: str | None = None) -> list[dict]:
    """Messages across all profiles (or a single profile), newest first."""
    profiles = [profile] if profile else PROFILE_NAMES
    all_rows: list[dict] = []
    for prof in profiles:
        db_path = PROFILES_ROOT / prof / "state.db"
        try:
            conn = _ro_connect(db_path)
        except FileNotFoundError:
            continue
        try:
            if session_id:
                cur = conn.execute(
                    """
                    SELECT id, session_id, role, content, timestamp,
                           token_count, tool_name, finish_reason
                    FROM messages
                    WHERE session_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (session_id, limit),
                )
            else:
                cur = conn.execute(
                    """
                    SELECT id, session_id, role, content, timestamp,
                           token_count, tool_name, finish_reason
                    FROM messages
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            rows = _rows_to_dicts(cur.fetchall())
            for row in rows:
                content = row.get("content") or ""
                if len(content) > 400:
                    row["content"] = content[:400] + "…"
                row["profile"] = prof
            all_rows.extend(rows)
        finally:
            conn.close()

    all_rows.sort(key=lambda r: r.get("timestamp") or 0, reverse=True)
    return all_rows[:limit]


def get_content_documents(limit: int = 60, min_length: int = 600) -> dict:
    """'Library' tab data source.

    IMPORTANT DESIGN DECISION (see final report): there is no dedicated
    documents/files table in the current Hermes install (no CMS, no
    generated-markdown directory convention we could verify). Rather than
    inventing fake documents, we treat long assistant replies (role=assistant,
    content length >= min_length chars) as a reasonable, fully REAL proxy for
    "substantial written output" per agent. Every entry here traces back to
    an actual row in a profile's state.db `messages` table — nothing is
    synthesized. The API response is explicit about this via `source`.
    """
    docs: list[dict] = []
    for prof in PROFILE_NAMES:
        db_path = PROFILES_ROOT / prof / "state.db"
        try:
            conn = _ro_connect(db_path)
        except FileNotFoundError:
            continue
        try:
            cur = conn.execute(
                """
                SELECT id, session_id, content, timestamp
                FROM messages
                WHERE role = 'assistant' AND length(content) >= ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (min_length, limit),
            )
            for row in cur.fetchall():
                content = row["content"] or ""
                first_line = content.strip().splitlines()[0] if content.strip() else "(untitled)"
                title = first_line[:120]
                docs.append(
                    {
                        "id": row["id"],
                        "session_id": row["session_id"],
                        "profile": prof,
                        "title": title,
                        "excerpt": content[:400],
                        "char_count": len(content),
                        "timestamp": row["timestamp"],
                    }
                )
        except sqlite3.Error:
            continue
        finally:
            conn.close()

    docs.sort(key=lambda d: d.get("timestamp") or 0, reverse=True)
    docs = docs[:limit]
    return {
        "source": "derived_from_messages",
        "note": (
            "No dedicated documents table exists yet. These are long "
            "assistant messages (>= "
            f"{min_length} chars) from each profile's real message history, "
            "used as a stand-in for 'written output' until a real docs "
            "store exists."
        ),
        "documents": docs,
        "total": len(docs),
        "agents_writing": sorted({d["profile"] for d in docs}),
    }


def get_kanban_tasks(limit: int = 100) -> list[dict]:
    """Kanban tasks from the global board plus any per-profile boards."""
    db_paths: list[tuple[str, Path]] = []
    if GLOBAL_KANBAN_DB.exists():
        db_paths.append(("global", GLOBAL_KANBAN_DB))
    for prof in PROFILE_NAMES:
        p = PROFILES_ROOT / prof / "kanban.db"
        if p.exists():
            db_paths.append((prof, p))

    all_rows: list[dict] = []
    for label, db_path in db_paths:
        try:
            conn = _ro_connect(db_path)
        except FileNotFoundError:
            continue
        try:
            cur = conn.execute(
                """
                SELECT id, title, status, assignee, priority,
                       created_by, created_at, started_at, completed_at,
                       project_id, last_heartbeat_at, consecutive_failures
                FROM tasks
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = _rows_to_dicts(cur.fetchall())
            for row in rows:
                row["board"] = label
            all_rows.extend(rows)
        except sqlite3.Error:
            continue
        finally:
            conn.close()

    # De-duplicate by id (global board and a profile board could in theory
    # point at the same file); keep the first occurrence.
    seen = set()
    deduped = []
    for row in all_rows:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        deduped.append(row)

    deduped.sort(key=lambda r: r.get("created_at") or 0, reverse=True)
    return deduped[:limit]


def get_cron_executions(limit: int = 100) -> list[dict]:
    """Cron job executions across all profiles plus the global cron dir."""
    cron_dirs: list[tuple[str, Path]] = []
    if (GLOBAL_CRON_DIR / "executions.db").exists():
        cron_dirs.append(("global", GLOBAL_CRON_DIR))
    for prof in PROFILE_NAMES:
        p = PROFILES_ROOT / prof / "cron"
        if (p / "executions.db").exists():
            cron_dirs.append((prof, p))

    all_rows: list[dict] = []
    for label, cron_dir in cron_dirs:
        db_path = cron_dir / "executions.db"
        try:
            conn = _ro_connect(db_path)
        except FileNotFoundError:
            continue
        try:
            cur = conn.execute(
                """
                SELECT id, job_id, source, process_id, pid,
                       process_started_at, status, claimed_at,
                       started_at, finished_at, error
                FROM executions
                ORDER BY claimed_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = _rows_to_dicts(cur.fetchall())
            for row in rows:
                row["profile"] = label
            all_rows.extend(rows)
        except sqlite3.Error:
            continue
        finally:
            conn.close()

    all_rows.sort(key=lambda r: r.get("claimed_at") or "", reverse=True)
    return all_rows[:limit]


def get_cron_jobs() -> list[dict]:
    """Derive a distinct job list (one row per job_id) from execution history.

    There's no separate job-definition table in this install, so each
    unique job_id's most recent execution row stands in for its current
    state (last status, last run time, profile it belongs to).
    """
    executions = get_cron_executions(limit=2000)
    jobs: dict[str, dict] = {}
    for run in executions:
        job_id = run["job_id"]
        existing = jobs.get(job_id)
        if existing is None or (run.get("claimed_at") or "") > (existing.get("claimed_at") or ""):
            jobs[job_id] = run

    job_list = list(jobs.values())
    job_list.sort(key=lambda r: r.get("claimed_at") or "", reverse=True)
    return job_list


def get_gateway_state() -> dict:
    if not GATEWAY_STATE_JSON.exists():
        return {"error": f"not found: {GATEWAY_STATE_JSON}"}
    with open(GATEWAY_STATE_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def get_summary() -> dict:
    """Fleet-wide aggregate counts for the dashboard header."""
    session_count = 0
    message_count = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_cost = 0.0
    per_profile: dict[str, dict] = {}

    for prof in PROFILE_NAMES:
        db_path = PROFILES_ROOT / prof / "state.db"
        try:
            conn = _ro_connect(db_path)
        except FileNotFoundError:
            continue
        try:
            s_count = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
            m_count = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            tok_row = conn.execute(
                "SELECT COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0), "
                "COALESCE(SUM(actual_cost_usd), COALESCE(SUM(estimated_cost_usd), 0)) "
                "FROM sessions"
            ).fetchone()
        finally:
            conn.close()

        session_count += s_count
        message_count += m_count
        total_input_tokens += tok_row[0] or 0
        total_output_tokens += tok_row[1] or 0
        total_cost += tok_row[2] or 0
        per_profile[prof] = {
            "session_count": s_count,
            "message_count": m_count,
            "input_tokens": tok_row[0] or 0,
            "output_tokens": tok_row[1] or 0,
        }

    task_count = None
    task_by_status: dict[str, int] = {}
    try:
        tasks = get_kanban_tasks(limit=5000)
        task_count = len(tasks)
        for t in tasks:
            status = t.get("status") or "unknown"
            task_by_status[status] = task_by_status.get(status, 0) + 1
    except Exception:
        pass

    cron_job_count = None
    try:
        cron_job_count = len(get_cron_jobs())
    except Exception:
        pass

    return {
        "profiles": PROFILE_NAMES,
        "session_count": session_count,
        "message_count": message_count,
        "input_tokens": total_input_tokens,
        "output_tokens": total_output_tokens,
        "estimated_cost_usd": round(total_cost, 4),
        "task_count": task_count,
        "task_by_status": task_by_status,
        "cron_job_count": cron_job_count,
        "per_profile": per_profile,
    }


# ---------------------------------------------------------------------------
# Chat: run a real `<profile> chat -q "..." --oneshot -Q` subprocess
# ---------------------------------------------------------------------------

def _run_chat_subprocess(profile: str, message: str) -> dict:
    """Execute the real Hermes CLI for `profile` with `message` and parse
    the response. Runs on CHAT_EXECUTOR's worker threads — never call this
    directly on the HTTP handler thread for a synchronous response without
    going through the executor, since it blocks for up to ~2 minutes.

    Observed CLI output shape (confirmed manually against `scout`):
        Warning: Unknown toolsets: a2a, stt      <- optional, stderr-ish noise on stdout
        session_id: 20260902_232502_c9aa24
        <agent's actual response, possibly multi-line>
    """
    cmd = [profile, "chat", "-q", message, "--oneshot", "-Q"]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=CHAT_SUBPROCESS_TIMEOUT_SECONDS,
            shell=False,  # never shell=True — cmd is an explicit arg list
        )
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": f"chat command timed out after {CHAT_SUBPROCESS_TIMEOUT_SECONDS}s",
            "status": 504,
        }
    except OSError as exc:
        return {"ok": False, "error": f"failed to launch chat command: {exc}", "status": 500}

    if result.returncode != 0:
        stderr_tail = (result.stderr or "").strip()[-2000:]
        return {
            "ok": False,
            "error": f"chat command exited with code {result.returncode}: {stderr_tail or 'no stderr output'}",
            "status": 500,
        }

    stdout = result.stdout or ""
    stderr = result.stderr or ""

    # Observed behavior differs depending on whether stdin/stdout is a TTY:
    # in a real terminal, "session_id: ..." lands on stdout right before the
    # response. Under subprocess.run (no TTY, which is our case here), the
    # CLI instead sends "session_id: ..." to STDERR and keeps stdout to just
    # warning banners (e.g. "Warning: ...") followed by the actual response.
    # We search BOTH streams for the session_id line, and treat stdout
    # (minus any "Warning:" noise lines) as the response — falling back to
    # scanning stdout for a session_id line too, in case CLI behavior varies
    # across profiles/versions.
    session_id = None
    for stream in (stdout, stderr):
        for line in stream.splitlines():
            m = re.match(r"^session_id:\s*(\S+)", line.strip())
            if m:
                session_id = m.group(1)
                break
        if session_id:
            break

    stdout_lines = stdout.splitlines()
    # Drop a leading "session_id: ..." line if present on stdout (TTY case),
    # and drop noise/banner lines wherever they appear — "Warning: ..." and
    # "⚠ ..." lines (e.g. the tirith security-scanner availability notice)
    # are CLI startup banners, not part of the agent's actual answer.
    response_lines = []
    for line in stdout_lines:
        stripped = line.strip()
        if re.match(r"^session_id:\s*\S+", stripped):
            continue
        if stripped.startswith("Warning:") or stripped.startswith("⚠"):
            continue
        response_lines.append(line)

    response_text = "\n".join(response_lines).strip()
    if not response_text:
        response_text = stdout.strip()  # last-resort fallback, still show *something*

    return {"ok": True, "response": response_text, "session_id": session_id}


# ---------------------------------------------------------------------------
# Docs tab: static, hand-written explanation of the dashboard itself.
# Content lives in index.html (plain HTML), not here — this dashboard does
# not need an API for it. Nothing to fetch; documented for completeness.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Upload handling (stdlib-only multipart/form-data parser — no `cgi`,
# which is deprecated/removed in newer Python versions)
# ---------------------------------------------------------------------------

class MultipartParseError(ValueError):
    pass


def _parse_multipart_file(content_type: str, body: bytes) -> tuple[str, bytes]:
    """Minimal, stdlib-only multipart/form-data parser.

    Extracts the first file part (expects field name "file") and returns
    (original_filename, file_bytes). Deliberately does NOT use the `cgi`
    module, which is deprecated and removed in newer Python versions.
    """
    match = re.search(r'boundary="?([^";]+)"?', content_type)
    if not match:
        raise MultipartParseError("missing multipart boundary")
    boundary = match.group(1).encode("utf-8")
    delimiter = b"--" + boundary

    parts = body.split(delimiter)

    for part in parts:
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue
        headers_blob, _, content = part.partition(b"\r\n\r\n")
        headers_text = headers_blob.decode("utf-8", errors="replace")
        disposition_match = re.search(
            r'Content-Disposition:\s*form-data;([^\r\n]*)', headers_text, re.IGNORECASE
        )
        if not disposition_match:
            continue
        disposition_params = disposition_match.group(1)
        name_match = re.search(r'name="([^"]*)"', disposition_params)
        filename_match = re.search(r'filename="([^"]*)"', disposition_params)
        if not filename_match:
            continue  # not a file part
        field_name = name_match.group(1) if name_match else ""
        if field_name and field_name != "file":
            continue
        filename = filename_match.group(1)
        if content.endswith(b"\r\n"):
            content = content[:-2]
        return filename, content

    raise MultipartParseError("no file part found in multipart body")


def _validate_upload_filename(raw_name: str) -> str:
    """Validate an uploaded filename; returns the safe basename or raises ValueError.

    Rejects path traversal (any '/' or '..' in the raw name) and enforces
    the extension whitelist. Uses Path(...).name as a second, independent
    layer of defense on top of the explicit substring checks.
    """
    if not raw_name:
        raise ValueError("empty filename")
    if "/" in raw_name or "\\" in raw_name or ".." in raw_name:
        raise ValueError("path traversal characters are not allowed in filename")

    safe_name = Path(raw_name).name
    if not safe_name or safe_name != raw_name:
        raise ValueError("invalid filename")

    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_UPLOAD_EXTENSIONS))
        raise ValueError(f"file extension '{ext}' not allowed (allowed: {allowed})")

    return safe_name


UPLOAD_PAGE_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Mission Control — Upload</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f1117; color: #e6e6e6; margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    width: 100%; max-width: 480px; background: #171a23;
    border: 1px solid #2a2f3d; border-radius: 12px; padding: 32px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }
  h1 { font-size: 1.4rem; margin: 0 0 6px; }
  p.sub { color: #9aa1b2; margin: 0 0 24px; font-size: 0.9rem; }
  .file-input-wrap {
    border: 2px dashed #3a4055; border-radius: 8px; padding: 24px;
    text-align: center; margin-bottom: 16px; transition: border-color 0.2s;
  }
  .file-input-wrap.has-file { border-color: #4f8cff; }
  input[type="file"] { color: #e6e6e6; width: 100%; }
  #filename { margin-top: 10px; font-size: 0.85rem; color: #7dd3a0; word-break: break-all; }
  button {
    width: 100%; padding: 12px; border: none; border-radius: 8px;
    background: #4f8cff; color: #fff; font-size: 1rem; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  button:hover:not(:disabled) { background: #3d75e0; }
  button:disabled { background: #2a2f3d; color: #6a7080; cursor: not-allowed; }
  #status {
    margin-top: 18px; padding: 12px 14px; border-radius: 8px;
    font-size: 0.9rem; display: none; word-break: break-word;
  }
  #status.ok {
    display: block; background: rgba(80, 200, 120, 0.12);
    border: 1px solid rgba(80, 200, 120, 0.4); color: #7dd3a0;
  }
  #status.err {
    display: block; background: rgba(255, 90, 90, 0.12);
    border: 1px solid rgba(255, 90, 90, 0.4); color: #ff8a8a;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Upload de arquivo</h1>
    <p class="sub">Envie o modelo HTML (ou imagem de referência) para o Agent Mission Control.</p>
    <form id="upload-form">
      <div class="file-input-wrap" id="file-wrap">
        <input type="file" id="file-input" name="file"
               accept=".html,.png,.jpg,.jpeg,.webp,.svg" required>
        <div id="filename"></div>
      </div>
      <button type="submit" id="submit-btn">Upload</button>
    </form>
    <div id="status"></div>
  </div>
<script>
(function () {
  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('file-input');
  const fileWrap = document.getElementById('file-wrap');
  const filenameEl = document.getElementById('filename');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('submit-btn');

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      filenameEl.textContent = fileInput.files[0].name;
      fileWrap.classList.add('has-file');
    } else {
      filenameEl.textContent = '';
      fileWrap.classList.remove('has-file');
    }
    statusEl.className = ''; statusEl.textContent = '';
  });

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    if (!fileInput.files.length) return;
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file, file.name);
    submitBtn.disabled = true; submitBtn.textContent = 'Enviando...';
    statusEl.className = ''; statusEl.textContent = '';

    fetch('/api/upload', { method: 'POST', body: formData })
      .then(function (resp) {
        return resp.json().then(function (data) { return { status: resp.status, data: data }; });
      })
      .then(function (result) {
        if (result.status === 200 && result.data.ok) {
          statusEl.className = 'ok';
          statusEl.textContent = '✅ Upload concluído: "' + result.data.filename +
            '" salvo em ' + result.data.path;
        } else {
          statusEl.className = 'err';
          statusEl.textContent = '❌ Erro: ' + (result.data.error || 'falha desconhecida');
        }
      })
      .catch(function (err) {
        statusEl.className = 'err';
        statusEl.textContent = '❌ Erro de rede: ' + err;
      })
      .finally(function () {
        submitBtn.disabled = false; submitBtn.textContent = 'Upload';
      });
  });
})();
</script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "AgentMissionControl/2.0"

    def log_message(self, fmt, *args):  # quieter default logging
        pass

    def _check_auth(self) -> bool:
        """Check HTTP Basic Auth. Returns True if authorized, False otherwise (and sends 401)."""
        import base64
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Basic "):
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="Agent Mission Control"')
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<h1>401 Unauthorized</h1><p>Authentication required.</p>")
            return False
        
        try:
            encoded = auth_header.split(" ")[1]
            decoded = base64.b64decode(encoded).decode("utf-8")
            username, password = decoded.split(":", 1)
        except Exception:
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="Agent Mission Control"')
            self.end_headers()
            return False
        
        if username != AUTH_USER or password != AUTH_PASS:
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="Agent Mission Control"')
            self.end_headers()
            self.wfile.write(b"<h1>401 Unauthorized</h1><p>Invalid credentials.</p>")
            return False
        
        return True

    def _cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:  # noqa: N802 (stdlib naming)
        self.send_response(204)
        self._cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _send_json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, content_type: str) -> None:
        if not path.exists():
            self._send_json({"error": "not found"}, status=404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, body_text: str) -> None:
        body = body_text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _is_next_dashboard_available(self) -> bool:
        try:
            with __import__("socket").socket(__import__("socket").AF_INET, __import__("socket").SOCK_STREAM) as sock:
                sock.settimeout(0.3)
                sock.connect(("127.0.0.1", 3001))
            return True
        except OSError:
            return False

    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        if not self._check_auth():
            return
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        try:
            if path == "/" or path == "/index.html":
                if self._is_next_dashboard_available():
                    self.send_response(302)
                    self.send_header("Location", "http://127.0.0.1:3001/")
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    return
                self._send_file(INDEX_HTML, "text/html; charset=utf-8")
            elif path == "/app.js":
                self._send_file(STATIC_DIR / "app.js", "application/javascript; charset=utf-8")
            elif path == "/template":
                self._send_file(TEMPLATE_HTML, "text/html; charset=utf-8")
            elif path == "/upload":
                self._send_html(UPLOAD_PAGE_HTML)
            elif path == "/api/summary":
                self._send_json(get_summary())
            elif path == "/api/sessions":
                limit = int(qs.get("limit", ["50"])[0])
                profile = qs.get("profile", [None])[0]
                self._send_json(get_sessions(limit=limit, profile=profile))
            elif path == "/api/messages":
                limit = int(qs.get("limit", ["50"])[0])
                session_id = qs.get("session_id", [None])[0]
                profile = qs.get("profile", [None])[0]
                self._send_json(get_messages(limit=limit, session_id=session_id, profile=profile))
            elif path == "/api/kanban":
                limit = int(qs.get("limit", ["100"])[0])
                self._send_json(get_kanban_tasks(limit=limit))
            elif path == "/api/cron/executions":
                limit = int(qs.get("limit", ["100"])[0])
                self._send_json(get_cron_executions(limit=limit))
            elif path == "/api/cron/jobs":
                self._send_json(get_cron_jobs())
            elif path == "/api/gateway":
                self._send_json(get_gateway_state())
            elif path == "/api/profiles":
                self._send_json({"profiles": PROFILE_NAMES})
            elif path == "/api/content":
                # CONTENT/"Library" tab: there is no documents table in this
                # install. Rather than fabricate fake documents, we surface
                # long assistant messages (role=assistant, content length
                # over a threshold) as a reasonable real proxy for "things
                # agents wrote", clearly labeled as derived from messages.
                self._send_json(get_content_documents())
            else:
                self._send_json({"error": "not found", "path": path}, status=404)
        except FileNotFoundError as exc:
            self._send_json({"error": str(exc)}, status=500)
        except sqlite3.Error as exc:
            self._send_json({"error": f"sqlite error: {exc}"}, status=500)

    def do_POST(self) -> None:  # noqa: N802 (stdlib naming)
        if not self._check_auth():
            return
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/chat/send":
            self._handle_chat_send()
            return

        if path != "/api/upload":
            self._send_json({"error": "not found", "path": path}, status=404)
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._send_json({"ok": False, "error": "expected multipart/form-data"}, status=400)
            return

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            self._send_json({"ok": False, "error": "empty request body"}, status=400)
            return
        if content_length > MAX_UPLOAD_BYTES:
            self._send_json(
                {"ok": False, "error": f"file exceeds {MAX_UPLOAD_BYTES} byte limit"}, status=413
            )
            return

        body = self.rfile.read(content_length)

        try:
            raw_filename, file_bytes = _parse_multipart_file(content_type, body)
        except MultipartParseError as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=400)
            return

        try:
            safe_filename = _validate_upload_filename(raw_filename)
        except ValueError as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=400)
            return

        try:
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            dest_path = UPLOAD_DIR / safe_filename

            resolved_dir = UPLOAD_DIR.resolve()
            resolved_dest = dest_path.resolve()
            if resolved_dir not in resolved_dest.parents and resolved_dest != resolved_dir:
                self._send_json(
                    {"ok": False, "error": "resolved path escapes upload directory"}, status=400
                )
                return

            dest_path.write_bytes(file_bytes)
        except OSError as exc:
            self._send_json({"ok": False, "error": f"failed to save file: {exc}"}, status=500)
            return

        self._send_json({"ok": True, "filename": safe_filename, "path": str(dest_path)})

    def _handle_chat_send(self) -> None:
        """POST /api/chat/send — the ONLY route with real side effects.

        Body: {"profile": "<one of ALLOWED_CHAT_PROFILES>", "message": "<text>"}
        Runs a REAL Hermes CLI subprocess (real model call, real API cost,
        can take up to CHAT_SUBPROCESS_TIMEOUT_SECONDS). Dispatched onto
        CHAT_EXECUTOR so this thread blocks (it must, to answer the HTTP
        request), but OTHER concurrent requests handled by
        ThreadingHTTPServer on their own threads are unaffected — verified
        by firing two overlapping requests in testing (see build report).
        """
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0 or content_length > 20_000:
            self._send_json({"ok": False, "error": "invalid or missing request body"}, status=400)
            return

        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json({"ok": False, "error": "request body must be valid JSON"}, status=400)
            return

        profile = payload.get("profile")
        message = payload.get("message")

        if not isinstance(profile, str) or profile not in ALLOWED_CHAT_PROFILES:
            self._send_json(
                {
                    "ok": False,
                    "error": f"profile must be one of: {sorted(ALLOWED_CHAT_PROFILES)}",
                },
                status=400,
            )
            return

        if not isinstance(message, str) or not message.strip():
            self._send_json({"ok": False, "error": "message must be a non-empty string"}, status=400)
            return

        if len(message) > CHAT_MAX_MESSAGE_LENGTH:
            self._send_json(
                {"ok": False, "error": f"message exceeds {CHAT_MAX_MESSAGE_LENGTH} character limit"},
                status=400,
            )
            return

        # Dispatch the blocking subprocess call to the bounded thread pool
        # and wait for it here. This handler's own thread is one of many
        # ThreadingHTTPServer spins up, so other in-flight requests are
        # still served concurrently while we wait.
        future = CHAT_EXECUTOR.submit(_run_chat_subprocess, profile, message.strip())
        try:
            result = future.result(timeout=CHAT_SUBPROCESS_TIMEOUT_SECONDS + 5)
        except Exception as exc:  # pool-level failure, not the subprocess itself
            self._send_json({"ok": False, "error": f"chat dispatch failed: {exc}"}, status=500)
            return

        if not result.get("ok"):
            status = result.get("status", 500)
            self._send_json({"ok": False, "error": result.get("error", "unknown error")}, status=status)
            return

        self._send_json({"ok": True, "response": result["response"], "session_id": result.get("session_id")})


def main() -> None:
    server = ThreadingHTTPServer((BIND_HOST, BIND_PORT), Handler)
    print(f"Agent Mission Control (read-only) — http://{BIND_HOST}:{BIND_PORT}")
    print(f"HERMES_HOME = {HERMES_HOME}")
    print(f"PROFILES_ROOT = {PROFILES_ROOT}")
    print(f"Profiles discovered = {PROFILE_NAMES}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
