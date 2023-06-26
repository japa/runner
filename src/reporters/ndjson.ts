/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { relative } from 'node:path'
import { BaseReporter } from '../../modules/core/main.js'
import type {
  TestEndNode,
  SuiteEndNode,
  GroupEndNode,
  SuiteStartNode,
  GroupStartNode,
} from '../../modules/core/types.js'

/**
 * Prints tests progress as JSON. Each event is emitted
 * independently
 */
export class NdJSONReporter extends BaseReporter {
  /**
   * Returns the filename relative from the current working dir
   */
  #getRelativeFilename(fileName: string) {
    return relative(process.cwd(), fileName)
  }

  protected onTestEnd(payload: TestEndNode): void {
    console.log(
      JSON.stringify({
        event: 'test:end',
        filePath: this.currentFileName,
        relativePath: this.currentFileName
          ? this.#getRelativeFilename(this.currentFileName)
          : undefined,
        title: payload.title,
        duration: payload.duration,
        failReason: payload.failReason,
        isFailing: payload.isFailing,
        skipReason: payload.skipReason,
        isSkipped: payload.isSkipped,
        isTodo: payload.isTodo,
        isPinned: payload.isPinned,
        retryAttempt: payload.retryAttempt,
        retries: payload.retries,
        errors: payload.errors,
      })
    )
  }

  protected onGroupStart(payload: GroupStartNode): void {
    console.log(
      JSON.stringify({
        event: 'group:start',
        title: payload.title,
      })
    )
  }

  protected onGroupEnd(payload: GroupEndNode): void {
    JSON.stringify({
      event: 'group:end',
      title: payload.title,
      errors: payload.errors,
    })
  }

  protected onSuiteStart(payload: SuiteStartNode): void {
    console.log(
      JSON.stringify({
        event: 'suite:start',
        ...payload,
      })
    )
  }

  protected onSuiteEnd(payload: SuiteEndNode): void {
    console.log(
      JSON.stringify({
        event: 'suite:end',
        ...payload,
      })
    )
  }

  protected async end() {
    const summary = this.runner!.getSummary()
    console.log(
      JSON.stringify({
        aggregates: summary.aggregates,
        duration: summary.duration,
        failedTestsTitles: summary.failedTestsTitles,
        hasError: summary.hasError,
      })
    )
  }
}
