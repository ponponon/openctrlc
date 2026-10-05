import { describe, expect, test } from "bun:test"
import { isPeerRelayAvailable } from "./protocol"
import { selectedPeerRoute, selectedPeerRouteReport } from "./peer"

describe("isPeerRelayAvailable", () => {
  test("requires the supported protocol and configured ICE servers", () => {
    expect(isPeerRelayAvailable({ peerProtocol: 1, iceConfigured: true })).toBe(true)
    expect(isPeerRelayAvailable({ peerProtocol: 1, iceConfigured: false })).toBe(false)
    expect(isPeerRelayAvailable({ peerProtocol: 2, iceConfigured: true })).toBe(false)
    expect(isPeerRelayAvailable(undefined)).toBe(false)
  })
})

const stats = (values: Array<Record<string, unknown>>) => {
  const reports = new Map(values.map((value) => [value.id as string, value]))
  return {
    values: () => reports.values(),
    get: (id: string) => reports.get(id),
  } as unknown as RTCStatsReport
}

describe("selectedPeerRoute", () => {
  test("classifies the selected pair as direct", () => {
    expect(
      selectedPeerRoute(
        stats([
          { id: "transport", type: "transport", selectedCandidatePairId: "pair" },
          {
            id: "pair",
            type: "candidate-pair",
            state: "succeeded",
            localCandidateId: "local",
            remoteCandidateId: "remote",
          },
          { id: "local", type: "local-candidate", candidateType: "host" },
          { id: "remote", type: "remote-candidate", candidateType: "srflx" },
        ]),
      ),
    ).toBe("direct")
  })

  test("classifies either relay candidate as TURN", () => {
    expect(
      selectedPeerRoute(
        stats([
          { id: "transport", type: "transport", selectedCandidatePairId: "pair" },
          {
            id: "pair",
            type: "candidate-pair",
            state: "succeeded",
            localCandidateId: "local",
            remoteCandidateId: "remote",
          },
          { id: "local", type: "local-candidate", candidateType: "relay" },
          { id: "remote", type: "remote-candidate", candidateType: "srflx" },
        ]),
      ),
    ).toBe("turn")
  })

  test("reports cumulative bytes from the selected candidate pair", () => {
    expect(
      selectedPeerRouteReport(
        stats([
          { id: "transport", type: "transport", selectedCandidatePairId: "pair" },
          {
            id: "pair",
            type: "candidate-pair",
            state: "succeeded",
            localCandidateId: "local",
            remoteCandidateId: "remote",
            bytesSent: 1234,
            bytesReceived: 5678,
          },
          { id: "local", type: "local-candidate", candidateType: "host" },
          { id: "remote", type: "remote-candidate", candidateType: "srflx" },
        ]),
      ),
    ).toEqual({ route: "direct", pairID: "pair", bytesSent: 1234, bytesReceived: 5678 })
  })

  test("supports reports that expose the selected pair on the candidate-pair report", () => {
    expect(
      selectedPeerRoute(
        stats([
          {
            id: "pair",
            type: "candidate-pair",
            selected: true,
            state: "succeeded",
            localCandidateId: "local",
            remoteCandidateId: "remote",
          },
          { id: "local", type: "local-candidate", candidateType: "host" },
          { id: "remote", type: "remote-candidate", candidateType: "host" },
        ]),
      ),
    ).toBe("direct")
  })

  test("does not classify a channel before ICE selects a candidate pair", () => {
    expect(
      selectedPeerRoute(
        stats([
          { id: "transport", type: "transport" },
          {
            id: "pair",
            type: "candidate-pair",
            state: "in-progress",
            localCandidateId: "local",
            remoteCandidateId: "remote",
          },
          { id: "local", type: "local-candidate", candidateType: "host" },
          { id: "remote", type: "remote-candidate", candidateType: "host" },
        ]),
      ),
    ).toBeUndefined()
  })
})
