/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { relative } from 'node:path'
import string from '@poppinss/string'
import { stripVTControlCharacters } from 'node:util'
import { ErrorsPrinter } from '@japa/errors-printer'
import { BaseReporter } from '../../modules/core/main.js'

/**
 * Prints annotations when executing tests within Github actions
 */
export class GithubReporter extends BaseReporter {
  /**
   * Performs string escape on annotation message as per
   * https://github.com/actions/toolkit/blob/f1d9b4b985e6f0f728b4b766db73498403fd5ca3/packages/core/src/command.ts#L80-L85
   */
  protected escapeMessage(value: string): string {
    return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  }

  /**
   * Performs string escape on annotation properties as per
   * https://github.com/actions/toolkit/blob/f1d9b4b985e6f0f728b4b766db73498403fd5ca3/packages/core/src/command.ts#L80-L85
   */
  protected escapeProperty(value: string): string {
    return value
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A')
      .replace(/:/g, '%3A')
      .replace(/,/g, '%2C')
  }

  /**
   * Formats the message as per the Github annotations spec.
   * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
   */
  protected formatMessage({
    command,
    properties,
    message,
  }: {
    command: string
    properties: Record<string, string>
    message: string
  }): string {
    let result = `::${command}`
    Object.entries(properties).forEach(([k, v], i) => {
      result += i === 0 ? ' ' : ','
      result += `${k}=${this.escapeProperty(v)}`
    })
    result += `::${this.escapeMessage(message)}`
    return result
  }

  /**
   * Prints Github annotation for a given error
   */
  async getErrorAnnotation(
    printer: ErrorsPrinter,
    error: { phase: string; title: string; error: Error }
  ) {
    const parsedError = await printer.parseError(error.error)
    if (!('frames' in parsedError)) {
      return
    }

    const mainFrame = parsedError.frames.find((frame) => frame.type === 'app')
    if (!mainFrame) {
      return
    }

    return this.formatMessage({
      command: 'error',
      properties: {
        file: string.toUnixSlash(relative(process.cwd(), mainFrame.fileName!)),
        title: error.title,
        line: String(mainFrame.lineNumber!),
        column: String(mainFrame.columnNumber!),
      },
      message: stripVTControlCharacters(parsedError.message),
    })
  }

  async end() {
    const summary = this.runner!.getSummary()
    const errorsList = this.aggregateErrors(summary)
    const errorPrinter = new ErrorsPrinter(this.options)

    for (let error of errorsList) {
      const formatted = await this.getErrorAnnotation(errorPrinter, error)
      if (formatted) {
        console.log(`\n${formatted}`)
      }
    }
  }
}
