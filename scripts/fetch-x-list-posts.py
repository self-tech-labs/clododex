#!/usr/bin/env python3
"""Fetch recent posts from a public X list.

Reads a bearer token from X_BEARER_TOKEN, BEARER_TOKEN, or the repo-local .env.
Uses only the Python standard library so the script can run without setup.
"""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE_URL = "https://api.x.com/2"
TWEET_FIELDS = (
    "tweet.fields=created_at,public_metrics,author_id,conversation_id,entities,referenced_tweets"
    "&expansions=author_id"
    "&user.fields=username,name,description,public_metrics,verified,verified_type"
)


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_bearer_token(repo_root: Path) -> str:
    for name in ("X_BEARER_TOKEN", "BEARER_TOKEN"):
        value = os.getenv(name)
        if value:
            return value

    env_values = load_dotenv(repo_root / ".env")
    for name in ("X_BEARER_TOKEN", "BEARER_TOKEN"):
        value = env_values.get(name)
        if value:
            return value

    raise SystemExit("No X bearer token found in env or repo-local .env")


def api_get(url: str, token: str) -> dict[str, Any]:
    request = Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    except HTTPError as error:
        body = error.read().decode(errors="replace")
        raise SystemExit(f"X API {error.code} {error.reason}: {body}") from None


def fetch_list_metadata(list_id: str, token: str) -> dict[str, Any]:
    return api_get(f"{BASE_URL}/lists/{list_id}", token).get("data", {})


def fetch_list_members(list_id: str, token: str) -> list[dict[str, Any]]:
    url = (
        f"{BASE_URL}/lists/{list_id}/members?max_results=100"
        "&user.fields=username,name,description,public_metrics,verified,verified_type"
    )
    return api_get(url, token).get("data", [])


def iter_list_posts(
    list_id: str,
    token: str,
    *,
    pages: int,
    max_results: int,
) -> Iterable[dict[str, Any]]:
    users: dict[str, dict[str, Any]] = {}
    next_token: str | None = None

    for _ in range(pages):
        url = f"{BASE_URL}/lists/{list_id}/tweets?max_results={max_results}&{TWEET_FIELDS}"
        if next_token:
            url += f"&pagination_token={quote(next_token)}"

        raw = api_get(url, token)
        for user in raw.get("includes", {}).get("users", []):
            users[user["id"]] = user

        for tweet in raw.get("data", []):
            author = users.get(tweet.get("author_id"), {})
            metrics = tweet.get("public_metrics", {})
            yield {
                "id": tweet["id"],
                "created_at": tweet.get("created_at"),
                "author_id": tweet.get("author_id"),
                "username": author.get("username", "?"),
                "name": author.get("name", "?"),
                "text": tweet.get("text", ""),
                "conversation_id": tweet.get("conversation_id"),
                "referenced_tweets": tweet.get("referenced_tweets", []),
                "metrics": {
                    "likes": metrics.get("like_count", 0),
                    "retweets": metrics.get("retweet_count", 0),
                    "replies": metrics.get("reply_count", 0),
                    "quotes": metrics.get("quote_count", 0),
                    "impressions": metrics.get("impression_count", 0),
                    "bookmarks": metrics.get("bookmark_count", 0),
                },
                "urls": [
                    entity.get("expanded_url")
                    for entity in tweet.get("entities", {}).get("urls", [])
                    if entity.get("expanded_url")
                ],
                "hashtags": [
                    entity.get("tag")
                    for entity in tweet.get("entities", {}).get("hashtags", [])
                    if entity.get("tag")
                ],
                "tweet_url": f"https://x.com/{author.get('username', '?')}/status/{tweet['id']}",
            }

        next_token = raw.get("meta", {}).get("next_token")
        if not next_token:
            break


def parse_created_at(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.000Z").replace(tzinfo=timezone.utc)


def engagement_score(post: dict[str, Any]) -> int:
    metrics = post["metrics"]
    return (
        metrics["likes"]
        + 3 * metrics["retweets"]
        + 4 * metrics["quotes"]
        + 2 * metrics["replies"]
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-id", required=True, help="X list id")
    parser.add_argument("--pages", type=int, default=1, help="Pages to fetch")
    parser.add_argument("--max-results", type=int, default=40, help="Posts per page, 10-100")
    parser.add_argument("--limit", type=int, default=40, help="Keep only the latest N posts")
    parser.add_argument("--since-days", type=int, default=None, help="Keep only posts newer than N days from newest post")
    parser.add_argument("--exclude-retweets", action="store_true", help="Drop posts whose text starts with RT @")
    parser.add_argument("--output", type=Path, default=None, help="Write JSON output to a file")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    token = load_bearer_token(repo_root)

    posts = list(
        iter_list_posts(
            args.list_id,
            token,
            pages=max(args.pages, 1),
            max_results=min(max(args.max_results, 10), 100),
        )
    )

    if args.exclude_retweets:
        posts = [post for post in posts if not post["text"].startswith("RT @")]

    if args.since_days is not None and posts:
        newest = max(parse_created_at(post["created_at"]) for post in posts if post.get("created_at"))
        cutoff = newest - timedelta(days=args.since_days)
        posts = [post for post in posts if post.get("created_at") and parse_created_at(post["created_at"]) >= cutoff]

    for post in posts:
        post["engagement_score"] = engagement_score(post)

    posts.sort(key=lambda post: post.get("created_at") or "", reverse=True)
    posts = posts[: max(args.limit, 1)]

    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "list": fetch_list_metadata(args.list_id, token),
        "members": fetch_list_members(args.list_id, token),
        "posts": posts,
    }

    rendered = json.dumps(payload, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
        print(args.output)
        return

    print(rendered)


if __name__ == "__main__":
    main()
