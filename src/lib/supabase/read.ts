import { z } from 'zod'
import { getAppConfig } from '../config'

interface ReadResult {
  data: unknown
  error: { message: string } | null
  count?: number | null
}

type ReadPage = (from: number, to: number) => PromiseLike<ReadResult>

/** Read an ordered query completely, including pages capped by the server. */
export async function readAllRows<T>(
  label: string,
  schema: z.ZodType<T>,
  readPage: ReadPage
): Promise<T[]> {
  const { pageSize } = getAppConfig().inventoryQueries
  const rows: T[] = []

  for (let from = 0; ; ) {
    const { data, error, count } = await readPage(from, from + pageSize - 1)
    if (error) {
      console.error(`Failed to load ${label}:`, error.message)
      throw new Error(`Unable to load ${label}. Please try again.`)
    }

    const result = z.array(schema).safeParse(data)
    if (!result.success) {
      console.error(`Invalid ${label} response:`, result.error.message)
      throw new Error(`Unable to load ${label}. Please try again.`)
    }

    rows.push(...result.data)
    if (result.data.length === 0) {
      if (count != null && rows.length < count) {
        throw new Error(`Unable to load all ${label}. Please try again.`)
      }
      return rows
    }
    if (count != null && rows.length >= count) return rows
    from += result.data.length
  }
}

/** Bound ID filters and paginate the movement history within each batch. */
export async function readRowsByIds<T>(
  label: string,
  schema: z.ZodType<T>,
  ids: string[],
  readPage: (batch: string[], from: number, to: number) => PromiseLike<ReadResult>
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return []

  const { idBatchSize } = getAppConfig().inventoryQueries
  const rows: T[] = []
  for (let start = 0; start < uniqueIds.length; start += idBatchSize) {
    const batch = uniqueIds.slice(start, start + idBatchSize)
    rows.push(...await readAllRows(label, schema, (from, to) => readPage(batch, from, to)))
  }
  return rows
}
