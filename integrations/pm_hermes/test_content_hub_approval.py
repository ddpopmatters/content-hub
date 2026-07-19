from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pm_hermes.content_hub_approval import (
    ContentHubApprovalLedger,
    ContentHubWritePolicy,
)


ACTION_ID = "12345678-1234-4234-9234-123456789abc"


def proposal(now: datetime) -> dict[str, object]:
    return {
        "actionId": ACTION_ID,
        "actionType": "create_entry",
        "targetId": None,
        "payloadHash": "a" * 64,
        "idempotencyKey": "draft:campaign:1234",
        "summary": "Create one Draft entry.",
        "status": "proposed",
        "createdAt": now.isoformat(),
        "expiresAt": (now + timedelta(minutes=30)).isoformat(),
    }


class ContentHubApprovalLedgerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.now_value = datetime(2026, 7, 19, 12, 0, tzinfo=timezone.utc)
        self.path = Path(self.temporary_directory.name) / "approvals.sqlite3"
        self.ledger = ContentHubApprovalLedger(self.path, now=lambda: self.now_value)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_exact_confirmation_is_claimed_once_and_replays_the_result(self) -> None:
        registered = self.ledger.register(proposal(self.now_value))
        self.assertEqual(registered["status"], "awaiting_exact_approval")
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)

        with self.assertRaisesRegex(ValueError, "Confirmation must be exactly"):
            self.ledger.claim_exact(ACTION_ID, confirm="yes", approved_by="Dan")

        claimed = self.ledger.claim_exact(
            ACTION_ID,
            confirm=f"execute {ACTION_ID}",
            approved_by="Dan",
        )
        self.assertEqual(claimed["status"], "executing")
        self.assertRegex(str(claimed["approval_reference"]), r"^cha_[a-f0-9]{24}$")

        completed = self.ledger.complete(
            ACTION_ID,
            {"ok": True, "data": {"decision": "applied"}},
        )
        self.assertEqual(completed["status"], "executed")

        replayed = self.ledger.claim_exact(
            ACTION_ID,
            confirm=f"execute {ACTION_ID}",
            approved_by="Dan",
        )
        self.assertTrue(replayed["idempotent_replay"])
        self.assertEqual(
            replayed["result"], {"data": {"decision": "applied"}, "ok": True}
        )

    def test_expired_proposal_fails_before_claim(self) -> None:
        self.ledger.register(proposal(self.now_value))
        self.now_value += timedelta(minutes=31)
        with self.assertRaisesRegex(ValueError, "cannot execute from state expired"):
            self.ledger.claim_exact(
                ACTION_ID,
                confirm=f"execute {ACTION_ID}",
                approved_by="Dan",
            )
        self.assertEqual(self.ledger.get(ACTION_ID)["status"], "expired")

    def test_action_id_cannot_be_rebound_to_another_payload(self) -> None:
        self.ledger.register(proposal(self.now_value))
        changed = proposal(self.now_value)
        changed["payloadHash"] = "b" * 64
        with self.assertRaisesRegex(ValueError, "already bound"):
            self.ledger.register(changed)


class ContentHubWritePolicyTests(unittest.TestCase):
    def test_environment_policy_defaults_every_write_path_off(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CONTENT_HUB_HERMES_PROPOSALS_ENABLED": "",
                "CONTENT_HUB_HERMES_WRITES_ENABLED": "",
                "CONTENT_HUB_HERMES_ENABLED_ACTIONS": "run_sql,approve_entry",
            },
            clear=False,
        ):
            policy = ContentHubWritePolicy.load()
        self.assertFalse(policy.proposals_enabled)
        self.assertFalse(policy.writes_enabled)
        self.assertEqual(policy.enabled_actions, frozenset())

    def test_execution_requires_both_stops_and_an_explicit_action(self) -> None:
        policy = ContentHubWritePolicy(
            proposals_enabled=True,
            writes_enabled=False,
            enabled_actions=frozenset({"create_entry"}),
            approver_label="Dan",
        )
        policy.require_proposal("create_entry")
        with self.assertRaisesRegex(PermissionError, "execution is disabled"):
            policy.require_execution("create_entry")
        with self.assertRaisesRegex(PermissionError, "proposals are disabled"):
            policy.require_proposal("update_entry")


if __name__ == "__main__":
    unittest.main()
