from __future__ import annotations

import hashlib
import hmac
import json
import unittest
from urllib.request import Request

from pm_hermes.content_hub_cli import legacy_snapshot_payload
from pm_hermes.content_hub_client import (
    AgentHttpResponse,
    ContentHubAgentClient,
    ContentHubAgentConfig,
    ContentHubAgentError,
    build_canonical_request,
)


CONFIG = ContentHubAgentConfig(
    endpoint="https://example.supabase.co/functions/v1/content-hub-agent",
    client_id="pm_hermes",
    secret="secure-agent-test-secret-with-32-plus-bytes",
)


class ContentHubAgentClientTests(unittest.TestCase):
    def test_signed_request_matches_the_edge_contract(self) -> None:
        captured: list[Request] = []

        def transport(
            request: Request, _timeout: float, _maximum: int
        ) -> AgentHttpResponse:
            captured.append(request)
            return AgentHttpResponse(
                200,
                json.dumps(
                    {
                        "ok": True,
                        "contractVersion": "content-hub-agent-v1",
                        "operation": "health",
                        "dataClassification": "untrusted_application_data",
                        "data": {"ready": True},
                    }
                ).encode(),
            )

        client = ContentHubAgentClient(
            CONFIG,
            transport=transport,
            now=lambda: 1_000_000_000,
            nonce_factory=lambda: "nonce_1234567890abcdef",
        )
        client.call("health")

        request = captured[0]
        body = request.data or b""
        payload_hash = hashlib.sha256(body).hexdigest()
        canonical = build_canonical_request(
            "POST",
            "/content-hub-agent",
            "1000000000",
            "nonce_1234567890abcdef",
            payload_hash,
        )
        expected = hmac.new(
            CONFIG.secret.encode(), canonical.encode(), hashlib.sha256
        ).hexdigest()
        self.assertEqual(request.headers["X-pm-agent-signature"], expected)
        self.assertNotIn(CONFIG.secret, json.dumps(dict(request.headers)))

    def test_rejects_non_local_plain_http_endpoints(self) -> None:
        config = ContentHubAgentConfig(
            endpoint="http://example.com/functions/v1/content-hub-agent",
            client_id="pm_hermes",
            secret=CONFIG.secret,
        )
        with self.assertRaises(ContentHubAgentError) as raised:
            ContentHubAgentClient(config)
        self.assertEqual(raised.exception.code, "invalid_configuration")

    def test_http_error_does_not_expose_remote_details(self) -> None:
        def transport(
            _request: Request, _timeout: float, _maximum: int
        ) -> AgentHttpResponse:
            return AgentHttpResponse(
                500,
                b'{"error":{"code":"internal_error","message":"postgres secret detail"}}',
            )

        client = ContentHubAgentClient(CONFIG, transport=transport)
        with self.assertRaises(ContentHubAgentError) as raised:
            client.call("health")
        self.assertEqual(raised.exception.code, "internal_error")
        self.assertNotIn("postgres secret detail", str(raised.exception))

    def test_client_rejects_operations_outside_the_fixed_contract(self) -> None:
        client = ContentHubAgentClient(CONFIG)
        with self.assertRaises(ContentHubAgentError) as raised:
            client.call("run_sql")
        self.assertEqual(raised.exception.code, "invalid_request")

    def test_snapshot_mapping_preserves_missing_metrics(self) -> None:
        payload = legacy_snapshot_payload(
            "Instagram",
            {
                "dataStatus": "available",
                "postsInWindow": 2,
                "postsWithAnalytics": 1,
                "analyticsCoveragePercent": 50,
                "totals": {"reach": 0, "impressions": None},
                "derivedMetrics": {
                    "totalEngagements": 0,
                    "engagementRatePercent": None,
                    "clickThroughRatePercent": None,
                },
                "topPosts": [],
            },
            generated_at="2026-07-19T10:00:00+00:00",
            start_date="2026-06-20",
            end_date="2026-07-19",
            lookback_days=30,
            truncated=False,
        )
        self.assertEqual(payload["totals"], {"reach": 0, "impressions": None})
        self.assertEqual(payload["analytics_coverage_percent"], 50)


if __name__ == "__main__":
    unittest.main()
