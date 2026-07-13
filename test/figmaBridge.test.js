const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const bridgePath = path.join(projectRoot, 'design/figma/mcp_bridge.py');

test('Figma MCP bridge constrains HTTPS negotiation to TLS 1.2 for the current macOS runtime', () => {
  const probe = String.raw`
import importlib.util
import ssl
import sys

spec = importlib.util.spec_from_file_location("mcp_bridge", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
session = module._build_http_session()
adapter = session.adapters["https://"]
context = adapter.poolmanager.connection_pool_kw.get("ssl_context")
assert context is not None, "HTTPS adapter must expose a custom SSL context"
assert context.minimum_version == ssl.TLSVersion.TLSv1_2
assert context.maximum_version == ssl.TLSVersion.TLSv1_2
`;
  const result = spawnSync('/usr/bin/python3', ['-c', probe, bridgePath], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `TLS adapter probe failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
});

test('Figma MCP bridge retries one TLS handshake EOF before surfacing the transport error', () => {
  const probe = String.raw`
import importlib.util
import json
import sys
import requests

spec = importlib.util.spec_from_file_location("mcp_bridge", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Response:
    status_code = 200
    headers = {"content-type": "application/json"}
    text = json.dumps({"result": {"ok": True}})
    def raise_for_status(self):
        return None
    def json(self):
        return json.loads(self.text)

class Session:
    def __init__(self):
        self.calls = 0
    def post(self, *args, **kwargs):
        self.calls += 1
        if self.calls == 1:
            raise requests.exceptions.SSLError("EOF occurred in violation of protocol")
        return Response()

client = module.FigmaMCP.__new__(module.FigmaMCP)
client.url = "https://mcp.figma.com/mcp"
client.headers = {}
client.session = Session()
result = client._post({"jsonrpc": "2.0"})
assert result == {"result": {"ok": True}}
assert client.session.calls == 2
`;
  const result = spawnSync('/usr/bin/python3', ['-c', probe, bridgePath], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `TLS retry probe failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
});

test('Figma MCP bridge accepts long inline JSON without treating it as a filesystem path', () => {
  const probe = String.raw`
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("mcp_bridge", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
payload = {"code": "x" * 8192, "fileKey": "public-test-key"}
parsed = module._load_json(json.dumps(payload))
assert parsed == payload
`;
  const result = spawnSync('/usr/bin/python3', ['-c', probe, bridgePath], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `long inline JSON probe failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
});
