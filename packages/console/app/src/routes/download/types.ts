export type DownloadPlatform =
  | "darwin-aarch64-dmg"
  | `windows-${"x64" | "arm64"}-nsis`
  | `linux-${"x64" | "arm64"}-${"deb" | "rpm" | "appimage"}`
