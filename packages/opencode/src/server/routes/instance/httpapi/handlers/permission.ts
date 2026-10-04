import { PermissionV1 } from "@openctrlc/core/v1/permission"
import { Permission } from "@/permission"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { PermissionNotFoundError } from "../errors"

export const permissionHandlers = HttpApiBuilder.group(InstanceHttpApi, "permission", (handlers) =>
  Effect.gen(function* () {
    const svc = yield* Permission.Service

    // Pending permissions are rare; a few seconds of memoization avoids remote
    // re-fetch storms when several panels mount together.
    let listCache: { at: number; value: unknown } | undefined
    const list = Effect.fn("PermissionHttpApi.list")(function* () {
      if (listCache && Date.now() - listCache.at < 5_000) return listCache.value as never
      const value = yield* svc.list()
      listCache = { at: Date.now(), value }
      return value
    })

    const reply = Effect.fn("PermissionHttpApi.reply")(function* (ctx: {
      params: { requestID: PermissionV1.ID }
      payload: PermissionV1.ReplyBody
    }) {
      yield* svc
        .reply({
          requestID: ctx.params.requestID,
          reply: ctx.payload.reply,
          message: ctx.payload.message,
        })
        .pipe(
          Effect.catchTag("Permission.NotFoundError", (error) =>
            Effect.fail(
              new PermissionNotFoundError({
                requestID: String(error.requestID),
                message: `Permission request not found: ${error.requestID}`,
              }),
            ),
          ),
        )
      return true
    })

    return handlers.handle("list", list).handle("reply", reply)
  }),
)
