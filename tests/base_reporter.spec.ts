/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from 'node:test'
import chaiSubset from 'chai-subset'
import { assert, use } from 'chai'

use(chaiSubset)

import { wrapAssertions } from '../tests_helpers/main.js'
import {
  TestEndNode,
  GroupEndNode,
  GroupOptions,
  SuiteEndNode,
  RunnerSummary,
  TestStartNode,
  SuiteStartNode,
} from '../modules/core/types.js'
import {
  Test,
  Suite,
  Group,
  Runner,
  Refiner,
  Emitter,
  TestContext,
  BaseReporter,
} from '../modules/core/main.js'

test.describe('Base reporter', () => {
  test('extend base reporter to create a custom reporter', async () => {
    const stack: string[] = []
    class MyReporter extends BaseReporter {
      protected async start() {
        stack.push('reporter started')
      }
    }

    const emitter = new Emitter()
    const runner = new Runner(emitter)
    runner.registerReporter((r, e) => new MyReporter({}).boot(r, e))

    await runner.start()
    await wrapAssertions(() => {
      assert.deepEqual(stack, ['reporter started'])
    })
  })

  test('invoke handlers when suite, groups and tests are executed', async () => {
    const stack: string[] = []
    let summary: RunnerSummary | undefined

    class MyReporter extends BaseReporter {
      protected async start() {
        stack.push('reporter started')
      }

      protected async end() {
        summary = this.runner!.getSummary()
        stack.push('reporter ended')
      }

      protected onTestStart(t: TestStartNode): void {
        assert.equal(t.title.expanded, '2 + 2')
        assert.equal(this.currentSuiteName, 'unit')
        assert.equal(this.currentGroupName, 'default')
        stack.push('test started')
      }

      protected onTestEnd(t: TestEndNode): void {
        assert.equal(t.title.expanded, '2 + 2')
        assert.isFalse(t.hasError)
        stack.push('test ended')
      }

      protected onGroupStart(g: GroupOptions): void {
        assert.equal(g.title, 'default')
        assert.equal(this.currentSuiteName, 'unit')
        stack.push('group started')
      }

      protected onGroupEnd(g: GroupEndNode): void {
        assert.equal(g.title, 'default')
        assert.isFalse(g.hasError)
        stack.push('group ended')
      }

      protected onSuiteStart(s: SuiteStartNode): void {
        assert.equal(s.name, 'unit')
        stack.push('suite started')
      }

      protected onSuiteEnd(s: SuiteEndNode): void {
        assert.equal(s.name, 'unit')
        stack.push('suite ended')
      }
    }

    const emitter = new Emitter()
    const runner = new Runner(emitter)
    const refiner = new Refiner()
    const suite = new Suite('unit', emitter, refiner)
    const group = new Group('default', emitter, refiner)
    const t = new Test('2 + 2', (_t) => new TestContext(_t), emitter, refiner, group)

    group.add(t)
    suite.add(group)
    runner.add(suite)

    runner.registerReporter((r, e) => new MyReporter({}).boot(r, e))
    await runner.start()
    await runner.exec()
    await runner.end()

    await wrapAssertions(() => {
      assert.deepEqual(stack, [
        'reporter started',
        'suite started',
        'group started',
        'test started',
        'test ended',
        'group ended',
        'suite ended',
        'reporter ended',
      ])

      assert.containSubset(summary!, {
        aggregates: {
          total: 1,
          failed: 0,
          passed: 0,
          regression: 0,
          skipped: 0,
          todo: 1,
        },
        hasError: false,
        failureTree: [],
        failedTestsTitles: [],
      })
    })
  })
})
