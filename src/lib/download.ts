import { z } from 'zod'

const downloadErrorSchema = z.object({ error: z.string().min(1) })

interface DownloadOptions {
  url: string
  filename: string
  contentType: string
}

export async function downloadFile({ url, filename, contentType }: DownloadOptions) {
  const response = await fetch(url)

  if (response.redirected) {
    throw new Error('Your session has expired. Sign in again, then retry the download.')
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const result = downloadErrorSchema.safeParse(payload)
    throw new Error(
      result.success
        ? result.data.error
        : `Download failed (HTTP ${response.status}). Please try again.`
    )
  }

  if (response.headers.get('content-type')?.split(';')[0].trim() !== contentType) {
    throw new Error('The server did not return the requested file. Please sign in and retry.')
  }

  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    window.URL.revokeObjectURL(objectUrl)
  }
}
