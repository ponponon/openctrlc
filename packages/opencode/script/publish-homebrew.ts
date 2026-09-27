#!/usr/bin/env bun
import { $ } from "bun"
import { Buffer } from "node:buffer"

const version = process.env.OPENCTRLC_VERSION
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("OPENCTRLC_VERSION must be a stable semantic version")
  process.exit(1)
}

const release = (await $`gh api repos/ponponon/openctrlc/releases/tags/v${version}`.json()) as {
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: { name: string; digest?: string }[]
}
if (release.tag_name !== `v${version}` || release.draft || release.prerelease) {
  console.error(`v${version} is not a published stable release`)
  process.exit(1)
}

function assetSha(name: string) {
  const digest = release.assets.find((asset) => asset.name === name)?.digest
  if (!digest?.startsWith("sha256:") || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`Release asset ${name} does not have a SHA-256 digest`)
  }
  return digest.slice("sha256:".length)
}

const macArm64Sha = assetSha("openctrlc-darwin-arm64.zip")
const macX64Sha = assetSha("openctrlc-darwin-x64.zip")
const linuxArm64Sha = assetSha("openctrlc-linux-arm64.tar.gz")
const linuxX64Sha = assetSha("openctrlc-linux-x64.tar.gz")
const formula = `# typed: false
# frozen_string_literal: true

class Openctrlc < Formula
  desc "The AI coding agent built for the terminal"
  homepage "https://github.com/ponponon/openctrlc"
  version "${version}"
  license "MIT"

  depends_on "ripgrep"

  on_macos do
    on_arm do
      url "https://github.com/ponponon/openctrlc/releases/download/v${version}/openctrlc-darwin-arm64.zip"
      sha256 "${macArm64Sha}"
    end
    on_intel do
      url "https://github.com/ponponon/openctrlc/releases/download/v${version}/openctrlc-darwin-x64.zip"
      sha256 "${macX64Sha}"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/ponponon/openctrlc/releases/download/v${version}/openctrlc-linux-arm64.tar.gz"
      sha256 "${linuxArm64Sha}"
    end
    on_intel do
      url "https://github.com/ponponon/openctrlc/releases/download/v${version}/openctrlc-linux-x64.tar.gz"
      sha256 "${linuxX64Sha}"
    end
  end

  def install
    bin.install "openctrlc"
  end

  test do
    assert_match "show help", shell_output("#{bin}/openctrlc --help")
  end
end
`

const endpoint = "repos/ponponon/homebrew-tap/contents/Formula/openctrlc.rb"
const existingRequest = process.env.HOMEBREW_TAP_TOKEN
  ? $`gh api ${endpoint}`.env({ GH_TOKEN: process.env.HOMEBREW_TAP_TOKEN })
  : $`gh api ${endpoint}`
const existing = await existingRequest.quiet().nothrow()
let sha: string | undefined
if (existing.exitCode === 0) {
  const file = JSON.parse(existing.stdout.toString("utf8")) as { sha: string; content: string }
  sha = file.sha
  if (Buffer.from(file.content, "base64").toString("utf8") === formula) {
    console.log(`Homebrew formula is already current at v${version}`)
    process.exit(0)
  }
} else if (!existing.stderr.toString("utf8").includes("404")) {
  throw new Error(existing.stderr.toString("utf8"))
}

const message = `chore(homebrew) : 更新 OpenCtrlC 至 v${version}\n\nedit by GPT-6`
const args = [
  "api",
  "--method",
  "PUT",
  endpoint,
  "--field",
  `message=${message}`,
  "--field",
  `content=${Buffer.from(formula).toString("base64")}`,
  ...(sha ? ["--field", `sha=${sha}`] : []),
]
const updateFormula = process.env.HOMEBREW_TAP_TOKEN
  ? $`gh ${args}`.env({ GH_TOKEN: process.env.HOMEBREW_TAP_TOKEN })
  : $`gh ${args}`
await updateFormula
console.log(`Published Homebrew formula v${version} to ponponon/homebrew-tap`)
