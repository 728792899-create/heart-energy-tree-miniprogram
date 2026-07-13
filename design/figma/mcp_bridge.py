#!/usr/bin/env python3
"""Small, credential-safe bridge to the authenticated Figma MCP server.

The OAuth credential remains in macOS Keychain. This program never prints it.
"""
from __future__ import annotations

import argparse
import json
import re
import ssl
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

import requests
from requests.adapters import HTTPAdapter

SERVICE = "Codex MCP Credentials"
SERVER = "figma"
PROTOCOL_VERSION = "2025-06-18"


class _TLS12HttpAdapter(HTTPAdapter):
    """Use TLS 1.2 because Figma currently resets TLS 1.3 negotiation here."""

    def init_poolmanager(
        self, connections: int, maxsize: int, block: bool = False, **pool_kwargs: Any
    ) -> None:
        context = ssl.create_default_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_2
        pool_kwargs["ssl_context"] = context
        super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


def _build_http_session() -> requests.Session:
    session = requests.Session()
    session.mount("https://", _TLS12HttpAdapter())
    return session


def _find_account() -> str:
    dump = subprocess.check_output(
        ["security", "dump-keychain"], stderr=subprocess.DEVNULL, text=True
    )
    blocks = dump.split('class: "genp"')
    for block in blocks:
        if f'"svce"<blob>="{SERVICE}"' not in block:
            continue
        match = re.search(r'"acct"<blob>="(figma\|[^"]+)"', block)
        if match:
            return match.group(1)
    raise RuntimeError("Figma MCP credential was not found in macOS Keychain")


def _credential() -> Dict[str, Any]:
    account = _find_account()
    secret = subprocess.check_output(
        ["security", "find-generic-password", "-s", SERVICE, "-a", account, "-w"],
        stderr=subprocess.DEVNULL,
        text=True,
    ).strip()
    data = json.loads(secret)
    if data.get("server_name") != SERVER:
        raise RuntimeError("The selected MCP credential is not for Figma")
    return data


def _parse_response(response: requests.Response) -> Dict[str, Any]:
    content_type = response.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        payloads = []
        for line in response.text.splitlines():
            if line.startswith("data:"):
                raw = line[5:].strip()
                if raw:
                    try:
                        payloads.append(json.loads(raw))
                    except json.JSONDecodeError:
                        continue
        if payloads:
            return payloads[-1]
        raise RuntimeError("Figma MCP returned an empty event stream")
    return response.json()


class FigmaMCP:
    def __init__(self) -> None:
        credential = _credential()
        self.url = credential.get("url") or "https://mcp.figma.com/mcp"
        token = credential["token_response"]["access_token"]
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        self._next_id = 1
        self.session = _build_http_session()
        self._initialize()

    def _post(self, payload: Dict[str, Any], timeout: int = 180) -> Dict[str, Any]:
        for attempt in range(2):
            try:
                response = self.session.post(
                    self.url, headers=self.headers, json=payload, timeout=timeout
                )
                break
            except requests.exceptions.SSLError as exc:
                is_handshake_eof = "EOF occurred in violation of protocol" in str(exc)
                if attempt == 1 or not is_handshake_eof:
                    raise
        if response.status_code == 401:
            raise RuntimeError(
                "Figma OAuth access expired. Run `codex mcp login figma` and retry."
            )
        response.raise_for_status()
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            self.headers["Mcp-Session-Id"] = session_id
        return _parse_response(response) if response.text else {}

    def _request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        request_id = self._next_id
        self._next_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }
        result = self._post(payload)
        if "error" in result:
            raise RuntimeError(json.dumps(result["error"], ensure_ascii=False))
        return result.get("result", result)

    def _initialize(self) -> None:
        self._request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "heart-tree-figma-bridge", "version": "1.0"},
            },
        )
        self._post(
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            }
        )

    def tools(self) -> Dict[str, Any]:
        return self._request("tools/list", {})

    def call(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("tools/call", {"name": name, "arguments": arguments})


def _load_json(value: str) -> Dict[str, Any]:
    candidate = Path(value)
    if candidate.exists():
        return json.loads(candidate.read_text(encoding="utf-8"))
    return json.loads(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("whoami")
    sub.add_parser("tools")

    call_parser = sub.add_parser("call")
    call_parser.add_argument("tool")
    call_parser.add_argument("arguments", help="JSON string or path to a JSON file")

    create_parser = sub.add_parser("create-file")
    create_parser.add_argument("plan_key")
    create_parser.add_argument("file_name")

    args = parser.parse_args()
    client = FigmaMCP()
    if args.command == "whoami":
        output = client.call("whoami", {})
    elif args.command == "tools":
        output = client.tools()
    elif args.command == "call":
        output = client.call(args.tool, _load_json(args.arguments))
    else:
        output = client.call(
            "create_new_file",
            {
                "planKey": args.plan_key,
                "fileName": args.file_name,
                "editorType": "design",
            },
        )
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
