import { Brand } from "@openctrlc/identity"

export const ProductPackageName = Brand.cli
export const LegacyProductPackageName = `${Brand.cli}-ai`
export const ProductBinaryName = `${Brand.cli}.exe`

export function releaseTag(channel: string, version: string) {
  return channel === "beta" ? "beta" : `v${version}`
}

export function npmPublishTag(channel: string) {
  return channel === "beta" ? "beta" : "latest"
}

export function createProductPackageManifest(input: {
  name?: string
  version: string
  license: string
  optionalDependencies: Record<string, string>
}) {
  return {
    name: input.name ?? ProductPackageName,
    bin: { [Brand.cli]: `./bin/${ProductBinaryName}` },
    scripts: {
      postinstall: "node ./postinstall.mjs",
    },
    version: input.version,
    license: input.license,
    os: ["darwin", "linux", "win32"],
    cpu: ["arm64", "x64"],
    optionalDependencies: input.optionalDependencies,
  }
}
