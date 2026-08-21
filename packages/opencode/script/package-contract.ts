import { Brand } from "@openctrlc/identity"

export const ProductPackageName = `${Brand.cli}-ai`
export const ProductBinaryName = `${Brand.cli}.exe`

export function releaseTag(channel: string, version: string) {
  return channel === "beta" ? "beta" : `v${version}`
}

export function createProductPackageManifest(input: {
  version: string
  license: string
  optionalDependencies: Record<string, string>
}) {
  return {
    name: ProductPackageName,
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
