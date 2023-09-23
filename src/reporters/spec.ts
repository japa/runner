/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ms from 'ms'
import { relative } from 'node:path'

import { colors, icons } from '../helpers.js'
import { BaseReporter } from '../../modules/core/main.js'
import { GroupStartNode, TestEndNode } from '../../modules/core/types.js'

/**
 * Pretty prints the tests on the console
 */
export class SpecReporter extends BaseReporter {
  /**
   * Tracking if the first event we get is for a test without any parent group
   * We need this to decide the display style for tests without groups.
   */
  #isFirstLoneTest = true

  /**
   * Returns the icon for the test
   */
  #getTestIcon(payload: TestEndNode) {
    if (payload.isTodo) {
      return colors.cyan(icons.info)
    }

    if (payload.isFailing) {
      return payload.hasError ? colors.magenta(icons.squareSmallFilled) : colors.red(icons.cross)
    }

    if (payload.hasError) {
      return colors.red(icons.cross)
    }

    if (payload.isSkipped) {
      return colors.yellow(icons.bullet)
    }

    return colors.green(icons.tick)
  }

  /**
   * Returns the test message
   */
  #getTestMessage(payload: TestEndNode) {
    const message = typeof payload.title === 'string' ? payload.title : payload.title.expanded

    if (payload.isTodo) {
      return colors.blue(message)
    }

    if (payload.isFailing) {
      return payload.hasError ? colors.magenta(message) : colors.red(message)
    }

    if (payload.hasError) {
      return colors.red(message)
    }

    if (payload.isSkipped) {
      return colors.yellow(message)
    }

    return colors.grey(message)
  }

  /**
   * Returns the subtext message for the test
   */
  #getSubText(payload: TestEndNode): string | undefined {
    if (payload.isSkipped && payload.skipReason) {
      return colors.yellow(payload.skipReason)
    }

    if (!payload.isFailing) {
      return
    }

    if (!payload.hasError) {
      return colors.magenta(`Test marked with ".fails()" must finish with an error`)
    }

    if (payload.failReason) {
      return colors.magenta(payload.failReason)
    }

    const testErrorMessage = payload.errors.find((error) => error.phase === 'test')
    if (testErrorMessage && testErrorMessage.error) {
      return colors.magenta(testErrorMessage.error.message)
    }
  }

  /**
   * Returns the filename relative from the current working dir
   */
  #getRelativeFilename(fileName: string) {
    return relative(process.cwd(), fileName)
  }

  /**
   * Prints the test details
   */
  #printTest(payload: TestEndNode) {
    const icon = this.#getTestIcon(payload)
    const message = this.#getTestMessage(payload)
    const prefix = payload.isPinned ? colors.yellow('[PINNED] ') : ''
    const indentation = this.currentFileName || this.currentGroupName ? '  ' : ''
    const duration = colors.dim(`(${ms(Number(payload.duration.toFixed(2)))})`)
    const retries =
      payload.retryAttempt && payload.retryAttempt > 1
        ? colors.dim(`(x${payload.retryAttempt}) `)
        : ''

    let subText = this.#getSubText(payload)
    subText = subText ? `\n${indentation}  ${subText}` : ''

    console.log(`${indentation}${icon} ${prefix}${retries}${message} ${duration}${subText}`)
  }

  /**
   * Prints the group name
   */
  #printGroup(payload: GroupStartNode) {
    const title =
      this.currentSuiteName !== 'default'
        ? `${this.currentSuiteName} / ${payload.title}`
        : payload.title

    const suffix = this.currentFileName
      ? colors.dim(` (${this.#getRelativeFilename(this.currentFileName)})`)
      : ''

    console.log(`\n${title}${suffix}`)
  }

  protected onTestStart(): void {
    /**
     * Display the filename when
     *
     * - The filename exists
     * - The test is not under a group
     * - Test is first in a sequence
     */
    if (this.currentFileName && this.#isFirstLoneTest) {
      console.log(`\n${colors.dim(this.#getRelativeFilename(this.currentFileName))}`)
    }
    this.#isFirstLoneTest = false
  }

  protected onTestEnd(payload: TestEndNode): void {
    this.#printTest(payload)
  }

  protected onGroupStart(payload: GroupStartNode): void {
    /**
     * When a group starts, we mark the upcoming test as NOT a
     * lone test
     */
    this.#isFirstLoneTest = false
    this.#printGroup(payload)
  }

  protected onGroupEnd(): void {
    /**
     * When the group ends we assume that the next test can
     * be out of the group, hence a lone test.
     *
     * If this assumption is false, then the `onGroupStart` method
     * will toggle the boolean
     */
    this.#isFirstLoneTest = true
  }

  protected async end() {
    const summary = this.runner!.getSummary()
    await this.printSummary(summary)
  }
}
