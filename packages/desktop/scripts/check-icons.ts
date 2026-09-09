#!/usr/bin/env bun

import { inflateSync } from "node:zlib"
import path from "node:path"

type Raster = {
  width: number
  height: number
  pixels: Uint8Array
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const channels = ["dev", "beta", "prod"] as const
const args = Bun.argv.slice(2)
const channelIndex = args.indexOf("--channel")
const requestedChannel = channelIndex === -1 ? undefined : args[channelIndex + 1]
const directories = requestedChannel
  ? [`icons/${requireChannel(requestedChannel)}`]
  : channels.map((channel) => `icons/${channel}`)

for (const directory of directories) await checkDirectory(directory)

if (args.includes("--resources")) await checkDirectory("resources/icons")

console.log(
  `Desktop icon validation passed: ${directories.join(", ")}${args.includes("--resources") ? ", resources/icons" : ""}`,
)

async function checkDirectory(directory: string) {
  const prefix = path.resolve(directory)
  const png = parsePng(await readFile(path.join(prefix, "icon.png")), path.join(directory, "icon.png"))
  assertSize(png, 512, 512, path.join(directory, "icon.png"))
  assertRounded(png, path.join(directory, "icon.png"))

  const ico = parseIco(await readFile(path.join(prefix, "icon.ico")), path.join(directory, "icon.ico"))
  const icoSizes = [16, 24, 32, 48, 64, 256]
  if (ico.size !== icoSizes.length || icoSizes.some((size) => !ico.has(size))) {
    throw new Error(`${directory}/icon.ico must contain PNG layers at ${icoSizes.join(", ")}px`)
  }
  for (const [size, raster] of ico) {
    assertSize(raster, size, size, `${directory}/icon.ico:${size}px`)
    assertRounded(raster, `${directory}/icon.ico:${size}px`)
  }

  const icns = parseIcns(await readFile(path.join(prefix, "icon.icns")), path.join(directory, "icon.icns"))
  const icnsLayers = new Map([
    ["ic11", 32],
    ["ic12", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
    ["ic13", 256],
    ["ic14", 512],
  ])
  for (const [type, size] of icnsLayers) {
    const raster = icns.get(type)
    if (!raster) throw new Error(`${directory}/icon.icns is missing ${type} (${size}px)`)
    assertSize(raster, size, size, `${directory}/icon.icns:${type}`)
    assertRounded(raster, `${directory}/icon.icns:${type}`, false)
  }

  const dock = parsePng(await readFile(path.join(prefix, "dock.png")), path.join(directory, "dock.png"))
  assertSize(dock, 256, 256, path.join(directory, "dock.png"))
  assertRounded(dock, path.join(directory, "dock.png"), false)
  assertInsetAlpha(dock, path.join(directory, "dock.png"))
  assertPixelsEqual(dock, icns.get("ic08")!, `${directory}/dock.png must match ${directory}/icon.icns:ic08`)
}

async function readFile(file: string) {
  const input = Bun.file(file)
  if (!(await input.exists())) throw new Error(`Missing desktop icon asset: ${file}`)
  return new Uint8Array(await input.arrayBuffer())
}

function parsePng(data: Uint8Array, label: string): Raster {
  if (!matches(data, PNG_SIGNATURE, 0)) throw new Error(`${label} is not a PNG`)

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Uint8Array[] = []
  let offset = PNG_SIGNATURE.length

  while (offset + 12 <= data.length) {
    const length = readUint32(data, offset)
    const type = text(data.subarray(offset + 4, offset + 8))
    const start = offset + 8
    const end = start + length
    if (end + 4 > data.length) throw new Error(`${label} contains a truncated ${type} chunk`)

    if (type === "IHDR") {
      width = readUint32(data, start)
      height = readUint32(data, start + 4)
      bitDepth = data[start + 8]!
      colorType = data[start + 9]!
      interlace = data[start + 12]!
    }
    if (type === "IDAT") idat.push(data.subarray(start, end))
    offset = end + 4
    if (type === "IEND") break
  }

  if (width <= 0 || height <= 0) throw new Error(`${label} has invalid dimensions`)
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`${label} must be non-interlaced 8-bit RGBA PNG`)
  }
  if (idat.length === 0) throw new Error(`${label} has no IDAT data`)

  const stride = width * 4
  const decoded = new Uint8Array(inflateSync(Buffer.concat(idat)))
  if (decoded.length !== (stride + 1) * height) throw new Error(`${label} has an invalid RGBA scanline length`)

  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1)
    const output = y * stride
    const filter = decoded[row]!
    for (let index = 0; index < stride; index += 1) {
      const raw = decoded[row + index + 1]!
      const left = index >= 4 ? pixels[output + index - 4]! : 0
      const up = y > 0 ? pixels[output - stride + index]! : 0
      const upLeft = y > 0 && index >= 4 ? pixels[output - stride + index - 4]! : 0
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : filter === 4
                  ? paeth(left, up, upLeft)
                  : -1
      if (predictor < 0) throw new Error(`${label} uses an unsupported PNG filter ${filter}`)
      pixels[output + index] = (raw + predictor) & 255
    }
  }

  return { width, height, pixels }
}

