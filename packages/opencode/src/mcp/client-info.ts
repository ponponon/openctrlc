import { Brand } from "@openctrlc/identity"
import { InstallationVersion } from "@openctrlc/core/installation/version"
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js"

export function debugInitializeRequest() {
  return {
    jsonrpc: "2.0" as const,
    method: "initialize" as const,
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: Brand.cli, version: InstallationVersion },
    },
    id: 1,
  }
}
