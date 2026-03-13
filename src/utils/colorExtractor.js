/**
 * Extracts the dominant color from an image URL and generates a full dark theme palette.
 * Uses canvas pixel sampling to find the most prominent color, then builds
 * coordinated CSS variables in HSL space.
 */

export function extractColorsFromImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = 64
        canvas.height = 64
        ctx.drawImage(img, 0, 0, 64, 64)

        const imageData = ctx.getImageData(0, 0, 64, 64).data
        const dominant = getDominantColor(imageData)
        const palette = generatePalette(dominant)
        resolve(palette)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageUrl
  })
}

function getDominantColor(data) {
  // Bucket colors by hue (ignore very dark/light pixels)
  const hueBuckets = new Array(36).fill(0) // 36 buckets of 10 degrees each
  let totalR = 0, totalG = 0, totalB = 0, count = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue // skip transparent

    const [h, s, l] = rgbToHsl(r, g, b)
    // Skip very dark, very light, and very desaturated pixels
    if (l < 0.1 || l > 0.9 || s < 0.15) continue

    const bucket = Math.floor(h / 10) % 36
    hueBuckets[bucket] += s * (0.5 + l) // weight by saturation and brightness
    totalR += r; totalG += g; totalB += b; count++
  }

  // Find the dominant hue bucket
  let maxBucket = 0
  for (let i = 1; i < 36; i++) {
    if (hueBuckets[i] > hueBuckets[maxBucket]) maxBucket = i
  }

  // Get the center hue of the dominant bucket
  const dominantHue = maxBucket * 10 + 5

  // If no colored pixels found, use the average color
  if (count === 0) {
    return { h: 220, s: 0.5, l: 0.5 } // fallback blue
  }

  // Find average saturation and lightness from pixels near that hue
  let satSum = 0, lightSum = 0, hueCount = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue
    const [h, s, l] = rgbToHsl(r, g, b)
    if (s < 0.15 || l < 0.1 || l > 0.9) continue
    const hueDiff = Math.abs(h - dominantHue)
    if (hueDiff < 20 || hueDiff > 340) {
      satSum += s; lightSum += l; hueCount++
    }
  }

  const avgSat = hueCount > 0 ? satSum / hueCount : 0.6
  const avgLight = hueCount > 0 ? lightSum / hueCount : 0.5

  return { h: dominantHue, s: Math.max(0.4, avgSat), l: Math.min(0.7, Math.max(0.4, avgLight)) }
}

function generatePalette({ h, s }) {
  // Generate a dark theme palette from a single hue
  return {
    '--bg-primary': hsl(h, s * 0.4, 0.04),
    '--bg-secondary': hsl(h, s * 0.35, 0.07),
    '--bg-tertiary': hsl(h, s * 0.3, 0.11),
    '--bg-hover': hsl(h, s * 0.4, 0.18),
    '--text-primary': hsl(h, s * 0.15, 0.93),
    '--text-secondary': hsl(h, s * 0.35, 0.70),
    '--text-muted': hsl(h, s * 0.5, 0.50),
    '--border-color': hsl(h, s * 0.4, 0.18),
    '--accent-primary': hsl(h, s * 0.85, 0.55),
    '--accent-hover': hsl(h, s * 0.9, 0.45),
    '--accent-primary-faded': hsla(h, s * 0.85, 0.55, 0.5),
    '--accent-bg': hsla(h, s * 0.85, 0.55, 0.15),
  }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

function hsl(h, s, l) {
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function hsla(h, s, l, a) {
  return `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`
}
