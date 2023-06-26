/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import cliui from '../helpers.js'
import type { TestEndNode } from '../../modules/core/types.js'
import { BaseReporter } from '../../modules/core/reporters/base.js'

/**
 * Minimal reporter that prints each test as an icon.
 */
export class DotReporter extends BaseReporter {
  /**
   * When a test ended
   */
  protected onTestEnd(payload: TestEndNode) {
    let output = ''
    if (payload.isTodo) {
      output = cliui.colors.cyan('-')
    } else if (payload.hasError || payload.isFailing) {
      output = cliui.colors.red('×')
    } else if (payload.isSkipped) {
      output = cliui.colors.yellow('-')
    } else {
      output = cliui.colors.green('•')
    }

    process.stdout.write(`${output}`)
  }

  /**
   * When test runner ended
   */
  protected async end() {
    console.log('')
    await this.printSummary(this.runner!.getSummary())
  }
}
