/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ErrorsPrinter } from '@japa/errors-printer'

export async function wrapAssertions(fn: () => void | Promise<void>) {
  try {
    await fn()
  } catch (error) {
    await new ErrorsPrinter().printError(error)
    throw new Error('Assertion failure')
  }
}
