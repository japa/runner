/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { assert } from 'chai'
import { test } from 'node:test'

import { wrapAssertions } from './helpers.js'
import {
  type TestEndNode,
  type GroupEndNode,
  type GroupOptions,
  type SuiteEndNode,
  type RunnerSummary,
  type TestStartNode,
  type SuiteStartNode,
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

test.describe('Reporter output buffering', () => {
  test('batch writes, flush failures in order, and avoid duplicate flushes', async () => {
    const { OutputBuffer } = await import('../src/reporters/output_buffer.js')
    const writes: string[] = []
    const output = new OutputBuffer(true, (message) => {
      writes.push(message)
    })
    output.write('pass\n')
    output.write('pass\n')
    assert.deepEqual(writes, [])
    output.write('failure\n', true)
    assert.deepEqual(writes, ['pass\npass\nfailure\n'])
    output.flush()
    assert.lengthOf(writes, 1)
  })

  test('bound batch size and flush progress on a timer', async () => {
    const { OutputBuffer } = await import('../src/reporters/output_buffer.js')
    const writes: string[] = []
    const output = new OutputBuffer(true, (message) => {
      writes.push(message)
    })
    output.write('x'.repeat(8192))
    assert.lengthOf(writes, 1)
    output.write('progress')
    await new Promise((resolve) => setTimeout(resolve, 40))
    assert.deepEqual(writes, ['x'.repeat(8192), 'progress'])
    output.flush()
  })

  test('flush remaining output before the reporter end hook', async () => {
    const writes: string[] = []
    class BufferedReporter extends BaseReporter {
      protected async start() {
        this.output.write('pending')
      }
      protected async end() {
        assert.deepEqual(writes, ['pending'])
      }
      constructor() {
        super({ bufferOutput: true })
        // Test the buffer without changing the process stdout shared by other tests.
        this.output = new BufferForTest(true, (message) => {
          writes.push(message)
        })
      }
    }
    const { OutputBuffer: BufferForTest } = await import('../src/reporters/output_buffer.js')
    const runner = new Runner(new Emitter())
    runner.registerReporter((r, e) => new BufferedReporter().boot(r, e))
    await runner.start()
    await runner.end()
  })
})

test('duration reporter writes suite-qualified file estimates at runner end', async (context) => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const { fileDurations } = await import('../src/reporters/main.js')
  const directory = await mkdtemp(fileURLToPath(new URL('../.durations-', import.meta.url)))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const output = `${directory}/durations.json`
  const emitter = new Emitter()
  const runner = new Runner(emitter)
  const refiner = new Refiner()
  const suite = new Suite('unit', emitter, refiner)
  for (const title of ['first', 'second']) {
    const instance = new Test(title, (t) => new TestContext(t), emitter, refiner)
    instance.options.meta.fileName = '/tests/a.spec.ts'
    instance.run(() => {})
    suite.add(instance)
  }
  runner.add(suite)
  runner.registerReporter(fileDurations({ output, cwd: '/' }))
  await runner.start()
  await runner.exec()
  await runner.end()
  const durations = JSON.parse(await readFile(output, 'utf8')) as Record<string, number>
  assert.deepEqual(Object.keys(durations), ['unit:tests/a.spec.ts'])
  assert.isAtLeast(durations['unit:tests/a.spec.ts'], 0)
})
