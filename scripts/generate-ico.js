import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

const pngPath = path.join(projectRoot, 'public', 'logo.png')
const icoPath = path.join(projectRoot, 'public', 'favicon.ico')

function generateIco() {
  if (!fs.existsSync(pngPath)) {
    console.error(`Error: Source PNG file not found at ${pngPath}`)
    process.exit(1)
  }

  const pngBuffer = fs.readFileSync(pngPath)

  // Validate PNG signature
  const isPng =
    pngBuffer[0] === 0x89 &&
    pngBuffer[1] === 0x50 &&
    pngBuffer[2] === 0x4e &&
    pngBuffer[3] === 0x47 &&
    pngBuffer[4] === 0x0d &&
    pngBuffer[5] === 0x0a &&
    pngBuffer[6] === 0x1a &&
    pngBuffer[7] === 0x0a

  if (!isPng) {
    console.error('Error: Source file is not a valid PNG.')
    process.exit(1)
  }

  // Read PNG Width and Height (big-endian 32-bit integers at offsets 16 and 20)
  const width = pngBuffer.readUInt32BE(16)
  const height = pngBuffer.readUInt32BE(20)

  console.log(`Source PNG dimensions: ${width}x${height}`)

  // Create the 22-byte ICO header
  const header = Buffer.alloc(22)

  // ICO File Header (6 bytes)
  header.writeUInt16LE(0, 0) // Reserved (must be 0)
  header.writeUInt16LE(1, 2) // Resource Type (1 for icon)
  header.writeUInt16LE(1, 4) // Number of images in file (1)

  // ICO Directory Entry (16 bytes)
  // Width: 1 byte (value 0 represents 256px)
  header.writeUInt8(width >= 256 ? 0 : width, 6)
  // Height: 1 byte (value 0 represents 256px)
  header.writeUInt8(height >= 256 ? 0 : height, 7)
  // Color count: 1 byte (0 if >= 8bpp)
  header.writeUInt8(0, 8)
  // Reserved: 1 byte (must be 0)
  header.writeUInt8(0, 9)
  // Color planes: 2 bytes (1)
  header.writeUInt16LE(1, 10)
  // Bits per pixel: 2 bytes (32)
  header.writeUInt16LE(32, 12)
  // Size of image data: 4 bytes (size of the original PNG)
  header.writeUInt32LE(pngBuffer.length, 14)
  // Offset to image data: 4 bytes (header size = 22 bytes)
  header.writeUInt32LE(22, 18)

  // Combine header and PNG buffer
  const icoBuffer = Buffer.concat([header, pngBuffer])

  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`Successfully generated ICO file at: ${icoPath} (${icoBuffer.length} bytes)`)
}

generateIco()
