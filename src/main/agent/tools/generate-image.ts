import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { DeliverableWritten } from '../../../shared/types'

interface GenerateImageResult extends DeliverableWritten {
  base64: string
}

export async function generateImage(
  outputDir: string,
  filename: string,
  prompt: string,
  openAiKey: string
): Promise<GenerateImageResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI Image API: ${err}`)
  }

  const data = (await response.json()) as { data: Array<{ b64_json: string }> }
  const base64 = data.data[0].b64_json

  await mkdir(outputDir, { recursive: true })
  const safeName = filename.endsWith('.png') ? filename : `${filename}.png`
  const filePath = join(outputDir, safeName)
  await writeFile(filePath, Buffer.from(base64, 'base64'))

  return { filename: safeName, path: filePath, base64 }
}
