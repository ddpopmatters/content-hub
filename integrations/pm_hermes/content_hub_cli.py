#!/usr/bin/env python3
"""Operator CLI for the governed PM Hermes Content Hub integration."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pm_hermes.content_hub_client import (
    ContentHubAgentClient,
    ContentHubAgentError,
    configuration_status,
)
from pm_hermes.content_hub_approval import ContentHubWritePolicy


PLATFORMS = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
    "bluesky": "BlueSky",
}
DEFAULT_LOOKBACK_DAYS = 30


def _summary(platform: str, snapshot: dict[str, object], lookback_days: int) -> str:
    posts = snapshot.get("postsInWindow")
    measured = snapshot.get("postsWithAnalytics")
    status = snapshot.get("dataStatus")
    if status == "available":
        return f"{platform}: {measured} posts with analytics in the last {lookback_days} days."
    if status == "missing_metrics":
        return (
            f"{platform}: {posts} published posts found in the last {lookback_days} days, "
            "but none has analytics recorded in Content Hub."
        )
    return f"{platform}: no published posts found in the last {lookback_days} days."


def legacy_snapshot_payload(
    platform: str,
    snapshot: dict[str, object],
    *,
    generated_at: str,
    start_date: str,
    end_date: str,
    lookback_days: int,
    truncated: bool,
) -> dict[str, object]:
    """Map the signed API result to the established local snapshot file contract."""

    totals = snapshot.get("totals") if isinstance(snapshot.get("totals"), dict) else {}
    derived = (
        snapshot.get("derivedMetrics")
        if isinstance(snapshot.get("derivedMetrics"), dict)
        else {}
    )
    top_posts = (
        snapshot.get("topPosts") if isinstance(snapshot.get("topPosts"), list) else []
    )
    return {
        "generated_at": generated_at,
        "window_days": lookback_days,
        "window_start": start_date,
        "window_end": end_date,
        "source": "content_hub_agent_v1",
        "source_platforms": [platform],
        "data_status": snapshot.get("dataStatus"),
        "summary": _summary(platform, snapshot, lookback_days),
        "top_signal": None,
        "highlights": [],
        "totals": totals,
        "derived_metrics": {
            "total_engagements": derived.get("totalEngagements"),
            "engagement_rate_percent": derived.get("engagementRatePercent"),
            "click_through_rate_percent": derived.get("clickThroughRatePercent"),
        },
        "posts_in_window": snapshot.get("postsInWindow"),
        "posts_with_analytics": snapshot.get("postsWithAnalytics"),
        "analytics_coverage_percent": snapshot.get("analyticsCoveragePercent"),
        "top_posts": top_posts,
        "truncated": truncated,
    }


def _write_snapshot(name: str, payload: dict[str, object]) -> str:
    hermes_home = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
    output_directory = hermes_home / "data" / "analytics"
    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / f"{name}-latest.json"
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return str(output_path)


def _status(live: bool) -> int:
    try:
        edge_or_local = (
            ContentHubAgentClient().call("health") if live else configuration_status()
        )
        payload = {
            "edge" if live else "client": edge_or_local,
            "writePolicy": ContentHubWritePolicy.load().public_status(),
        }
        print(json.dumps({"status": "ok", "integration": payload}))
        return 0
    except ContentHubAgentError as error:
        print(json.dumps({"status": "unavailable", "error": error.code}))
        return 1


def _snapshot(lookback_days: int, platform_name: str | None, no_write: bool) -> int:
    if lookback_days < 1 or lookback_days > 366:
        print(json.dumps({"status": "error", "error": "lookback_days_out_of_range"}))
        return 2
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=lookback_days - 1)
    parameters: dict[str, object] = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "limit": 500,
    }
    if platform_name:
        parameters["platform"] = PLATFORMS[platform_name]
    try:
        response = ContentHubAgentClient().call("reporting_snapshot", parameters)
    except ContentHubAgentError as error:
        print(json.dumps({"status": "unavailable", "error": error.code}))
        return 1
    data = response.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("snapshots"), dict):
        print(json.dumps({"status": "unavailable", "error": "invalid_response"}))
        return 1
    generated_at = datetime.now(timezone.utc).isoformat()
    outputs: dict[str, str] = {}
    snapshots: dict[str, dict[str, object]] = {}
    selected = [platform_name] if platform_name else list(PLATFORMS)
    for name in selected:
        if name is None:
            continue
        platform = PLATFORMS[name]
        raw_snapshot = data["snapshots"].get(platform)
        if not isinstance(raw_snapshot, dict):
            print(json.dumps({"status": "unavailable", "error": "invalid_response"}))
            return 1
        snapshot = legacy_snapshot_payload(
            platform,
            raw_snapshot,
            generated_at=generated_at,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
            lookback_days=lookback_days,
            truncated=data.get("truncated") is True,
        )
        snapshots[name] = snapshot
        if not no_write:
            outputs[name] = _write_snapshot(name, snapshot)
    print(
        json.dumps(
            {
                "status": "ok",
                "generated_at": generated_at,
                "lookback_days": lookback_days,
                "outputs": outputs,
                "snapshots": snapshots if no_write else None,
            }
        )
    )
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    status_parser = subparsers.add_parser(
        "status", help="Check safe configuration presence."
    )
    status_parser.add_argument(
        "--live", action="store_true", help="Run a signed health request."
    )
    snapshot_parser = subparsers.add_parser(
        "snapshot", help="Build organic social snapshots."
    )
    snapshot_parser.add_argument(
        "--lookback-days", type=int, default=DEFAULT_LOOKBACK_DAYS
    )
    snapshot_parser.add_argument("--platform", choices=list(PLATFORMS))
    snapshot_parser.add_argument("--no-write", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.command == "status":
        return _status(args.live)
    return _snapshot(args.lookback_days, args.platform, args.no_write)


if __name__ == "__main__":
    raise SystemExit(main())
