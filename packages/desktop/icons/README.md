# OpenCtrlC desktop icons

Desktop icons are maintained per release channel in `dev`, `beta`, and `prod`.
Each channel must contain the source PNG, Windows ICO, macOS ICNS, and the
inset Dock PNG used by the unpackaged Electron app:

```text
packages/desktop/icons/<channel>/
├── icon.png
├── icon.ico
├── icon.icns
└── dock.png
```

The icon contract is intentionally strict so small and large surfaces do not
render different crops. `icon.png` is 512×512 with transparent rounded
corners; `icon.ico` contains 16, 24, 32, 48, 64, and 256 px PNG layers; and
`icon.icns` contains the required 32–1024 px Retina layers. The macOS Dock
asset keeps a transparent inset and must match the 256 px ICNS layer.

After replacing an icon, validate every channel and the copied packaging
resources:

```bash
bun run --cwd packages/desktop check:icons -- --resources
```

`predev` and `prebuild` copy the selected channel into
`packages/desktop/resources/icons`; do not edit that generated directory by
hand.
