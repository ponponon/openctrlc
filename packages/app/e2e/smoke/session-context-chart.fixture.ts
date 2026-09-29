const directory = "C:/OpenCode/ChartSmoke"
const projectID = "proj_chart_smoke"
const sessionID = "ses_chart_smoke"
const title = "Chart smoke session"
const baseTime = 1_700_000_000_000

const models = [
  { providerID: "opencode", modelID: "alpha-fast", name: "Alpha Fast" },
  { providerID: "opencode", modelID: "beta-long", name: "Beta Long" },
  { providerID: "other", modelID: "gamma-pro", name: "Gamma Pro" },
]

type Message = { info: Record<string, unknown> & { id: string; role: string }; parts: Record<string, unknown>[] }

function userMessage(index: number): Message {
  return {
    info: {
      id: `msg_user_${index}`,
      sessionID,
      role: "user",
      time: { created: baseTime + index * 30_000 },
      summary: { diffs: [] },
      agent: "build",
      model: { providerID: "opencode", modelID: "alpha-fast" },
    },
    parts: [
      {
        id: `prt_user_${index}`,
        sessionID,
        messageID: `msg_user_${index}`,
        type: "text",
        text: `Prompt ${index} for chart smoke`,
      },
    ],
  }
}

function assistantMessage(index: number, parentID: string): Message {
  const model = models[index % models.length]!
  const created = baseTime + index * 30_000 + 1_000
  const duration = 1_200 + ((index * 17) % 5_000)
  const output = 80 + ((index * 43) % 420)
  const reasoning = 5 + ((index * 11) % 90)
  return {
    info: {
      id: `msg_assistant_${index}`,
      sessionID,
      role: "assistant",
      time: {
        created,
        completed: created + duration,
        firstGenerated: created + 180 + ((index * 29) % 400),
        generationDuration: Math.max(300, duration - 500),
      },
      parentID,
      modelID: model.modelID,
      providerID: model.providerID,
      mode: "build",
      agent: "build",
      path: { cwd: directory, root: directory },
      cost: 0.002 + ((index * 7) % 40) / 1000,
      tokens: {
        input: 1_200 + index * 13,
        output,
        reasoning,
        cache: { read: (index * 220) % 4_000, write: index * 5 },
      },
      finish: "stop",
    },
    parts: [
      {
        id: `prt_text_${index}`,
        sessionID,
        messageID: `msg_assistant_${index}`,
        type: "text",
        text: `Assistant reply ${index} for chart smoke`,
      },
    ],
  }
}

function buildMessages() {
  const messages: Message[] = []
  for (let index = 0; index < 18; index++) {
    const user = userMessage(index)
    messages.push(user)
    messages.push(assistantMessage(index, user.info.id))
  }
  return messages
}

export const fixture = {
  directory,
  projectID,
  sessionID,
  title,
  provider: {
    all: [
      {
        id: "opencode",
        name: "OpenCode",
        models: {
          "alpha-fast": { id: "alpha-fast", name: "Alpha Fast", limit: { context: 200_000 } },
          "beta-long": { id: "beta-long", name: "Beta Long", limit: { context: 200_000 } },
        },
      },
      {
        id: "other",
        name: "Other",
        models: {
          "gamma-pro": { id: "gamma-pro", name: "Gamma Pro", limit: { context: 120_000 } },
        },
      },
    ],
    connected: ["opencode", "other"],
    default: { providerID: "opencode", modelID: "alpha-fast" },
  },
  project: {
    id: projectID,
    worktree: directory,
    vcs: "git",
    name: "chart-smoke",
    time: { created: baseTime, updated: baseTime },
    sandboxes: [],
  },
  sessions: [
    {
      id: sessionID,
      slug: "chart-smoke",
      projectID,
      directory,
      title,
      version: "dev",
      time: { created: baseTime, updated: baseTime },
    },
  ],
  messages: buildMessages(),
  expected: {
    assistantCount: 18,
    modelLabels: ["Alpha Fast", "Beta Long", "Gamma Pro"],
  },
}

export function pageMessages(sessionIDArg: string, limit: number, before?: string) {
  const messages = sessionIDArg === fixture.sessionID ? fixture.messages : []
  const end = before
    ? Math.max(
        0,
        messages.findIndex((message) => message.info.id === before),
      )
    : messages.length
  const start = Math.max(0, end - limit)
  return {
    items: messages.slice(start, end),
    cursor: start > 0 ? messages[start]!.info.id : undefined,
  }
}
