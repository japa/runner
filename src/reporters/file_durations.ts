/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import type { NamedReporterContract } from '../types.js'

/** Collect test execution time by suite/file for subsequent balanced shards. */
export function fileDurations(options: { output: string; cwd?: string }): NamedReporterContract {
  return {
    name: 'file-durations',
    handler(_, emitter) {
      const durations: Record<string, number> = Object.create(null)
      let suite = 'default'
      emitter.on('suite:start', (payload) => {
        suite = payload.name
      })
      emitter.on('test:end', (payload) => {
        const file = payload.meta.fileName
        if (typeof file !== 'string') return
        const path = relative(options.cwd ?? process.cwd(), file)
          .split('\\')
          .join('/')
        const key = `${suite}:${path}`
        durations[key] = (durations[key] ?? 0) + payload.duration
      })
      emitter.on('runner:end', async () => {
        await mkdir(dirname(options.output), { recursive: true })
        await writeFile(options.output, JSON.stringify(durations, null, 2) + '\n')
      })
    },
  }
}
