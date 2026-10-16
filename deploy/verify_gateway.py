"""Verify authenticated streaming and a complete tool round trip against a live gateway."""
import argparse
import json
from pathlib import Path

import httpx


def stream_call(client: httpx.Client, model: str, messages: list, tools: list) -> tuple[str, list]:
    """Collect streamed text and tool calls for the supplied model and full message history."""
    text = ""
    calls = {}
    with client.stream("POST", "/v1/chat/completions", json={"model": model, "messages": messages,
                       "tools": tools, "stream": True, "max_tokens": 2048}) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            payload = json.loads(line[6:])
            if "error" in payload:
                raise RuntimeError("Streaming gateway returned an error")
            for choice in payload.get("choices", []):
                delta = choice.get("delta", {})
                text += delta.get("content") or ""
                for part in delta.get("tool_calls", []):
                    call = calls.setdefault(part["index"], {"id": "", "type": "function",
                                            "function": {"name": "", "arguments": ""}})
                    call["id"] += part.get("id") or ""
                    for field in ("name", "arguments"):
                        call["function"][field] += part.get("function", {}).get(field) or ""
    return text, [calls[index] for index in sorted(calls)]


def verify(base_url: str, key_file: Path, model: str) -> None:
    """Validate authorization, account discovery, streamed tool requests and tool-result handling."""
    with httpx.Client(base_url=base_url, timeout=120, trust_env=False) as client:
        assert client.get("/workbuddy/status").status_code == 401, "Gateway must reject missing credentials"
        client.headers["Authorization"] = "Bearer " + key_file.read_text().strip()
        status = client.get("/workbuddy/status")
        status.raise_for_status()
        assert status.json()["connected"] is True, "WorkBuddy account must be connected"
        tools = [{"type": "function", "function": {"name": "read_verification_value",
                  "description": "Read the required verification value.",
                  "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}}]
        messages = [{"role": "system", "content": "Call read_verification_value once. Then reply only with its returned value."},
                    {"role": "user", "content": "Read the verification value using the tool."}]
        text, calls = stream_call(client, model, messages, tools)
        assert len(calls) == 1 and calls[0]["function"]["name"] == "read_verification_value", "Expected streamed tool call"
        assert json.loads(calls[0]["function"]["arguments"]) == {}, "Expected valid tool arguments"
        messages += [{"role": "assistant", "content": text or None, "tool_calls": calls},
                     {"role": "tool", "tool_call_id": calls[0]["id"], "content": "WORKBUDDY_PLUGIN_TOOL_OK"}]
        result, extra_calls = stream_call(client, model, messages, tools)
        assert not extra_calls and result.strip() == "WORKBUDDY_PLUGIN_TOOL_OK", "Tool result did not round trip"
        print(json.dumps({"account": status.json()["account"], "models": status.json()["models"],
                          "model": model, "streaming": "passed", "tool_round_trip": "passed"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--key-file", type=Path, required=True)
    parser.add_argument("--model", required=True)
    options = parser.parse_args()
    verify(options.base_url, options.key_file, options.model)
