/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ErrorsPrinter } from '@japa/errors-printer'

/**
 * Handles uncaught exceptions and prints them to the
 * console
 */
export class ExceptionsManager {
  #exceptionsBuffer: any[] = []
  #rejectionsBuffer: any[] = []
  #state: 'watching' | 'flowing' = 'watching'
  #errorsPrinter = new ErrorsPrinter({ stackLinesCount: 2, framesMaxLimit: 4 })

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
      this.hasErrors = true
      if (this.#state === 'watching') {
        this.#exceptionsBuffer.push(error)
      } else {
        this.#errorsPrinter.printSectionBorder('[Unhandled Error]')
        await this.#errorsPrinter.printError(error)
        process.exitCode = 1
      }
    })

    process.on('unhandledRejection', async (error) => {
      this.hasErrors = true
      if (this.#state === 'watching') {
        this.#rejectionsBuffer.push(error)
      } else {
        this.#errorsPrinter.printSectionBorder('[Unhandled Rejection]')
        await this.#errorsPrinter.printError(error)
        process.exitCode = 1
      }
    })
  }

  async flow() {
    if (this.#state === 'flowing') {
      return
    }

    this.#state = 'flowing'

    /**
     * Print exceptions
     */
    if (this.#exceptionsBuffer.length) {
      let exceptionsCount = this.#exceptionsBuffer.length
      let exceptionsIndex = this.#exceptionsBuffer.length
      this.#errorsPrinter.printSectionHeader('Unhandled Errors')
      for (let exception of this.#exceptionsBuffer) {
        await this.#errorsPrinter.printError(exception)
        this.#errorsPrinter.printSectionBorder(`[${++exceptionsIndex}/${exceptionsCount}]`)
      }
      this.#exceptionsBuffer = []
    }

    /**
     * Print rejections
     */
    if (this.#rejectionsBuffer.length) {
      let rejectionsCount = this.#exceptionsBuffer.length
      let rejectionsIndex = this.#exceptionsBuffer.length
      this.#errorsPrinter.printSectionBorder('Unhandled Rejections')
      for (let rejection of this.#rejectionsBuffer) {
        await this.#errorsPrinter.printError(rejection)
        this.#errorsPrinter.printSectionBorder(`[${++rejectionsIndex}/${rejectionsCount}]`)
      }
      this.#rejectionsBuffer = []
    }
  }
}
