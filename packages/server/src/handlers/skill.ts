import { SkillV2 } from "@openctrlc/core/skill"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"

export const SkillHandler = HttpApiBuilder.group(Api, "server.skill", (handlers) =>
  handlers.handle(
    "skill.list",
    () => response(SkillV2.Service.use((skill) => skill.refresh().pipe(Effect.andThen(skill.list())))),
  ),
)
