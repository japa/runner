/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ErrorsPrinter } from '@japa/errors-printer'
import { Emitter } from '../modules/core/main.js'
import { RunnerEvents } from '../src/types.js'

export async function wrapAssertions(fn: () => void | Promise<void>) {
  try {
    await fn()
  } catch (error) {
    await new ErrorsPrinter().printError(error)
    throw new Error('Assertion failure')
  }
}

/**
 * Promisify an event
 */
export function pEvent<Name extends keyof RunnerEvents>(
  emitter: Emitter,
  event: Name,
  timeout: number = 500
) {
  return new Promise<RunnerEvents[Name] | null>((resolve) => {
    function handler(data: RunnerEvents[Name]) {
      emitter.off(event, handler)
      resolve(data)
    }

    setTimeout(() => {
      emitter.off(event, handler)
      resolve(null)
    }, timeout)
    emitter.on(event, handler)
  })
}
