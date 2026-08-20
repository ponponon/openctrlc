import { expect, test } from "bun:test"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { Context, Effect, Option, Redacted, Scope } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { Layer } from "effect"
import { Brand } from "@openctrlc/identity"
import { ServerAuth } from "../src/auth"
import { createRoutes } from "../src/routes"

test("server auth accepts the product CLI default username", () => {
  const config = { username: Brand.cli, password: Option.some("secret") }
  const authorization = ServerAuth.header({ password: "secret" })

  expect(authorization).toBe(`Basic ${Buffer.from(`${Brand.cli}:secret`).toString("base64")}`)
  expect(
    ServerAuth.authorized(
      { username: Brand.cli, password: Redacted.make("secret") },
      config,
    ),
  ).toBe(true)
})

const servedRoutes = HttpRouter.serve(createRoutes("secret"), { disableListenLog: true, disableLogger: true }).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provideMerge(NodeServices.layer),
)

test("createRoutes authenticates the OpenCtrlC CLI username over HTTP", async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(servedRoutes).pipe(Effect.orDie)
        const client = Context.get(context, HttpClient.HttpClient)
        const request = (username: string) =>
          HttpClientRequest.get("/api/health").pipe(
            HttpClientRequest.setHeader("authorization", `Basic ${Buffer.from(`${username}:secret`).toString("base64")}`),
            HttpClient.execute,
          )

        const checks = Effect.gen(function* () {
          const valid = yield* request(Brand.cli)
          const legacy = yield* request("opencode")
          expect(valid.status).toBe(200)
          expect(legacy.status).toBe(401)
        }).pipe(Effect.provideService(HttpClient.HttpClient, client)) as unknown as Effect.Effect<void, never, never>
        yield* checks
      }) as unknown as Effect.Effect<void, never, Scope.Scope>,
    ),
  )
})
