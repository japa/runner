/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ErrorsPrinter } from '@japa/errors-printer'
import debug from './debug.js'

/**
 * Handles uncaught exceptions and prints them to the
 * console
 */
export class ExceptionsManager {
  #exceptionsBuffer: unknown[] = []
  #rejectionsBuffer: unknown[] = []
  #state: 'watching' | 'reporting' = 'watching'
  #errorsPrinter?: Promise<ErrorsPrinter>

  #getErrorsPrinter() {
    return (this.#errorsPrinter ??= import('@japa/errors-printer').then(
      ({ ErrorsPrinter }) => new ErrorsPrinter({ stackLinesCount: 2, framesMaxLimit: 4 })
    ))
  }

  hasErrors: boolean = false

  /**
   * Monitors unhandled exceptions and rejections. The exceptions
   * are stacked in a buffer, so that we do not clutter the
   * tests output and once the tests are over, we will
   * print them to the console.
   *
   * In case the tests are completed, we will print errors as they
   * happen.
   */
  monitor() {
    process.on('uncaughtException', async (error) => {
      debug('received uncaught exception %O', error)
      this.hasErrors = true
      if (this.#state === 'watching') {
        this.#exceptionsBuffer.push(error)
      } else {
        process.exitCode = 1
        const printer = await this.#getErrorsPrinter()
        printer.printSectionBorder('[Unhandled Error]')
        await printer.printError(error)
        process.exitCode = 1
      }
    })

    process.on('unhandledRejection', async (error) => {
      debug('received unhandled rejection %O', error)
      this.hasErrors = true
      if (this.#state === 'watching') {
        this.#rejectionsBuffer.push(error)
      } else {
        process.exitCode = 1
        const printer = await this.#getErrorsPrinter()
        printer.printSectionBorder('[Unhandled Rejection]')
        await printer.printError(error)
        process.exitCode = 1
      }
    })
  }

  async report() {
    if (this.#state === 'reporting') {
      return
    }

    this.#state = 'reporting'
    if (!this.#exceptionsBuffer.length && !this.#rejectionsBuffer.length) return
    const printer = await this.#getErrorsPrinter()

    /**
     * Print exceptions
     */
    if (this.#exceptionsBuffer.length) {
      let exceptionsCount = this.#exceptionsBuffer.length
      let exceptionsIndex = this.#exceptionsBuffer.length
      printer.printSectionHeader('Unhandled Errors')
      for (let exception of this.#exceptionsBuffer) {
        await printer.printError(exception)
        printer.printSectionBorder(`[${++exceptionsIndex}/${exceptionsCount}]`)
      }
      this.#exceptionsBuffer = []
    }

    /**
     * Print rejections
     */
    if (this.#rejectionsBuffer.length) {
      let rejectionsCount = this.#exceptionsBuffer.length
      let rejectionsIndex = this.#exceptionsBuffer.length
      printer.printSectionBorder('Unhandled Rejections')
      for (let rejection of this.#rejectionsBuffer) {
        await printer.printError(rejection)
        printer.printSectionBorder(`[${++rejectionsIndex}/${rejectionsCount}]`)
      }
      this.#rejectionsBuffer = []
    }
  }
}
