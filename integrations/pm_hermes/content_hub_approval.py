"""Local exact-once approval receipts for Content Hub agent actions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
from typing import Callable
from uuid import UUID


ACTION_TYPES = frozenset(
    {
        "create_idea",
        "create_entry",
        "update_entry",
        "add_comment",
        "submit_for_review",
        "create_report",
        "update_report",
    }
)
TERMINAL_STATES = frozenset({"executed", "expired", "failed", "outcome_unknown"})
HASH = re.compile(r"^[a-f0-9]{64}$")
IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9._:-]{8,160}$")
APPROVAL_REFERENCE = re.compile(r"^cha_[a-f0-9]{24}$")


def _default_ledger_path() -> Path:
    population_matters_root = Path(__file__).resolve().parents[4]
    return (
        population_matters_root / ".hermes" / "data" / "content-hub-approvals.sqlite3"
    )


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _action_id(value: object) -> str:
    cleaned = str(value or "").strip()
    try:
        parsed = UUID(cleaned)
    except ValueError as error:
        raise ValueError("The Content Hub action ID is invalid.") from error
    if str(parsed) != cleaned.lower():
        raise ValueError("The Content Hub action ID is invalid.")
    return cleaned.lower()


def _timestamp(value: object, label: str) -> str:
    cleaned = str(value or "").strip()
    try:
        parsed = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"The Content Hub {label} is invalid.") from error
    if parsed.tzinfo is None:
        raise ValueError(f"The Content Hub {label} is invalid.")
    return parsed.astimezone(timezone.utc).isoformat()


def _bounded_text(value: object, label: str, maximum: int) -> str:
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value) > maximum
        or "\0" in value
    ):
        raise ValueError(f"The Content Hub {label} is invalid.")
    return value.strip()


@dataclass(frozen=True)
class ContentHubWritePolicy:
    proposals_enabled: bool
    writes_enabled: bool
    enabled_actions: frozenset[str]
    approver_label: str

    @classmethod
    def load(cls) -> "ContentHubWritePolicy":
        enabled_actions = frozenset(
            item.strip()
            for item in os.environ.get("CONTENT_HUB_HERMES_ENABLED_ACTIONS", "").split(
                ","
            )
            if item.strip() in ACTION_TYPES
        )
        approver_label = os.environ.get(
            "CONTENT_HUB_HERMES_APPROVER_LABEL", "Dan"
        ).strip()
        if not approver_label or len(approver_label) > 160:
            approver_label = "Dan"
        return cls(
            proposals_enabled=_true(
                os.environ.get("CONTENT_HUB_HERMES_PROPOSALS_ENABLED", "")
            ),
            writes_enabled=_true(
                os.environ.get("CONTENT_HUB_HERMES_WRITES_ENABLED", "")
            ),
            enabled_actions=enabled_actions,
            approver_label=approver_label,
        )

    def require_proposal(self, action_type: str) -> None:
        if action_type not in ACTION_TYPES:
            raise PermissionError("The Content Hub action is not supported.")
        if not self.proposals_enabled or action_type not in self.enabled_actions:
            raise PermissionError(
                f"Content Hub {action_type} proposals are disabled by the local emergency stop."
            )

    def require_execution(self, action_type: str) -> None:
        self.require_proposal(action_type)
        if not self.writes_enabled:
            raise PermissionError(
                "Content Hub action execution is disabled by the local emergency stop."
            )

    def public_status(self) -> dict[str, object]:
        return {
            "proposalsEnabled": self.proposals_enabled,
            "writesEnabled": self.writes_enabled,
            "enabledActions": sorted(self.enabled_actions),
            "approvalScope": "exact_action_id_once",
            "approvalCommand": "execute <action-id>",
            "approvalReceiptSource": "operator_only_outside_mcp",
        }


def _true(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


class ContentHubApprovalLedger:
    """Mode-600 ledger separating operator approval from MCP execution."""

    def __init__(
        self,
        path: Path | None = None,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.path = path or _default_ledger_path()
        self._now = now or _utc_now
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialise()

    def register(self, action: dict[str, object]) -> dict[str, object]:
        clean = self._validate_action(action)
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean["action_id"],),
            ).fetchone()
            if row is not None:
                existing = self._normalise(row)
                if any(
                    existing[key] != clean[key]
                    for key in (
                        "action_type",
                        "payload_hash",
                        "idempotency_key",
                        "expires_at",
                    )
                ):
                    raise ValueError(
                        "The Content Hub action ID is already bound to another proposal."
                    )
                return existing
            connection.execute(
                """
                INSERT INTO content_hub_approvals(
                    action_id, action_type, target_id, payload_hash, idempotency_key,
                    summary, status, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'awaiting_exact_approval', ?, ?)
                """,
                (
                    clean["action_id"],
                    clean["action_type"],
                    clean["target_id"],
                    clean["payload_hash"],
                    clean["idempotency_key"],
                    clean["summary"],
                    clean["created_at"],
                    clean["expires_at"],
                ),
            )
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean["action_id"],),
            ).fetchone()
        if row is None:
            raise RuntimeError("The Content Hub approval receipt could not be stored.")
        return self._normalise(row)

    def get(self, action_id: str) -> dict[str, object]:
        clean_id = _action_id(action_id)
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Unknown Content Hub action: {clean_id}.")
            row = self._expire_if_needed(connection, row)
        return self._normalise(row)

    def approve_exact(
        self,
        action_id: str,
        *,
        confirm: str,
        approved_by: str,
    ) -> dict[str, object]:
        clean_id = _action_id(action_id)
        if confirm != f"execute {clean_id}":
            raise ValueError(f"Confirmation must be exactly: execute {clean_id}")
        clean_approver = _bounded_text(approved_by, "approver", 160)
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Unknown Content Hub action: {clean_id}.")
            row = self._expire_if_needed(connection, row)
            if row["status"] == "executed":
                result = self._normalise(row)
                result["idempotent_replay"] = True
                return result
            if row["status"] == "approved":
                return self._normalise(row)
            if row["status"] != "awaiting_exact_approval":
                raise ValueError(
                    f"The Content Hub action cannot be approved from state {row['status']}."
                )
            approval_reference = f"cha_{secrets.token_hex(12)}"
            approved_at = self._now().astimezone(timezone.utc).isoformat()
            cursor = connection.execute(
                """
                UPDATE content_hub_approvals
                   SET status='approved', approval_reference=?, approved_by=?,
                       approved_at=?, updated_at=?
                 WHERE action_id=? AND status='awaiting_exact_approval'
                """,
                (
                    approval_reference,
                    clean_approver,
                    approved_at,
                    approved_at,
                    clean_id,
                ),
            )
            if cursor.rowcount != 1:
                raise ValueError("The Content Hub approval was already recorded.")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError("The Content Hub approval could not be reloaded.")
        return self._normalise(row)

    def claim_approved(self, action_id: str) -> dict[str, object]:
        """Atomically consume a separately recorded operator approval."""

        clean_id = _action_id(action_id)
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Unknown Content Hub action: {clean_id}.")
            row = self._expire_if_needed(connection, row)
            if row["status"] == "executed":
                result = self._normalise(row)
                result["idempotent_replay"] = True
                return result
            if row["status"] != "approved":
                raise ValueError(
                    "The Content Hub action has no separate operator approval receipt."
                )
            cursor = connection.execute(
                """
                UPDATE content_hub_approvals
                   SET status='executing', updated_at=?
                 WHERE action_id=? AND status='approved'
                """,
                (
                    self._now().astimezone(timezone.utc).isoformat(),
                    clean_id,
                ),
            )
            if cursor.rowcount != 1:
                raise ValueError("The Content Hub approval was already claimed.")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError(
                "The claimed Content Hub approval could not be reloaded."
            )
        return self._normalise(row, internal=True)

    def complete(self, action_id: str, result: dict[str, object]) -> dict[str, object]:
        return self._finish(action_id, "executed", result)

    def fail(self, action_id: str, result: dict[str, object]) -> dict[str, object]:
        return self._finish(action_id, "failed", result)

    def mark_outcome_unknown(self, action_id: str) -> dict[str, object]:
        return self._finish(
            action_id,
            "outcome_unknown",
            {"outcome": "unknown", "manual_reconciliation_required": True},
        )

    def _finish(
        self,
        action_id: str,
        status: str,
        result: dict[str, object],
    ) -> dict[str, object]:
        clean_id = _action_id(action_id)
        if status not in TERMINAL_STATES:
            raise ValueError("The Content Hub approval terminal state is invalid.")
        encoded = json.dumps(
            result, ensure_ascii=False, separators=(",", ":"), sort_keys=True
        )
        if len(encoded.encode("utf-8")) > 1_048_576:
            raise ValueError(
                "The Content Hub action result is too large to record safely."
            )
        finished_at = self._now().astimezone(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Unknown Content Hub action: {clean_id}.")
            if row["status"] == "executed" and status == "executed":
                return self._normalise(row)
            if row["status"] != "executing":
                raise ValueError(
                    f"The Content Hub action cannot finish from state {row['status']}."
                )
            connection.execute(
                """
                UPDATE content_hub_approvals
                   SET status=?, result_json=?, executed_at=?, updated_at=?
                 WHERE action_id=? AND status='executing'
                """,
                (status, encoded, finished_at, finished_at, clean_id),
            )
            row = connection.execute(
                "SELECT * FROM content_hub_approvals WHERE action_id = ?",
                (clean_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError(
                "The completed Content Hub approval could not be reloaded."
            )
        return self._normalise(row)

    def _validate_action(self, action: dict[str, object]) -> dict[str, object]:
        action_id = _action_id(action.get("actionId"))
        action_type = str(action.get("actionType") or "")
        if action_type not in ACTION_TYPES:
            raise ValueError("The Content Hub action type is invalid.")
        payload_hash = str(action.get("payloadHash") or "")
        if not HASH.fullmatch(payload_hash):
            raise ValueError("The Content Hub action payload hash is invalid.")
        key = str(action.get("idempotencyKey") or "")
        if not IDEMPOTENCY_KEY.fullmatch(key):
            raise ValueError("The Content Hub action idempotency key is invalid.")
        target = action.get("targetId")
        target_id = _action_id(target) if target is not None else None
        return {
            "action_id": action_id,
            "action_type": action_type,
            "target_id": target_id,
            "payload_hash": payload_hash,
            "idempotency_key": key,
            "summary": _bounded_text(action.get("summary"), "action summary", 2_000),
            "created_at": _timestamp(action.get("createdAt"), "creation time"),
            "expires_at": _timestamp(action.get("expiresAt"), "expiry"),
        }

    def _expire_if_needed(
        self, connection: sqlite3.Connection, row: sqlite3.Row
    ) -> sqlite3.Row:
        if row["status"] not in {"awaiting_exact_approval", "approved"}:
            return row
        expires = datetime.fromisoformat(str(row["expires_at"]))
        if expires > self._now().astimezone(timezone.utc):
            return row
        now = self._now().astimezone(timezone.utc).isoformat()
        connection.execute(
            """
            UPDATE content_hub_approvals
               SET status='expired', updated_at=?
             WHERE action_id=? AND status IN ('awaiting_exact_approval', 'approved')
            """,
            (now, row["action_id"]),
        )
        updated = connection.execute(
            "SELECT * FROM content_hub_approvals WHERE action_id = ?",
            (row["action_id"],),
        ).fetchone()
        if updated is None:
            raise RuntimeError(
                "The expired Content Hub approval could not be reloaded."
            )
        return updated

    def _normalise(
        self, row: sqlite3.Row, *, internal: bool = False
    ) -> dict[str, object]:
        result: dict[str, object] = {
            "action_id": row["action_id"],
            "action_type": row["action_type"],
            "target_id": row["target_id"],
            "payload_hash": row["payload_hash"],
            "short_payload_hash": str(row["payload_hash"])[:12],
            "idempotency_key": row["idempotency_key"],
            "summary": row["summary"],
            "status": row["status"],
            "created_at": row["created_at"],
            "expires_at": row["expires_at"],
            "approved_at": row["approved_at"],
            "executed_at": row["executed_at"],
            "result": json.loads(row["result_json"]) if row["result_json"] else None,
        }
        if internal:
            result.update(
                {
                    "approval_reference": row["approval_reference"],
                    "approved_by": row["approved_by"],
                }
            )
        return result

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5.0)
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def _initialise(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS content_hub_approvals (
                    action_id TEXT PRIMARY KEY,
                    action_type TEXT NOT NULL,
                    target_id TEXT,
                    payload_hash TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    summary TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    approval_reference TEXT UNIQUE,
                    approved_by TEXT,
                    approved_at TEXT,
                    executed_at TEXT,
                    result_json TEXT,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS content_hub_approvals_status_expiry_idx "
                "ON content_hub_approvals(status, expires_at)"
            )
        self.path.chmod(0o600)
