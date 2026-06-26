import { access } from 'fs/promises'
import { join, extname, basename } from 'path'

export async function resolveUniqueFilename(dir: string, filename: string): Promise<string> {
  const ext = extname(filename)
  const base = basename(filename, ext)
  let candidate = filename
  let v = 2
  while (true) {
    try {
      await access(join(dir, candidate))
      candidate = `${base}-v${v}${ext}`
      v++
    } catch {
      return candidate
    }
  }
}