function parseIco(data: Uint8Array, label: string) {
  if (data.length < 6 || readUint16(data, 0) !== 0 || readUint16(data, 2) !== 1)
    throw new Error(`${label} is not an ICO`)
  const count = readUint16(data, 4)
  const layers = new Map<number, Raster>()
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16
    if (entry + 16 > data.length) throw new Error(`${label} has a truncated directory`)
    const width = data[entry] || 256
    const height = data[entry + 1] || 256
    const size = readUint32LE(data, entry + 8)
    const offset = readUint32LE(data, entry + 12)
    const image = data.subarray(offset, offset + size)
    const raster = parsePng(image, `${label}:${width}x${height}`)
    if (raster.width !== width || raster.height !== height)
      throw new Error(`${label} directory dimensions do not match PNG dimensions`)
    layers.set(width, raster)
  }
  return layers
}

function parseIcns(data: Uint8Array, label: string) {
  if (data.length < 8 || text(data.subarray(0, 4)) !== "icns" || readUint32(data, 4) !== data.length)
    throw new Error(`${label} is not a valid ICNS container`)
  const layers = new Map<string, Raster>()
  let offset = 8
  while (offset + 8 <= data.length) {
    const type = text(data.subarray(offset, offset + 4))
    const size = readUint32(data, offset + 4)
    if (size < 8 || offset + size > data.length) throw new Error(`${label} contains a truncated ${type} item`)
    if (matches(data, PNG_SIGNATURE, offset + 8))
      layers.set(type, parsePng(data.subarray(offset + 8, offset + size), `${label}:${type}`))
    offset += size
  }
  return layers
}

function assertSize(raster: Raster, width: number, height: number, label: string) {
  if (raster.width !== width || raster.height !== height)
    throw new Error(`${label} must be ${width}x${height}, got ${raster.width}x${raster.height}`)
}

function assertRounded(raster: Raster, label: string, expectFullFrame = true) {
  const corners = [
    alphaAt(raster, 0, 0),
    alphaAt(raster, raster.width - 1, 0),
    alphaAt(raster, 0, raster.height - 1),
    alphaAt(raster, raster.width - 1, raster.height - 1),
  ]
  const edgeCenters = [
    alphaAt(raster, Math.floor(raster.width / 2), 0),
    alphaAt(raster, Math.floor(raster.width / 2), raster.height - 1),
    alphaAt(raster, 0, Math.floor(raster.height / 2)),
    alphaAt(raster, raster.width - 1, Math.floor(raster.height / 2)),
  ]
  if (corners.some((alpha) => alpha >= 64))
    throw new Error(`${label} has opaque or insufficiently transparent rounded corners: ${corners.join(",")}`)
  if (expectFullFrame && edgeCenters.some((alpha) => alpha < 200))
    throw new Error(`${label} has unexpected transparent edge content: ${edgeCenters.join(",")}`)
  if (!alphaBounds(raster)) throw new Error(`${label} is empty`)
}

function assertInsetAlpha(raster: Raster, label: string) {
  const bounds = alphaBounds(raster)
  if (!bounds || bounds[0] <= 0 || bounds[1] <= 0 || bounds[2] >= raster.width || bounds[3] >= raster.height) {
    throw new Error(`${label} must keep a transparent inset around the macOS Dock icon`)
  }
}

function assertPixelsEqual(left: Raster, right: Raster, label: string) {
  if (left.width !== right.width || left.height !== right.height || left.pixels.length !== right.pixels.length)
    throw new Error(label)
  for (let index = 0; index < left.pixels.length; index += 1) {
    if (left.pixels[index] !== right.pixels[index]) throw new Error(label)
  }
}

function alphaBounds(raster: Raster) {
  let minX = raster.width
  let minY = raster.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      if (alphaAt(raster, x, y) === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  return maxX < 0 ? undefined : ([minX, minY, maxX + 1, maxY + 1] as const)
}

function alphaAt(raster: Raster, x: number, y: number) {
  return raster.pixels[(y * raster.width + x) * 4 + 3]!
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upLeftDistance = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left
  return upDistance <= upLeftDistance ? up : upLeft
}

function matches(data: Uint8Array, expected: Uint8Array, offset: number) {
  return expected.every((value, index) => data[offset + index] === value)
}

function readUint16(data: Uint8Array, offset: number) {
  return data[offset]! | (data[offset + 1]! << 8)
}

function readUint32LE(data: Uint8Array, offset: number) {
  return data[offset]! + (data[offset + 1]! << 8) + (data[offset + 2]! << 16) + ((data[offset + 3]! << 24) >>> 0)
}

function readUint32(data: Uint8Array, offset: number) {
  return ((data[offset]! << 24) >>> 0) + (data[offset + 1]! << 16) + (data[offset + 2]! << 8) + data[offset + 3]!
}

function text(data: Uint8Array) {
  return String.fromCharCode(...data)
}

function requireChannel(value: string) {
  if (value === "dev" || value === "beta" || value === "prod") return value
  throw new Error(`Unsupported icon channel: ${value}`)
}
