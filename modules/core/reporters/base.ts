/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ms from 'ms'
import { colors } from '../../../src/helpers.js'
import { ErrorsPrinter } from '@japa/errors-printer'

import type {
  TestEndNode,
  SuiteEndNode,
  GroupEndNode,
  TestStartNode,
  RunnerSummary,
  RunnerEndNode,
  GroupStartNode,
  SuiteStartNode,
  RunnerStartNode,
  BaseReporterOptions,
} from '../types.js'
import { Emitter, Runner } from '../main.js'

/**
 * Base reporter to build custom reporters on top of
 */
export abstract class BaseReporter {
  #options: BaseReporterOptions
  runner?: Runner

  /**
   * Path to the file for which the tests are getting executed
   */
  currentFileName?: string

  /**
   * Suite for which the tests are getting executed
   */
  currentSuiteName?: string

  /**
   * Group for which the tests are getting executed
   */
  currentGroupName?: string

  constructor(options: BaseReporterOptions = {}) {
    this.#options = Object.assign({ stackLinesCount: 2 }, options)
  }

  /**
   * Pretty prints the aggregates
   */
  #printAggregates(summary: RunnerSummary) {
    const tests: string[] = []

    /**
     * Set value for tests row
     */
    if (summary.aggregates.passed) {
      tests.push(colors.green(`${summary.aggregates.passed} passed`))
    }
    if (summary.aggregates.failed) {
      tests.push(colors.red(`${summary.aggregates.failed} failed`))
    }
    if (summary.aggregates.todo) {
      tests.push(colors.cyan(`${summary.aggregates.todo} todo`))
    }
    if (summary.aggregates.skipped) {
      tests.push(colors.yellow(`${summary.aggregates.skipped} skipped`))
    }
    if (summary.aggregates.regression) {
      tests.push(colors.magenta(`${summary.aggregates.regression} regression`))
    }

    this.runner!.summaryBuilder.use(() => {
      return [
        {
          key: colors.dim('Tests'),
          value: `${tests.join(', ')} ${colors.dim(`(${summary.aggregates.total})`)}`,
        },
        {
          key: colors.dim('Time'),
          value: colors.dim(ms(summary.duration)),
        },
      ]
    })

    console.log(this.runner!.summaryBuilder.build().join('\n'))
  }

  /**
   * Aggregates errors tree to a flat array
   */
  #aggregateErrors(summary: RunnerSummary) {
    const errorsList: { phase: string; title: string; error: Error }[] = []

    summary.failureTree.forEach((suite) => {
      suite.errors.forEach((error) => errorsList.push({ title: suite.name, ...error }))

      suite.children.forEach((testOrGroup) => {
        /**
         * Suite child is a test
         */
        if (testOrGroup.type === 'test') {
          testOrGroup.errors.forEach((error) => {
            errorsList.push({ title: `${suite.name} / ${testOrGroup.title}`, ...error })
          })
          return
        }

        /**
         * Suite child is a group
         */
        testOrGroup.errors.forEach((error) => {
          errorsList.push({ title: testOrGroup.name, ...error })
        })
        testOrGroup.children.forEach((test) => {
          test.errors.forEach((error) => {
            errorsList.push({ title: `${testOrGroup.name} / ${test.title}`, ...error })
          })
        })
      })
    })

    return errorsList
  }

  /**
   * Pretty print errors
   */
  async #printErrors(summary: RunnerSummary) {
    if (!summary.failureTree.length) {
      return
    }

    const errorPrinter = new ErrorsPrinter({
      stackLinesCount: this.#options.stackLinesCount,
      framesMaxLimit: this.#options.framesMaxLimit,
    })

    errorPrinter.printSectionHeader('ERRORS')
    await errorPrinter.printErrors(this.#aggregateErrors(summary))
  }

  /**
   * Handlers to capture events
   */
  protected onTestStart(_: TestStartNode): void {}
  protected onTestEnd(_: TestEndNode) {}

  protected onGroupStart(_: GroupStartNode) {}
  protected onGroupEnd(_: GroupEndNode) {}

  protected onSuiteStart(_: SuiteStartNode) {}
  protected onSuiteEnd(_: SuiteEndNode) {}

  protected async start(_: RunnerStartNode) {}
  protected async end(_: RunnerEndNode) {}

  /**
   * Print tests summary
   */
  protected async printSummary(summary: RunnerSummary) {
    await this.#printErrors(summary)

    console.log('')
    if (summary.aggregates.total === 0 && !summary.hasError) {
      console.log(colors.bgYellow().black(' NO TESTS EXECUTED '))
      return
    }

    if (summary.hasError) {
      console.log(colors.bgRed().black(' FAILED '))
    } else {
      console.log(colors.bgGreen().black(' PASSED '))
    }
    console.log('')
    this.#printAggregates(summary)
  }

  /**
   * Invoked by the tests runner when tests are about to start
   */
  boot(runner: Runner, emitter: Emitter) {
    this.runner = runner

    emitter.on('test:start', (payload) => {
      this.currentFileName = payload.meta.fileName
      this.onTestStart(payload)
    })

    emitter.on('test:end', (payload) => {
      this.onTestEnd(payload)
    })

    emitter.on('group:start', (payload) => {
      this.currentGroupName = payload.title
      this.currentFileName = payload.meta.fileName
      this.onGroupStart(payload)
    })

    emitter.on('group:end', (payload) => {
      this.currentGroupName = undefined
      this.onGroupEnd(payload)
    })

    emitter.on('suite:start', (payload) => {
      this.currentSuiteName = payload.name
      this.onSuiteStart(payload)
    })

    emitter.on('suite:end', (payload) => {
      this.currentSuiteName = undefined
      this.onSuiteEnd(payload)
    })

    emitter.on('runner:start', async (payload) => {
      await this.start(payload)
    })

    emitter.on('runner:end', async (payload) => {
      await this.end(payload)
    })
  }
}
