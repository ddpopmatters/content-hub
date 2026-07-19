"""Signed, operation-allowlisted client for the Content Hub agent Edge boundary."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from dataclasses import dataclass
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


CONTRACT_VERSION = "content-hub-agent-v1"
SIGNATURE_VERSION = "1"
MAX_REQUEST_BYTES = 32_768
MAX_RESPONSE_BYTES = 1_048_576
DEFAULT_TIMEOUT_SECONDS = 20.0
ALLOWED_OPERATIONS = frozenset(
    {
        "health",
        "list_entries",
        "get_entry",
        "calendar_summary",
        "reporting_snapshot",
        "list_reports",
        "get_report",
        "compare_reports",
        "publication_status",
        "propose_action",
        "get_action",
        "execute_action",
    }
)


class ContentHubAgentError(RuntimeError):
    """A safe integration error that never includes credentials or response bodies."""

    def __init__(self, code: str, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


@dataclass(frozen=True)
class ContentHubAgentConfig:
    endpoint: str
    client_id: str
    secret: str

    @classmethod
    def from_environment(cls) -> "ContentHubAgentConfig":
        return cls(
            endpoint=os.environ.get("CONTENT_HUB_AGENT_URL", "").strip(),
            client_id=os.environ.get("CONTENT_HUB_AGENT_CLIENT_ID", "").strip(),
            secret=os.environ.get("CONTENT_HUB_AGENT_SECRET", ""),
        )

    def validate(self) -> None:
        parsed = urlsplit(self.endpoint)
        local_http = parsed.scheme == "http" and parsed.hostname in {
            "localhost",
            "127.0.0.1",
        }
        if (
            (parsed.scheme != "https" and not local_http)
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or not parsed.path.endswith("/functions/v1/content-hub-agent")
        ):
            raise ContentHubAgentError(
                "invalid_configuration",
                "The Content Hub agent endpoint is not configured safely.",
            )
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,79}", self.client_id):
            raise ContentHubAgentError(
                "invalid_configuration",
                "The Content Hub agent client is not configured safely.",
            )
        if len(self.secret) < 32:
            raise ContentHubAgentError(
                "invalid_configuration",
                "The Content Hub agent secret is not configured safely.",
            )


@dataclass(frozen=True)
class AgentHttpResponse:
    status: int
    body: bytes


Transport = Callable[[Request, float, int], AgentHttpResponse]


def configuration_status(
    config: ContentHubAgentConfig | None = None,
) -> dict[str, object]:
    """Report configuration presence without returning any values."""

    selected = config or ContentHubAgentConfig.from_environment()
    try:
        selected.validate()
        valid = True
    except ContentHubAgentError:
        valid = False
    return {
        "contractVersion": CONTRACT_VERSION,
        "mode": "governed_agent_contract",
        "endpointConfigured": bool(selected.endpoint),
        "clientConfigured": bool(selected.client_id),
        "secretConfigured": bool(selected.secret),
        "configurationValid": valid,
        "liveProbePerformed": False,
    }


def build_canonical_request(
    method: str,
    pathname: str,
    timestamp: str,
    nonce: str,
    payload_hash: str,
) -> str:
    return "\n".join(
        [SIGNATURE_VERSION, method.upper(), pathname, timestamp, nonce, payload_hash]
    )


def build_signed_headers(
    *,
    config: ContentHubAgentConfig,
    body: bytes,
    timestamp: int,
    nonce: str,
) -> dict[str, str]:
    parsed = urlsplit(config.endpoint)
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical = build_canonical_request(
        "POST",
        parsed.path,
        str(timestamp),
        nonce,
        payload_hash,
    )
    signature = hmac.new(
        config.secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "PM-Hermes-Content-Hub/1.0",
        "X-PM-Agent-Version": SIGNATURE_VERSION,
        "X-PM-Agent-Client": config.client_id,
        "X-PM-Agent-Timestamp": str(timestamp),
        "X-PM-Agent-Nonce": nonce,
        "X-PM-Agent-Signature": signature,
    }


def _read_response(response: object, maximum_bytes: int) -> bytes:
    read = getattr(response, "read", None)
    if not callable(read):
        raise ContentHubAgentError(
            "invalid_response", "Content Hub returned an invalid response."
        )
    body = read(maximum_bytes + 1)
    if not isinstance(body, bytes) or len(body) > maximum_bytes:
        raise ContentHubAgentError(
            "response_too_large", "Content Hub returned too much data."
        )
    return body


def _urlopen_transport(
    request: Request,
    timeout_seconds: float,
    maximum_bytes: int,
) -> AgentHttpResponse:
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return AgentHttpResponse(
                status=int(getattr(response, "status", 200)),
                body=_read_response(response, maximum_bytes),
            )
    except HTTPError as error:
        return AgentHttpResponse(
            status=error.code,
            body=_read_response(error, maximum_bytes),
        )
    except (URLError, TimeoutError, OSError) as error:
        raise ContentHubAgentError(
            "unavailable",
            "Content Hub could not be reached.",
        ) from error


def _error_code(payload: object) -> str:
    if not isinstance(payload, dict):
        return "request_failed"
    error = payload.get("error")
    if not isinstance(error, dict):
        return "request_failed"
    code = error.get("code")
    return (
        code
        if isinstance(code, str) and re.fullmatch(r"[a-z_]{2,64}", code)
        else "request_failed"
    )


class ContentHubAgentClient:
    """Calls only the allowlisted operations exposed by the agent boundary."""

    def __init__(
        self,
        config: ContentHubAgentConfig | None = None,
        *,
        transport: Transport | None = None,
        now: Callable[[], float] | None = None,
        nonce_factory: Callable[[], str] | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._config = config or ContentHubAgentConfig.from_environment()
        self._config.validate()
        self._transport = transport or _urlopen_transport
        self._now = now or time.time
        self._nonce_factory = nonce_factory or (lambda: secrets.token_urlsafe(24))
        self._timeout_seconds = timeout_seconds

    def call(
        self,
        operation: str,
        parameters: dict[str, object] | None = None,
    ) -> dict[str, object]:
        if operation not in ALLOWED_OPERATIONS:
            raise ContentHubAgentError(
                "invalid_request",
                "The Content Hub operation is not allowlisted.",
            )
        body = json.dumps(
            {"operation": operation, "parameters": parameters or {}},
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        if len(body) > MAX_REQUEST_BYTES:
            raise ContentHubAgentError(
                "request_too_large", "The Content Hub request is too large."
            )
        headers = build_signed_headers(
            config=self._config,
            body=body,
            timestamp=int(self._now()),
            nonce=self._nonce_factory(),
        )
        response = self._transport(
            Request(self._config.endpoint, data=body, headers=headers, method="POST"),
            self._timeout_seconds,
            MAX_RESPONSE_BYTES,
        )
        try:
            payload: object = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ContentHubAgentError(
                "invalid_response",
                "Content Hub returned an invalid response.",
                status=response.status,
            ) from error
        if not 200 <= response.status < 300:
            raise ContentHubAgentError(
                _error_code(payload),
                "The Content Hub request was not completed.",
                status=response.status,
            )
        if (
            not isinstance(payload, dict)
            or payload.get("ok") is not True
            or payload.get("contractVersion") != CONTRACT_VERSION
            or payload.get("dataClassification") != "untrusted_application_data"
        ):
            raise ContentHubAgentError(
                "invalid_response",
                "Content Hub returned an invalid response.",
                status=response.status,
            )
        return payload
