/**
 * Consolidated feedback parser.
 *
 * Tries structured section markers first ([ECHO], [NAME], [DRILL], [OPEN]),
 * then falls back to paragraph-based splitting.
 *
 * Always returns { echo, name, drill, open } where drill is null when the
 * [DRILL] marker is not present.
 */

const MARKERS = ['ECHO', 'NAME', 'DRILL', 'OPEN']

/**
 * Attempt to parse text using section markers like [ECHO], [NAME], etc.
 * Returns null if no markers are found so the caller can fall back.
 */
function parseWithMarkers(text: string) {
  // Check whether any markers are present at all
  const hasAnyMarker = MARKERS.some(m => text.includes(`[${m}]`))
  if (!hasAnyMarker) return null

  const sections: Record<string, string> = {}

  for (const marker of MARKERS) {
    // Capture everything between [MARKER] and the next [MARKER] (or end of string)
    const regex = new RegExp(
      `\\[${marker}\\]\\s*([\\s\\S]*?)(?=\\[(?:${MARKERS.join('|')})\\]|$)`
    )
    const match = text.match(regex)
    sections[marker.toLowerCase()] = match ? match[1].trim() : ''
  }

  return {
    echo: sections.echo || '',
    name: sections.name || '',
    drill: sections.drill || null,
    open: sections.open || '',
  }
}

/**
 * Paragraph-based fallback matching the original parseFeedback logic from
 * useSession.js. Splits on double-newlines and maps paragraphs to fields.
 */
function parseWithParagraphs(text: string) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())

  if (paragraphs.length >= 3) {
    return {
      echo: paragraphs.slice(0, -2).join('\n\n'),
      name: paragraphs[paragraphs.length - 2],
      drill: null,
      open: paragraphs[paragraphs.length - 1],
    }
  }

  if (paragraphs.length === 2) {
    return {
      echo: paragraphs[0],
      name: '',
      drill: null,
      open: paragraphs[1],
    }
  }

  return {
    echo: text,
    name: '',
    drill: null,
    open: '',
  }
}

/**
 * Parse AI feedback text into structured parts.
 *
 * @param {string} text - Raw feedback text from the AI
 * @returns {{ echo: string, name: string, drill: string|null, open: string }}
 */
export default function parseFeedback(text: string) {
  if (!text) {
    return { echo: '', name: '', drill: null, open: '' }
  }

  // Try section markers first
  const markerResult = parseWithMarkers(text)
  if (markerResult) return markerResult

  // Fall back to paragraph splitting
  return parseWithParagraphs(text)
}
