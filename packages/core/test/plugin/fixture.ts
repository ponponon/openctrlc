import { AgentV2 } from "@openctrlc/core/agent"
import { AISDK } from "@openctrlc/core/aisdk"
import { Catalog } from "@openctrlc/core/catalog"
import { CommandV2 } from "@openctrlc/core/command"
import { Credential } from "@openctrlc/core/credential"
import { AppNodeBuilder } from "@openctrlc/core/effect/app-node-builder"
import { LayerNodePlatform } from "@openctrlc/core/effect/app-node-platform"
import { LayerNode } from "@openctrlc/core/effect/layer-node"
import { EventV2 } from "@openctrlc/core/event"
import { FileSystem } from "@openctrlc/core/filesystem"
import { FSUtil } from "@openctrlc/core/fs-util"
import { Integration } from "@openctrlc/core/integration"
import { Location } from "@openctrlc/core/location"
import { Npm } from "@openctrlc/core/npm"
import { PluginV2 } from "@openctrlc/core/plugin"
import { Reference } from "@openctrlc/core/reference"
import { SkillV2 } from "@openctrlc/core/skill"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: () => Effect.succeed({ directory: "", entrypoint: undefined }),
    install: () => Effect.void,
    which: () => Effect.succeed(undefined),
  }),
)

export const PluginTestLayer = AppNodeBuilder.build(
  LayerNode.group([
    FileSystem.node,
    FSUtil.node,
    Location.node,
    Npm.node,
    Credential.node,
    EventV2.node,
    LayerNodePlatform.httpClient,
    PluginV2.node,
    AgentV2.node,
    AISDK.node,
    Catalog.node,
    CommandV2.node,
    Integration.node,
    Reference.node,
    SkillV2.node,
  ]),
  [
    [Location.node, tempLocationLayer],
    [Npm.node, npmLayer],
  ],
)
