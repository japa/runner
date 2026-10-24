/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { assert } from 'chai'
import { test, type TestContext as NodeTestContext } from 'node:test'
import { rejects } from 'node:assert/strict'

import { runner } from '../factories/main.js'
import { GlobalHooks } from '../src/hooks.js'
import { ConfigManager } from '../src/config_manager.js'
import { pEvent, wrapAssertions } from './helpers.js'
import { createTest, createTestGroup } from '../src/create_test.js'
import { Emitter, Refiner, Runner, Suite } from '../modules/core/main.js'
import { disallowPinnedTests } from '../src/plugins/disallow_pinned_tests.js'
import { clearCache, getFailedTests, retryPlugin } from '../src/plugins/retry.js'

test.describe('Runner | create tests and groups', () => {
  test('raise error when defining nested groups', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const group = createTestGroup('', emitter, refiner, {})

    await wrapAssertions(() => {
      assert.throws(
        () => createTestGroup('', emitter, refiner, { group }),
        'Nested groups are not supported by Japa'
      )
    })
  })

  test('add group to the suite when defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('', emitter, refiner)
    const group = createTestGroup('', emitter, refiner, { suite })

    await wrapAssertions(() => {
      assert.deepEqual(suite.stack, [group])
    })
  })

  test('add test to the suite when defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('', emitter, refiner)
    const t = createTest('', emitter, refiner, new Error(), { suite })

    await wrapAssertions(() => {
      assert.deepEqual(suite.stack, [t])
    })
  })

  test('add test to the group when group and suite both are defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('', emitter, refiner)

    const group = createTestGroup('', emitter, refiner, { suite })
    const t = createTest('', emitter, refiner, new Error(), { suite, group })

    await wrapAssertions(() => {
      assert.deepEqual(suite.stack, [group])
      assert.deepEqual(group.tests, [t])
    })
  })

  test('define test timeout from global options', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), { timeout: 1000 })

    await wrapAssertions(() => {
      assert.equal(t.options.timeout, 1000)
    })
  })

  test('define test retries from global options', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), { retries: 4 })

    await wrapAssertions(() => {
      assert.equal(t.options.retries, 4)
    })
  })

  test('execute test', async () => {
    const stack: string[] = []
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), { retries: 4 })
    t.run(() => {
      stack.push('executed')
    })

    await t.exec()
    await wrapAssertions(() => {
      assert.deepEqual(stack, ['executed'])
    })
  })

  test('assert test throws an exception', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failed')

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])

    await wrapAssertions(() => {
      assert.equal(event!.hasError, false)
    })
  })

  test('assert error matches the regular expression', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {
      throw new Error('Failed')
    }).throws(/ed?/)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])

    await wrapAssertions(() => {
      assert.equal(event!.hasError, false)
    })
  })

  test('throw error when test does not have a callback defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})

    await wrapAssertions(() => {
      assert.throws(
        () => t.throws(/ed?/),
        'Cannot use "test.throws" method without a test callback'
      )
    })
  })

  test('assert test throws an instance of a given class', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failed', Error)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    await wrapAssertions(() => {
      assert.equal(event!.hasError, false)
    })
  })

  test('fail when test does not throw an exception', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {}).throws('Failed', Error)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    await wrapAssertions(() => {
      assert.equal(event!.hasError, true)
      assert.equal(event!.errors[0].error.message, 'Expected test to throw an exception')
    })
  })

  test('fail when error constructor mismatch', async () => {
    class Exception {}
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failed', Exception)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    await wrapAssertions(() => {
      assert.equal(event!.hasError, true)
      assert.equal(event!.errors[0].error.message, 'Expected test to throw "[class Exception]"')
    })
  })

  test('fail when error message mismatch', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failure')

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    await wrapAssertions(() => {
      assert.equal(event!.hasError, true)
      assert.equal(
        event!.errors[0].error.message,
        'Expected test to throw "Failure". Instead received "Failed"'
      )
    })
  })

  test('fail when error does not match the regular expression', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, new Error(), {})
    t.run(() => {
      throw new Error('Failed')
    }).throws(/lure?/)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    await wrapAssertions(() => {
      assert.equal(event!.hasError, true)
      assert.equal(
        event!.errors[0].error.message,
        'Expected test error to match "/lure?/" regular expression'
      )
    })
  })
})

test.describe('Runner | global hooks', () => {
  test('do not run teardown hooks when setup hooks were not executed', async () => {
    const hooks = new GlobalHooks()
    const stack: string[] = []

    hooks.apply(
      new ConfigManager(
        {
          files: [],
          setup: [
            () => {
              stack.push('setup')
            },
          ],
          teardown: [
            () => {
              stack.push('teardown')
            },
          ],
        },
        {}
      ).hydrate()
    )

    const emitter = new Emitter()
    await hooks.teardown(null, new Runner(emitter))

    await wrapAssertions(() => {
      assert.deepEqual(stack, [])
    })
  })

  test('run teardown hooks when setup hooks were executed', async () => {
    const hooks = new GlobalHooks()
    const stack: string[] = []

    hooks.apply(
      new ConfigManager(
        {
          files: [],
          setup: [
            () => {
              stack.push('setup')
            },
          ],
          teardown: [
            () => {
              stack.push('teardown')
            },
          ],
        },
        {}
      ).hydrate()
    )

    const emitter = new Emitter()
    await hooks.setup(new Runner(emitter))
    await hooks.teardown(null, new Runner(emitter))

    await wrapAssertions(() => {
      assert.deepEqual(stack, ['setup', 'teardown'])
    })
  })

  test('do not run teardown hooks in case of error', async () => {
    const hooks = new GlobalHooks()
    const stack: string[] = []

    hooks.apply(
      new ConfigManager(
        {
          files: [],
          setup: [
            () => {
              stack.push('setup')
            },
          ],
          teardown: [
            () => {
              stack.push('teardown')
            },
          ],
        },
        {}
      ).hydrate()
    )

    const emitter = new Emitter()
    await hooks.setup(new Runner(emitter))
    await hooks.teardown(new Error('foo'), new Runner(emitter))

    await wrapAssertions(() => {
      assert.deepEqual(stack, ['setup'])
    })
  })

  test('run teardown cleanup methods when teardown hook raises error', async () => {
    const hooks = new GlobalHooks()
    const stack: string[] = []

    hooks.apply(
      new ConfigManager(
        {
          files: [],
          setup: [
            () => {
              stack.push('setup')
            },
          ],
          teardown: [
            () => {
              stack.push('teardown')
              return () => {
                stack.push('teardown cleanup')
              }
            },
            () => {
              throw new Error('blowup')
            },
          ],
        },
        {}
      ).hydrate()
    )

    const emitter = new Emitter()
    await hooks.setup(new Runner(emitter))
    try {
      await hooks.teardown(null, new Runner(emitter))
    } catch (error) {
      await hooks.teardown(error, new Runner(emitter))
    }

    await wrapAssertions(() => {
      assert.deepEqual(stack, ['setup', 'teardown', 'teardown cleanup'])
    })
  })
})

test.describe('Runner | retryPlugin', () => {
  test('store failing tests inside the cache dir', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    const suite = new Suite('same', emitter, refiner)
    createTest('failing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing failing test')
      throw new Error('Failing')
    })
    createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing passing test')
    })

    await runner()
      .configure({
        files: [],
        refiner,
        reporters: {
          activated: [],
          list: [],
        },
        plugins: [retryPlugin],
      })
      .useEmitter(emitter)
      .runSuites(() => [suite])

    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, ['executing failing test', 'executing passing test'])
    })

    await clearCache()
  })

  test('run only failed tests when failed flag is used', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    function getSuite() {
      const suite = new Suite('same', emitter, refiner)
      createTest('failing test', emitter, refiner, new Error(), { suite }).run(() => {
        stack.push('executing failing test')
        throw new Error('Failing')
      })
      createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
        stack.push('executing passing test')
      })

      return suite
    }

    function getExecutor(argv?: string[]) {
      return runner()
        .configure(
          {
            files: [],
            refiner,
            reporters: {
              activated: [],
              list: [],
            },
            plugins: [retryPlugin],
          },
          argv
        )
        .useEmitter(emitter)
    }

    await getExecutor().runSuites(() => [getSuite()])
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, ['executing failing test', 'executing passing test'])
    })

    await getExecutor(['--failed']).runSuites(() => [getSuite()])
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, [
        'executing failing test',
        'executing passing test',
        'executing failing test',
      ])
    })

    await clearCache()
  })

  test('run all tests when failed flag is not used', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    function getSuite() {
      const suite = new Suite('same', emitter, refiner)
      createTest('failing test', emitter, refiner, new Error(), { suite }).run(() => {
        stack.push('executing failing test')
        throw new Error('Failing')
      })
      createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
        stack.push('executing passing test')
      })

      return suite
    }

    function getExecutor(argv?: string[]) {
      return runner()
        .configure(
          {
            files: [],
            refiner,
            reporters: {
              activated: [],
              list: [],
            },
            plugins: [retryPlugin],
          },
          argv
        )
        .useEmitter(emitter)
    }

    await getExecutor().runSuites(() => [getSuite()])
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, ['executing failing test', 'executing passing test'])
    })

    await getExecutor([]).runSuites(() => [getSuite()])
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, [
        'executing failing test',
        'executing passing test',
        'executing failing test',
        'executing passing test',
      ])
    })

    await clearCache()
  })

  test('run all tests when there are no failing tests', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    function getSuite() {
      const suite = new Suite('same', emitter, refiner)
      createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
        stack.push('executing passing test')
      })

      return suite
    }

    function getExecutor(argv?: string[]) {
      return runner()
        .configure(
          {
            files: [],
            refiner,
            reporters: {
              activated: [],
              list: [],
            },
            plugins: [retryPlugin],
          },
          argv
        )
        .useEmitter(emitter)
    }

    await getExecutor().runSuites(() => [getSuite()])
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: [] })
      assert.deepEqual(stack, ['executing passing test'])
    })

    await getExecutor(['--failed']).runSuites(() => [getSuite()])
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: [] })
      assert.deepEqual(stack, ['executing passing test', 'executing passing test'])
    })

    await clearCache()
  })
})

test.describe('Runner | bail', () => {
  test('stop after a failing test', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    const suite = new Suite('same', emitter, refiner)
    createTest('failing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing failing test')
      throw new Error('Failing')
    })
    createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing passing test')
    })

    await runner()
      .bail()
      .configure({
        files: [],
        refiner,
        reporters: {
          activated: [],
          list: [],
        },
      })
      .useEmitter(emitter)
      .runSuites(() => [suite])

    await wrapAssertions(async () => {
      assert.deepEqual(stack, ['executing failing test'])
    })
  })

  test('run all suites when bailLayer is set to suite', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    const unit = new Suite('unit', emitter, refiner)
    unit.bail()
    const functional = new Suite('functional', emitter, refiner)
    functional.bail()

    createTest('failing unit test', emitter, refiner, new Error(), { suite: unit }).run(() => {
      stack.push('executing failing unit test')
      throw new Error('Failing')
    })
    createTest('passing unit test', emitter, refiner, new Error(), { suite: unit }).run(() => {
      stack.push('executing passing unit test')
    })

    createTest('failing functional test', emitter, refiner, new Error(), { suite: functional }).run(
      () => {
        stack.push('executing failing functional test')
        throw new Error('Failing')
      }
    )
    createTest('passing functional test', emitter, refiner, new Error(), { suite: functional }).run(
      () => {
        stack.push('executing passing functional test')
      }
    )

    await runner()
      .configure({
        files: [],
        refiner,
        reporters: {
          activated: [],
          list: [],
        },
      })
      .useEmitter(emitter)
      .runSuites(() => [unit, functional])

    await wrapAssertions(async () => {
      assert.deepEqual(stack, ['executing failing unit test', 'executing failing functional test'])
    })
  })

  test('run all groups when bailLayer is set to group', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    const unit = new Suite('unit', emitter, refiner)

    const group1 = createTestGroup('group 1', emitter, refiner, { suite: unit })
    group1.bail()

    const group2 = createTestGroup('group 2', emitter, refiner, { suite: unit })
    group2.bail()

    createTest('failing group 1 test', emitter, refiner, new Error(), {
      suite: unit,
      group: group1,
    }).run(() => {
      stack.push('executing failing group 1 test')
      throw new Error('Failing')
    })
    createTest('passing group 1 test', emitter, refiner, new Error(), {
      suite: unit,
      group: group1,
    }).run(() => {
      stack.push('executing passing group 1 test')
    })

    createTest('failing group 2 test', emitter, refiner, new Error(), {
      suite: unit,
      group: group2,
    }).run(() => {
      stack.push('executing failing group 2 test')
      throw new Error('Failing')
    })
    createTest('passing group 1 test', emitter, refiner, new Error(), {
      suite: unit,
      group: group2,
    }).run(() => {
      stack.push('executing passing group 2 test')
    })

    await runner()
      .configure({
        files: [],
        refiner,
        reporters: {
          activated: [],
          list: [],
        },
      })
      .useEmitter(emitter)
      .runSuites(() => [unit])

    await wrapAssertions(async () => {
      assert.deepEqual(stack, ['executing failing group 1 test', 'executing failing group 2 test'])
    })
  })
})

test.describe('Runner | disallowPinnedTests plugin', () => {
  test('fail when one or more tests are pinned', async () => {
    const stack: string[] = []
    let fatalError: Error

    const emitter = new Emitter()
    const refiner = new Refiner()

    const suite = new Suite('same', emitter, refiner)
    createTest('pinned test', emitter, refiner, new Error(), { suite })
      .run(() => {
        stack.push('executing pinned test')
      })
      .pin()

    createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing passing test')
    })

    try {
      await runner()
        .configure({
          files: [],
          refiner,
          reporters: {
            activated: [],
            list: [],
          },
          plugins: [disallowPinnedTests()],
        })
        .useEmitter(emitter)
        .runSuites(() => [suite])
    } catch (error) {
      fatalError = error
    }

    await wrapAssertions(async () => {
      assert.equal(
        fatalError.message,
        'Pinning tests are disallowed by the "disallowPinnedTests" plugin. Use the "--list-pinned" flag to list pinned tests'
      )
      assert.deepEqual(stack, [])
    })
  })

  test('use custom error message', async () => {
    const stack: string[] = []
    let fatalError: Error

    const emitter = new Emitter()
    const refiner = new Refiner()

    const suite = new Suite('same', emitter, refiner)
    createTest('pinned test', emitter, refiner, new Error(), { suite })
      .run(() => {
        stack.push('executing pinned test')
      })
      .pin()

    createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing passing test')
    })

    try {
      await runner()
        .configure({
          files: [],
          refiner,
          reporters: {
            activated: [],
            list: [],
          },
          plugins: [
            disallowPinnedTests({
              errorMessage: '{{test}} cannot be pinned',
            }),
          ],
        })
        .useEmitter(emitter)
        .runSuites(() => [suite])
    } catch (error) {
      fatalError = error
    }

    await wrapAssertions(async () => {
      assert.equal(fatalError.message, 'pinned test cannot be pinned')
      assert.deepEqual(stack, [])
    })
  })

  test('do not fail when disallow option is disabled', async () => {
    const stack: string[] = []
    let fatalError: Error

    const emitter = new Emitter()
    const refiner = new Refiner()

    const suite = new Suite('same', emitter, refiner)
    createTest('pinned test', emitter, refiner, new Error(), { suite })
      .run(() => {
        stack.push('executing pinned test')
      })
      .pin()

    createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing passing test')
    })

    try {
      await runner()
        .configure({
          files: [],
          refiner,
          reporters: {
            activated: [],
            list: [],
          },
          plugins: [
            disallowPinnedTests({
              disallow: false,
              errorMessage: '{{test}} cannot be pinned',
            }),
          ],
        })
        .useEmitter(emitter)
        .runSuites(() => [suite])
    } catch (error) {
      fatalError = error
    }

    await wrapAssertions(async () => {
      assert.isUndefined(fatalError)
      assert.deepEqual(stack, ['executing pinned test'])
    })
  })
})

test.describe('Automatic duration history and worker coordination', () => {
  async function fixture(context: NodeTestContext) {
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.automatic-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/package.json`, JSON.stringify({ private: true }))
    return {
      cwd,
      entry: fileURLToPath(new URL('../tests_helpers/automatic_worker.mjs', import.meta.url)),
      loader: import.meta.resolve('@poppinss/ts-exec'),
    }
  }
  async function serial(cwd: string, entry: string, loader: string, args: string[] = []) {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], { cwd })
  }
  async function json(file: string): Promise<unknown> {
    const { readFile } = await import('node:fs/promises')
    return JSON.parse(await readFile(file, 'utf8'))
  }

  test('learn and reload timings automatically, recover corrupt history, and avoid partial updates', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readHistory } = await import('../src/duration_history.js')
    const { readFile, writeFile } = await import('node:fs/promises')
    await serial(cwd, entry, loader)
    const history = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.lengthOf(Object.keys(history.durations), 6)
    const saved = await readFile(`${cwd}/history.json`, 'utf8')
    await serial(cwd, entry, loader, ['--tests=case 0'])
    assert.equal(await readFile(`${cwd}/history.json`, 'utf8'), saved)
    assert.containSubset(await json(`${cwd}/observed-serial.json`), {
      estimates: history.durations,
      executed: [0],
    })
    await writeFile(`${cwd}/history.json`, '{broken')
    await serial(cwd, entry, loader)
    const recovered = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.lengthOf(Object.keys(recovered.durations), 6)
  })

  test('merge failed tests from workers and rerun the same frozen failure selection', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const options = {
      command: process.execPath,
      args: [`--import=${loader}`, entry],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
    }
    const failed = await runParallel({ ...options, env: { TEST_FAIL: '1' } })
    assert.notEqual(failed.exitCode, 0)
    assert.isTrue(failed.historyUpdated)
    const cached = await getFailedTests(cwd)
    assert.deepEqual(cached.tests?.sort(), ['case 0', 'case 1'])
    const rerun = await runParallel({ ...options, args: [...options.args, '--failed'] })
    assert.equal(rerun.exitCode, 0)
    assert.isFalse(rerun.historyUpdated)
    const observed = await Promise.all([1, 2].map((id) => json(`${cwd}/observed-${id}.json`)))
    assert.containSubset(observed, [{ executed: [0] }, { executed: [1] }])
    const cleared = await getFailedTests(cwd)
    assert.deepEqual(cleared.tests, [])
  })

  test('assign shards, merge learned timings, and reuse one snapshot for every worker', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const { readHistory } = await import('../src/duration_history.js')
    const options = {
      command: process.execPath,
      args: [`--import=${loader}`, entry],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
    }
    const first = await runParallel(options)
    assert.equal(first.exitCode, 0)
    assert.isTrue(first.historyUpdated)
    const cold = await Promise.all([1, 2].map((id) => json(`${cwd}/observed-${id}.json`)))
    assert.containSubset(cold, [
      { executed: [0, 2, 4], estimates: {} },
      { executed: [1, 3, 5], estimates: {} },
    ])
    const history = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.lengthOf(Object.keys(history.durations), 6)
    const second = await runParallel(options)
    assert.equal(second.exitCode, 0)
    assert.isTrue(second.historyUpdated)
    const warm = (await Promise.all([1, 2].map((id) => json(`${cwd}/observed-${id}.json`)))) as {
      executed: number[]
      estimates: Record<string, number>
    }[]
    assert.deepEqual(warm[0].estimates, history.durations)
    assert.deepEqual(warm[1].estimates, history.durations)
    assert.deepEqual(
      warm.flatMap((row) => row.executed).sort((a, b) => a - b),
      [0, 1, 2, 3, 4, 5]
    )
    assert.notDeepEqual(
      warm.map((row) => row.executed),
      [
        [0, 2, 4],
        [1, 3, 5],
      ]
    )
  })

  test('apply title filtering after plugins mutate the filters', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    await serial(cwd, entry, loader, ['--prepare-caches'])
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)(
      process.execPath,
      [`--import=${loader}`, entry, '--agent', '--tests=case 3'],
      {
        cwd,
        env: {
          ...process.env,
          TEST_PLUGIN_FILTER: 'case 5',
          TEST_OBSERVED: `${cwd}/observed-serial.json`,
        },
      }
    )
    const observed = JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    assert.deepEqual(observed.executed, [5])
  })

  test('narrow imported files by title filter without changing the selection', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const run = async (args: string[], env: NodeJS.ProcessEnv = {}) => {
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      await promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], {
        cwd,
        env: { ...process.env, TEST_OBSERVED: `${cwd}/observed-serial.json`, ...env },
      }).catch(() => {})
      return JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    }

    // Build the index from a prepare run, then filter by title.
    await run(['--prepare-caches'])
    const filtered = await run(['--tests=case 3'])
    assert.deepEqual(filtered.executed, [3])
    assert.deepEqual(filtered.imported, ['file3.spec.ts'])

    // Disabling the index must select the same tests, importing every file.
    const unfiltered = await run(['--tests=case 3'], { JAPA_NO_SELECTION_INDEX: '1' })
    assert.deepEqual(unfiltered.executed, [3])
    assert.lengthOf(unfiltered.imported, 6)

    // A file that changed since indexing is always imported.
    await writeFile(`${cwd}/file5.spec.ts`, '// changed\n')
    const changed = await run(['--tests=case 3'])
    assert.deepEqual(changed.executed, [3])
    assert.sameMembers(changed.imported, ['file3.spec.ts', 'file5.spec.ts'])
  })

  test('learn passing files from a failing run and keep estimates of failing files', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const { readHistory, writeHistory } = await import('../src/duration_history.js')
    const stale = {
      'default:file0.spec.ts': 5000,
      'default:file1.spec.ts': 5000,
      'default:file2.spec.ts': 5000,
    }
    await writeHistory(`${cwd}/history.json`, { version: 1, cwd, durations: stale })
    const options = {
      command: process.execPath,
      args: [`--import=${loader}`, entry],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
    }
    const parallel = await runParallel({ ...options, env: { TEST_FAIL: '1' } })
    assert.notEqual(parallel.exitCode, 0)
    assert.isTrue(parallel.historyUpdated)
    const learned = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.equal(learned.durations['default:file0.spec.ts'], 5000)
    assert.equal(learned.durations['default:file1.spec.ts'], 5000)
    assert.isBelow(learned.durations['default:file2.spec.ts'], 5000)
    assert.isAbove(learned.durations['default:file2.spec.ts'], 0)
    assert.lengthOf(Object.keys(learned.durations), 6)

    await writeHistory(`${cwd}/history.json`, { version: 1, cwd, durations: stale })
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)(process.execPath, [`--import=${loader}`, entry], {
      cwd,
      env: { ...process.env, TEST_FAIL: '1' },
    }).catch(() => {})
    const serialLearned = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.equal(serialLearned.durations['default:file0.spec.ts'], 5000)
    assert.isBelow(serialLearned.durations['default:file2.spec.ts'], 5000)
  })

  test('leave the cache unchanged on hook failure and reject missing or tampered coordination', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const { readFile, readdir } = await import('node:fs/promises')
    await serial(cwd, entry, loader)
    const saved = await readFile(`${cwd}/history.json`, 'utf8')
    const options = {
      command: process.execPath,
      args: [`--import=${loader}`, entry],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
    }
    for (const env of [
      { TEST_HOOK_FAIL: '1' },
      { TEST_NO_HISTORY: '1' },
      { TEST_TAMPER: '1' },
      { TEST_DUPLICATE_OUTPUT: '1' },
    ]) {
      const result = await runParallel({ ...options, env })
      assert.notEqual(result.exitCode, 0)
      assert.isFalse(result.historyUpdated)
      assert.equal(await readFile(`${cwd}/history.json`, 'utf8'), saved)
      const names = await readdir(cwd)
      assert.deepEqual(
        names.filter((name) => name.startsWith('run-')),
        []
      )
    }
  })

  test('run only files affected by changed paths, and fall back when unsure', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const run = async (args: string[]) => {
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      await promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], {
        cwd,
        env: { ...process.env, TEST_OBSERVED: `${cwd}/observed-serial.json` },
      }).catch(() => {})
      return JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    }

    // Agent/full runs record dependencies for the next one.
    await run(['--agent'])
    const { dependencyFile } = await import('../src/cache_paths.js')
    const depsRaw = await readFile(dependencyFile(cwd), 'utf8').catch(() => 'MISSING')
    const deps = JSON.parse(depsRaw)
    assert.equal(Object.keys(deps.files).length, 6, depsRaw.slice(0, 400))

    // A changed test file selects itself.
    const changed = await run(['--changed=file1.spec.ts'])
    assert.deepEqual(changed.executed, [1])

    // A path nothing imports falls back to the full suite.
    const unknown = await run(['--changed=an/unseen/module.ts'])
    assert.deepEqual(
      unknown.executed.sort((a: number, b: number) => a - b),
      [0, 1, 2, 3, 4, 5]
    )
  })

  test('apply one changed-file selection to managed workers', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    await serial(cwd, entry, loader, ['--prepare-caches'])
    const { runParallel } = await import('../src/parallel.js')
    const result = await runParallel({
      command: process.execPath,
      args: [`--import=${loader}`, entry, '--changed=file0.spec.ts'],
      cwd,
      workers: 1,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
      env: { TEST_OBSERVED: `${cwd}/observed-serial.json` },
    })
    assert.equal(result.exitCode, 0)
    const observed = JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    assert.deepEqual(observed.executed, [0])
  })

  test('prepare ignores file filters and builds a complete dependency map', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)(
      process.execPath,
      [`--import=${loader}`, entry, '--prepare-caches', '--files=file0.spec.ts'],
      { cwd, env: { ...process.env, TEST_OBSERVED: `${cwd}/observed-serial.json` } }
    )
    const observed = JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    assert.lengthOf(observed.imported, 6)
    const { dependencyFile } = await import('../src/cache_paths.js')
    const map = JSON.parse(await readFile(dependencyFile(cwd), 'utf8'))
    assert.isTrue(map.complete)
    assert.lengthOf(Object.keys(map.files), 6)
  })

  test('prepare builds the caches without executing tests', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, readdir, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)(process.execPath, [`--import=${loader}`, entry, '--prepare-caches'], {
      cwd,
      env: { ...process.env, TEST_OBSERVED: `${cwd}/observed-serial.json` },
    })

    const observed = JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    assert.deepEqual(observed.executed, [])
    assert.lengthOf(observed.imported, 6)

    const cache = await readdir(`${cwd}/node_modules/.cache/japa`)
    const indexFiles = cache.filter((name) => name.startsWith('index-'))
    assert.lengthOf(indexFiles, 1)
    assert.equal(
      cache.some((name) => name.startsWith('dependencies-')),
      true
    )
    assert.isTrue(cache.some((name) => name.startsWith('dependencies-')))
  })

  test('--failed-new skips failures recorded in the baseline', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const run = async (args: string[], env: NodeJS.ProcessEnv = {}) => {
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      await promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], {
        cwd,
        env: { ...process.env, TEST_OBSERVED: `${cwd}/observed-serial.json`, ...env },
      }).catch(() => {})
      return JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    }

    // Populate the failed-test cache with the two fixture failures.
    await run([], { TEST_FAIL: '1' })
    await writeFile(
      `${cwd}/japa.baseline.json`,
      JSON.stringify({
        version: 1,
        failures: [
          { suite: 'default', file: 'file0.spec.ts', title: 'case 0' },
          { suite: 'default', file: 'file1.spec.ts', title: 'case 1' },
        ],
      })
    )

    const allFailures = await run(['--failed'], { TEST_FAIL: '1' })
    assert.deepEqual(allFailures.executed.sort(), [0, 1])

    const newOnly = await run(['--failed', '--failed-new'], { TEST_FAIL: '1' })
    assert.deepEqual(newOnly.executed, [])
  })

  test('write agent results to a file and reserve exit 2 for setup errors', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
      promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], {
        cwd,
        env: { ...process.env, ...env },
      }).then(
        (result) => ({ code: 0, stdout: result.stdout }),
        (error: { code?: number; stdout?: string }) => ({
          code: error.code ?? 1,
          stdout: error.stdout ?? '',
        })
      )

    const reported = await run(['--agent', '--agent-file=report.jsonl'], { TEST_FAIL: '1' })
    assert.equal(reported.code, 1)
    assert.equal(reported.stdout.includes('"event":"test"'), false)
    const raw = await readFile(`${cwd}/report.jsonl`, 'utf8')
    const lines = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    assert.equal(lines.at(-1).event, 'summary')
    assert.isAbove(lines.at(-1).selection.planned, 0)

    // An invalid shard fails during planning, which is an infrastructure error.
    const broken = await run(['--agent', '--shard=9/2'])
    assert.equal(broken.code, 2)
  })

  test('record source dependencies of an imported test file', async (context) => {
    const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
    const { pathToFileURL, fileURLToPath } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.deps-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/helper.mjs`, 'export const marker = 1\n')
    await writeFile(
      `${cwd}/thing.spec.mjs`,
      "import { marker } from './helper.mjs'\nexport default marker\n"
    )

    const { recordDependencies } = await import('../src/dependencies.js')
    const { dependencyFile } = await import('../src/cache_paths.js')
    const listeners = new Map<string, (payload?: unknown) => boolean | void>()
    const emitter = {
      on: (name: string, fn: (payload?: unknown) => boolean | void) => {
        listeners.set(name, fn)
        return () => listeners.delete(name)
      },
      once: (name: string, fn: (payload?: unknown) => boolean | void) => {
        listeners.set(name, fn)
      },
    }
    const config = {
      cwd,
      importer: async (url: URL) => {
        await import(url.href)
      },
    }
    await recordDependencies()({
      config,
      emitter,
    } as never)

    await config.importer(pathToFileURL(`${cwd}/thing.spec.mjs`))
    listeners.get('runner:end')?.()
    await new Promise((done) => setTimeout(done, 100))

    const map = JSON.parse(await readFile(dependencyFile(cwd), 'utf8'))
    assert.deepEqual(map.files['thing.spec.mjs'], ['helper.mjs', 'thing.spec.mjs'])
  })

  test('stop the walk at packages, record boot files, and add resolver files', async (context) => {
    const { mkdir, mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
    const { pathToFileURL, fileURLToPath } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.deps-boot-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await mkdir(`${cwd}/node_modules/framework`, { recursive: true })
    await writeFile(
      `${cwd}/node_modules/framework/index.mjs`,
      "import '../../routes.mjs'\nexport const app = 1\n"
    )
    await writeFile(`${cwd}/routes.mjs`, "import './service.mjs'\nexport default 1\n")
    await writeFile(`${cwd}/service.mjs`, 'export const service = 1\n')
    await writeFile(`${cwd}/controller.mjs`, "import './validator.mjs'\nexport default 1\n")
    await writeFile(`${cwd}/validator.mjs`, 'export default 1\n')
    await writeFile(
      `${cwd}/thing.spec.mjs`,
      "import { app } from './node_modules/framework/index.mjs'\nexport default app\n"
    )

    const { recordDependencies } = await import('../src/dependencies.js')
    const { dependencyFile } = await import('../src/cache_paths.js')
    const listeners = new Map<string, (payload?: unknown) => boolean | void>()
    const emitter = {
      on: (name: string, fn: (payload?: unknown) => boolean | void) => {
        listeners.set(name, fn)
        return () => listeners.delete(name)
      },
      once: (name: string, fn: (payload?: unknown) => boolean | void) => {
        listeners.set(name, fn)
      },
    }
    const config = {
      cwd,
      importer: async (url: URL) => {
        await import(url.href)
      },
      selection: { resolvers: [() => ['controller.mjs']], heuristic: true },
    }
    await recordDependencies()({ config, emitter } as never)
    // The framework boots, loading project code, before the first test file.
    await import(pathToFileURL(`${cwd}/node_modules/framework/index.mjs`).href)
    await config.importer(pathToFileURL(`${cwd}/thing.spec.mjs`))
    listeners.get('runner:end')?.()
    await new Promise((done) => setTimeout(done, 200))

    const map = JSON.parse(await readFile(dependencyFile(cwd), 'utf8'))
    assert.deepEqual(map.files['thing.spec.mjs'], [
      'controller.mjs',
      'thing.spec.mjs',
      'validator.mjs',
    ])
    assert.deepEqual(map.boot, ['routes.mjs', 'service.mjs'])
    assert.deepEqual(map.heuristic, [])
  })

  test("queue a second pool behind the first and take over a dead owner's lock", async (context) => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { withRunLock } = await import('../src/cache_lock.js')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.run-lock-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    const lock = `${cwd}/parallel.lock`
    const order: string[] = []
    const waited: number[] = []

    await writeFile(lock, String(process.pid))
    const queued = withRunLock(
      lock,
      async () => order.push('second'),
      (owner) => waited.push(owner)
    )
    await new Promise((done) => setTimeout(done, 300))
    order.push('first')
    await rm(lock)
    await queued
    assert.deepEqual(order, ['first', 'second'])
    assert.deepEqual(waited, [process.pid])

    // No live process has pid 2^22 - 1 on a test machine, so the lock is stale.
    await writeFile(lock, String(4_194_303))
    assert.equal(
      await withRunLock(
        lock,
        async () => 'taken',
        () => {}
      ),
      'taken'
    )
  })

  test('size an automatic pool by the planned test time', async () => {
    const { autoWorkerCount, estimateDurationMs } = await import('../src/parallel.js')
    const durations = {
      'unit:a.spec.ts': 4_000,
      'unit:b.spec.ts': 60_000,
      'functional:b.spec.ts': 6_000,
    }
    assert.equal(estimateDurationMs(durations, ['a.spec.ts']), 4_000)
    assert.equal(estimateDurationMs(durations, ['b.spec.ts']), 66_000)
    assert.equal(estimateDurationMs(durations), 70_000)
    assert.isUndefined(estimateDurationMs({}))
    assert.equal(autoWorkerCount(['--changed=auto'], 4_000), 1)
    assert.isAbove(autoWorkerCount([], 600_000), 1)
  })

  test('cap an automatic pool at JAPA_MAX_WORKERS', async (context) => {
    const { autoWorkerCount } = await import('../src/parallel.js')
    const previous = process.env.JAPA_MAX_WORKERS
    context.after(() => {
      if (previous === undefined) delete process.env.JAPA_MAX_WORKERS
      else process.env.JAPA_MAX_WORKERS = previous
    })
    process.env.JAPA_MAX_WORKERS = '2'
    assert.equal(autoWorkerCount([], 600_000), 2)
    assert.equal(autoWorkerCount([]), 2)
    assert.equal(autoWorkerCount(['--changed=auto'], 4_000), 1)
    process.env.JAPA_MAX_WORKERS = 'many'
    assert.throws(() => autoWorkerCount([], 600_000), /JAPA_MAX_WORKERS must be a positive integer/)
  })

  test('start pool workers at a lower priority', async (context) => {
    const { mkdtemp, readFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { runParallel } = await import('../src/parallel.js')
    const cwd = await mkdtemp(join(tmpdir(), 'japa-priority-'))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    const probe = [
      "const { getPriority } = require('node:os')",
      'const until = Date.now() + 2000',
      'while (getPriority() === 0 && Date.now() < until) {}',
      "require('node:fs').writeFileSync(`priority-${process.env.JAPA_WORKER_ID}`, String(getPriority()))",
    ].join(';')
    await runParallel({
      command: process.execPath,
      args: ['-e', probe, '--'],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore',
    })
    const priorities = await Promise.all(
      [1, 2].map((id) => readFile(join(cwd, `priority-${id}`), 'utf8'))
    )
    assert.deepEqual(priorities, ['10', '10'])
  })

  test('keep configured reporters under --agent-file, replace them under --agent', async (context) => {
    const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
    const { fileURLToPath, pathToFileURL } = await import('node:url')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.agent-file-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    const runnerEntry = pathToFileURL(fileURLToPath(new URL('../index.ts', import.meta.url))).href
    await writeFile(`${cwd}/one.spec.ts`, '')
    await writeFile(
      `${cwd}/entry.ts`,
      [
        `import { writeFileSync } from 'node:fs'`,
        `import { configure, processCLIArgs, run, test } from '${runnerEntry}'`,
        `processCLIArgs(process.argv.slice(2))`,
        `const marker = { name: 'marker', handler: (_runner, emitter) => {`,
        `  emitter.on('runner:end', () => writeFileSync('marker.txt', 'ran'))`,
        `} }`,
        `configure({ files: ['one.spec.ts'], reporters: { activated: ['marker'], list: [marker] },`,
        `  importer: async () => { test('passes', () => {}) } })`,
        `await run()`,
      ].join('\n')
    )
    const runWith = async (args: string[]) => {
      await rm(`${cwd}/marker.txt`, { force: true })
      await promisify(execFile)(
        process.execPath,
        ['--import=@poppinss/ts-exec', 'entry.ts', ...args],
        {
          cwd,
        }
      )
      return {
        marker: await readFile(`${cwd}/marker.txt`, 'utf8').catch(() => null),
        report: await readFile(`${cwd}/report.jsonl`, 'utf8').catch(() => ''),
      }
    }

    const toFile = await runWith(['--agent-file=report.jsonl'])
    assert.equal(toFile.marker, 'ran')
    assert.include(toFile.report, '"event":"summary"')

    const toStdout = await runWith(['--agent'])
    assert.isNull(toStdout.marker)
  })

  test('count only imports Node resolves when checking the graph', async () => {
    const { hasRuntimeRelativeImport } = await import('../src/dependencies.js')
    assert.isTrue(hasRuntimeRelativeImport("import { a } from './a.js'"))
    assert.isTrue(hasRuntimeRelativeImport("export { a } from '../a.js'"))
    assert.isTrue(hasRuntimeRelativeImport("import './side_effect.js'"))
    assert.isTrue(hasRuntimeRelativeImport("const m = await import('./lazy.js')"))
    assert.isTrue(hasRuntimeRelativeImport("const glob = 'tests/**/*.ts'\nimport('./later.js')"))
    assert.isFalse(hasRuntimeRelativeImport("import type { A } from './types.js'"))
    assert.isFalse(hasRuntimeRelativeImport("export type { A } from './types.js'"))
    assert.isFalse(hasRuntimeRelativeImport("/**\n * export { default } from './foo_job.js'\n */"))
    assert.isFalse(hasRuntimeRelativeImport("// import { a } from './a.js'"))
    // An alias import used only as a type is erased by TypeScript, so aliases do not count.
    assert.isFalse(hasRuntimeRelativeImport("import { a } from '#app/a'"))
  })

  test('select changed files by imports, widen on boot code, guess only when asked', async () => {
    const { selectChanged } = await import('../src/dependencies.js')
    const files = {
      'tests/lease.spec.ts': ['app/lease.ts', 'app/model.ts'],
      'tests/billing/invoice.spec.ts': ['app/model.ts'],
      'tests/modules/shop/cart.spec.ts': ['app/model.ts'],
    }
    const map = {
      version: 3 as const,
      complete: true,
      files,
      boot: ['config/app.ts'],
      bridged: [],
    }
    const reasonOf = (outcome: ReturnType<typeof selectChanged>) =>
      outcome.kind === 'full' ? outcome.reason : ''

    assert.include(reasonOf(selectChanged({ ...map, files: {} }, ['a.ts'])), '--prepare-caches')
    assert.include(
      reasonOf(selectChanged({ ...map, complete: false }, ['a.ts'])),
      'recordImportsFromStart()'
    )
    assert.include(reasonOf(selectChanged(map, [])), 'no changed paths')
    assert.deepEqual(selectChanged(map, ['app/lease.ts']), {
      kind: 'exact',
      files: ['tests/lease.spec.ts'],
    })
    assert.include(reasonOf(selectChanged(map, ['config/app.ts'])), 'loaded at boot')
    assert.include(reasonOf(selectChanged(map, ['app/controllers/cart.ts'])), 'resolver')

    const guessing = { ...map, heuristic: [{ from: 'app/modules/*/', to: 'tests/modules/*/' }] }
    assert.deepEqual(selectChanged(guessing, ['app/billing/invoice.ts']), {
      kind: 'heuristic',
      files: ['tests/billing/invoice.spec.ts'],
      guessed: ['app/billing/invoice.ts'],
    })
    assert.deepEqual(selectChanged(guessing, ['app/modules/shop/controllers/pay.ts']), {
      kind: 'heuristic',
      files: ['tests/modules/shop/cart.spec.ts'],
      guessed: ['app/modules/shop/controllers/pay.ts'],
    })
    // Boot code still runs everything, and so does a path no rule names.
    assert.equal(selectChanged(guessing, ['config/app.ts']).kind, 'full')
    assert.equal(selectChanged(guessing, ['app/unrelated.ts']).kind, 'full')
  })

  test('a test file the map has not recorded selects itself and is never dropped', async () => {
    const { selectChanged } = await import('../src/dependencies.js')
    const map = {
      version: 3 as const,
      complete: true,
      files: { 'tests/unit/lease.spec.ts': ['app/lease.ts'] },
      boot: [],
      bridged: [],
      heuristic: [],
    }
    const configured = ['tests/unit/lease.spec.ts', 'tests/functional/lease.spec.ts']

    // The name guess alone would pick only the recorded unit spec.
    assert.deepEqual(selectChanged(map, ['tests/functional/lease.spec.ts'], configured), {
      kind: 'exact',
      files: ['tests/functional/lease.spec.ts'],
    })
    assert.equal(selectChanged(map, ['tests/functional/lease.spec.ts']).kind, 'heuristic')
  })

  test('changed paths are relative to an app in a repository subdirectory', async (context) => {
    const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { execFileSync } = await import('node:child_process')
    const { gitChangedPaths } = await import('../src/dependencies.js')
    const repo = await mkdtemp(join(tmpdir(), 'japa-git-'))
    context.after(() => rm(repo, { recursive: true, force: true }))
    const app = join(repo, 'apps/web')
    await mkdir(join(app, 'app'), { recursive: true })
    await writeFile(join(app, 'app/lease.ts'), 'export {}\n')
    await writeFile(join(repo, 'root.json'), '{}\n')
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
    git('init', '-q')
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
    await writeFile(join(app, 'app/lease.ts'), 'export const a = 1\n')
    await writeFile(join(app, 'app/new.ts'), 'export {}\n')
    await writeFile(join(repo, 'root.json'), '{"a":1}\n')

    const changed = await gitChangedPaths(app)
    assert.deepEqual(changed.sort(), ['app/lease.ts', 'app/new.ts'])
  })

  test('without the configured files, unknown paths are pending instead of a full run', async () => {
    const { selectChanged } = await import('../src/dependencies.js')
    const map = {
      version: 3 as const,
      complete: true,
      files: { 'tests/unit/lease.spec.ts': ['app/lease.ts'] },
      boot: ['config/app.ts'],
      bridged: [],
    }
    assert.deepEqual(selectChanged(map, ['app/lease.ts', 'tests/unit/new.spec.ts'], 'unknown'), {
      kind: 'exact',
      files: ['tests/unit/lease.spec.ts'],
      pending: ['tests/unit/new.spec.ts'],
    })
    assert.equal(selectChanged(map, ['config/app.ts'], 'unknown').kind, 'full')
  })

  test('selection never omits a test that reaches a changed path', async () => {
    const { default: fc } = await import('fast-check')
    const { selectChanged } = await import('../src/dependencies.js')
    // Two specs share a name, so a guess by name can land on the wrong one.
    const tests = ['unit/a.spec.ts', 'functional/a.spec.ts', 'unit/b.spec.ts', 'unit/c.spec.ts']
    const sources = ['app/a.ts', 'app/b.ts', 'app/c.ts', 'config/app.ts', 'app/orphan.ts']
    const scenario = fc.record({
      recorded: fc.subarray(tests, { minLength: 1 }),
      dependencies: fc.dictionary(fc.constantFrom(...tests), fc.subarray(sources)),
      boot: fc.subarray(sources),
      bridged: fc.subarray(sources),
      changed: fc.subarray([...tests, ...sources], { minLength: 1 }),
      mapGuesses: fc.boolean(),
      guesses: fc.boolean(),
      global: fc.boolean(),
    })

    fc.assert(
      fc.property(scenario, (input) => {
        const { recorded, dependencies, boot, bridged, changed } = input
        const files = Object.fromEntries(recorded.map((file) => [file, dependencies[file] ?? []]))
        const map = {
          version: 3 as const,
          complete: true,
          files,
          boot,
          bridged,
          ...(input.mapGuesses ? { heuristic: [] } : {}),
        }
        const policy = {
          ...(input.guesses ? { heuristic: [] } : {}),
          ...(input.global ? { global: ['config/'] } : {}),
        }
        const outcome = selectChanged(map, changed, tests, policy)

        // Any test can depend on a global or package-loaded path.
        const anywhere = changed.some(
          (path) => bridged.includes(path) || (input.global && path.startsWith('config/'))
        )
        if (anywhere) assert.equal(outcome.kind, 'full')
        // The current config decides whether guessing is allowed, not the map.
        if (!input.guesses) assert.notEqual(outcome.kind, 'heuristic')
        if (outcome.kind === 'full') return

        const touched = new Set(changed)
        const expected = tests.filter((file) =>
          file in files
            ? [file, ...files[file]].some((path) => touched.has(path))
            : touched.has(file)
        )
        assert.includeMembers(outcome.files, expected)
        if (outcome.kind === 'exact') assert.sameMembers(outcome.files, expected)
      }),
      { numRuns: 2000 }
    )
  })

  test('--changed keeps every test file the map has not recorded', async (context) => {
    const { mkdtemp, mkdir, writeFile, rm, realpath } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const cwd = await realpath(
      await mkdtemp(fileURLToPath(new URL('../.deps-unrecorded-', import.meta.url)))
    )
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await mkdir(`${cwd}/tests`)
    for (const name of ['old', 'other', 'pulled']) {
      await writeFile(`${cwd}/tests/${name}.spec.ts`, '')
    }
    const map = {
      version: 3,
      complete: true,
      files: { 'tests/old.spec.ts': ['app/a.ts'], 'tests/other.spec.ts': ['app/b.ts'] },
      boot: [],
      bridged: [],
    }
    await writeFile(`${cwd}/deps.json`, JSON.stringify(map))

    const { changedSelection } = await import('../src/dependencies.js')
    const { Planner } = await import('../src/planner.js')
    const config = new ConfigManager({ cwd, files: ['tests/*.spec.ts'] }, {}).hydrate()
    await changedSelection({ file: 'deps.json' })({
      config,
      cliArgs: { changed: 'app/a.ts' },
    } as never)
    const { suites } = await new Planner(config).plan()

    assert.deepEqual(
      suites[0].filesURLs.map((url) => fileURLToPath(url).slice(cwd.length + 1)),
      ['tests/old.spec.ts', 'tests/pulled.spec.ts']
    )
  })

  test('warn when preparing caches cannot see imports made before configure', async (context) => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { fileURLToPath, pathToFileURL } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.deps-early-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/leaf.mjs`, 'export const leaf = 1\n')
    await writeFile(`${cwd}/booted.mjs`, "export { leaf } from './leaf.mjs'\n")
    await writeFile(
      `${cwd}/app.spec.mjs`,
      "import { leaf } from './booted.mjs'\nexport default leaf\n"
    )
    await import(pathToFileURL(`${cwd}/booted.mjs`).href)

    const { recordDependencies, flushDependencies } = await import('../src/dependencies.js')
    const warnings: string[] = []
    context.mock.method(console, 'error', (message: string) => warnings.push(String(message)))
    const listeners = new Map<string, () => void>()
    const emitter = { once: (name: string, fn: () => void) => listeners.set(name, fn) }
    const config = {
      cwd,
      importer: async (url: URL) => {
        await import(url.href)
      },
    }
    await recordDependencies()({ config, emitter, cliArgs: { prepareCaches: true } } as never)
    await config.importer(pathToFileURL(`${cwd}/app.spec.mjs`))
    await flushDependencies(emitter)

    assert.isTrue(
      warnings.some((line) => line.includes('recordImportsFromStart()')),
      warnings.join('\n')
    )
    assert.isTrue(
      warnings.some((line) => line.includes('booted.mjs')),
      warnings.join('\n')
    )
  })

  test('complete the map for modules an app loads before configure', async (context) => {
    const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
    const { fileURLToPath, pathToFileURL } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.deps-boot-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/leaf.mjs`, 'export const leaf = 1\n')
    await writeFile(`${cwd}/booted.mjs`, "export { leaf } from './leaf.mjs'\n")
    await writeFile(
      `${cwd}/app.spec.mjs`,
      "import { leaf } from './booted.mjs'\nexport default leaf\n"
    )

    const { recordImportsFromStart, recordDependencies } = await import('../src/dependencies.js')
    const { dependencyFile } = await import('../src/cache_paths.js')
    assert.isTrue(recordImportsFromStart())
    // The framework boots, and imports booted.mjs, before Japa is configured.
    await import(pathToFileURL(`${cwd}/booted.mjs`).href)

    const listeners = new Map<string, () => void>()
    const emitter = { once: (name: string, fn: () => void) => listeners.set(name, fn) }
    const config = {
      cwd,
      importer: async (url: URL) => {
        await import(url.href)
      },
    }
    await recordDependencies()({ config, emitter, cliArgs: { prepareCaches: true } } as never)
    await config.importer(pathToFileURL(`${cwd}/app.spec.mjs`))
    listeners.get('runner:end')?.()
    await new Promise((done) => setTimeout(done, 100))

    const map = JSON.parse(await readFile(dependencyFile(cwd), 'utf8'))
    assert.deepEqual(map.files['app.spec.mjs'], ['app.spec.mjs', 'booted.mjs', 'leaf.mjs'])
    assert.isTrue(map.complete)
  })

  test('a file a package loads after boot runs everything when it changes', async (context) => {
    const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises')
    const { fileURLToPath, pathToFileURL } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.deps-bridge-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await mkdir(`${cwd}/node_modules/helper`, { recursive: true })
    await writeFile(`${cwd}/shared.mjs`, 'export const shared = 1\n')
    await writeFile(
      `${cwd}/node_modules/helper/index.mjs`,
      "export { shared } from '../../shared.mjs'\n"
    )
    await writeFile(
      `${cwd}/via_package.spec.mjs`,
      "import { shared } from './node_modules/helper/index.mjs'\nexport default shared\n"
    )
    await writeFile(`${cwd}/direct.spec.mjs`, "export { shared } from './shared.mjs'\n")

    const { recordImportsFromStart, recordDependencies, selectChanged, readDependencyMap } =
      await import('../src/dependencies.js')
    const { dependencyFile } = await import('../src/cache_paths.js')
    assert.isTrue(recordImportsFromStart())
    const listeners = new Map<string, () => void>()
    const emitter = { once: (name: string, fn: () => void) => listeners.set(name, fn) }
    const config = {
      cwd,
      importer: async (url: URL) => {
        await import(url.href)
      },
    }
    await recordDependencies()({ config, emitter, cliArgs: { prepareCaches: true } } as never)
    await config.importer(pathToFileURL(`${cwd}/via_package.spec.mjs`))
    await config.importer(pathToFileURL(`${cwd}/direct.spec.mjs`))
    listeners.get('runner:end')?.()
    await new Promise((done) => setTimeout(done, 100))

    const map = await readDependencyMap(dependencyFile(cwd))
    assert.deepEqual(map.bridged, ['shared.mjs'])
    // Only direct.spec.mjs imports shared.mjs as far as the walk can tell.
    assert.equal(selectChanged(map, ['shared.mjs']).kind, 'full')
    assert.include(JSON.parse(await readFile(dependencyFile(cwd), 'utf8')).bridged, 'shared.mjs')
  })

  test('a resolver that throws revokes a complete map', async (context) => {
    const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    const { fileURLToPath, pathToFileURL } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.deps-resolver-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/a.spec.mjs`, 'export default 1\n')

    const { recordImportsFromStart, recordDependencies, readDependencyMap } =
      await import('../src/dependencies.js')
    const { dependencyFile } = await import('../src/cache_paths.js')
    await mkdir(dirname(dependencyFile(cwd)), { recursive: true })
    const previous = { version: 3, complete: true, files: {}, boot: [], bridged: [] }
    await writeFile(dependencyFile(cwd), JSON.stringify(previous))
    assert.isTrue(recordImportsFromStart())
    const warnings: string[] = []
    context.mock.method(console, 'error', (message: string) => warnings.push(String(message)))
    const listeners = new Map<string, () => void>()
    const emitter = { once: (name: string, fn: () => void) => listeners.set(name, fn) }
    const config = {
      cwd,
      selection: {
        resolvers: [
          () => {
            throw new Error('route table unavailable')
          },
        ],
      },
      importer: async (url: URL) => {
        await import(url.href)
      },
    }
    await recordDependencies()({ config, emitter, cliArgs: { prepareCaches: true } } as never)
    await config.importer(pathToFileURL(`${cwd}/a.spec.mjs`))
    listeners.get('runner:end')?.()
    await new Promise((done) => setTimeout(done, 100))

    const map = await readDependencyMap(dependencyFile(cwd))
    assert.isFalse(map.complete)
    assert.isTrue(warnings.some((line) => line.includes('route table unavailable')))
  })

  test('record a complete entry for every imported file, filtered or not', async (context) => {
    const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.index-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/file.spec.ts`, '')

    const { writeSelectionIndex } = await import('../src/selection_index.js')
    const { indexFile } = await import('../src/cache_paths.js')
    // Importing registers every test in the file, whatever the filter is.
    const registered = {
      suites: [
        {
          name: 'default',
          stack: [
            {
              title: 'group',
              tests: [
                {
                  options: {
                    title: 'the title',
                    tags: [],
                    meta: { fileName: `${cwd}/file.spec.ts`, group: { title: 'group' } },
                  },
                },
                {
                  options: {
                    title: 'the other title',
                    tags: [],
                    meta: { fileName: `${cwd}/file.spec.ts`, group: { title: 'group' } },
                  },
                },
              ],
            },
          ],
        },
      ],
    }
    await writeSelectionIndex(registered as never, cwd)
    const index = JSON.parse(await readFile(indexFile(cwd), 'utf8'))
    assert.deepEqual(index.files['file.spec.ts'].tests, ['the title', 'the other title'])
    assert.deepEqual(index.files['file.spec.ts'].groups, ['group'])
  })

  test('use tracked cache files instead of the default cache directory', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { access, readFile, readdir, rm, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const flags = ['--cache-dir=.japa']

    await promisify(execFile)(
      process.execPath,
      [`--import=${loader}`, entry, '--prepare-caches', ...flags],
      {
        cwd,
      }
    )
    const tracked = await readdir(`${cwd}/.japa`)
    assert.equal(
      tracked.some((name) => name.startsWith('index-')),
      true
    )
    assert.equal(
      tracked.some((name) => name.startsWith('dependencies-')),
      true
    )
    // Preparing caches must not run application setup hooks.
    const setupRanDuringPrepare = await access(`${cwd}/setup-ran.json`).then(
      () => true,
      () => false
    )
    assert.isFalse(setupRanDuringPrepare)
    const defaultCache = await readdir(`${cwd}/node_modules/.cache/japa`).catch(() => [])
    assert.equal(
      defaultCache.some((name) => name.startsWith('index-') || name.startsWith('dependencies-')),
      false
    )

    // Removing the default cache must not lose selection: the tracked files are used.
    await rm(`${cwd}/node_modules/.cache/japa`, { recursive: true, force: true })
    await promisify(execFile)(
      process.execPath,
      [
        `--import=${loader}`,
        entry,
        '--tests=case 3',
        ...flags,
        '--agent',
        '--agent-file=report.jsonl',
      ],
      {
        cwd,
        env: {
          ...process.env,
          JAPA_AGENT_ALL: '1',
          TEST_OBSERVED: `${cwd}/observed-serial.json`,
        },
      }
    )
    await access(`${cwd}/setup-ran.json`)
    const observed = JSON.parse(await readFile(`${cwd}/observed-serial.json`, 'utf8'))
    assert.deepEqual(observed.executed, [3])
    const report = await readFile(`${cwd}/report.jsonl`, 'utf8')
    const summary = report
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .at(-1)
    assert.equal(summary.selection.skipped, 5)

    // The same filter without the index must select the same test.
    await promisify(execFile)(
      process.execPath,
      [
        `--import=${loader}`,
        entry,
        '--tests=case 3',
        ...flags,
        '--agent',
        '--agent-file=noindex.jsonl',
      ],
      {
        cwd,
        env: {
          ...process.env,
          JAPA_NO_SELECTION_INDEX: '1',
          JAPA_AGENT_ALL: '1',
          TEST_OBSERVED: `${cwd}/observed-noindex.json`,
        },
      }
    )
    const noIndex = JSON.parse(await readFile(`${cwd}/observed-noindex.json`, 'utf8'))
    assert.deepEqual(noIndex.executed, observed.executed)
  })

  test('japa-agent prepares caches and runs through the agent reporter', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, readdir, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const { fileURLToPath } = await import('node:url')

    const wrapper = fileURLToPath(new URL('../bin/agent.ts', import.meta.url))
    const result = await promisify(execFile)(
      process.execPath,
      [
        `--import=${loader}`,
        wrapper,
        '--cwd',
        cwd,
        '--out',
        'report.jsonl',
        '--cache-dir',
        '.japa',
        '--',
        process.execPath,
        `--import=${loader}`,
        entry,
      ],
      { cwd }
    ).then(
      (value) => ({ code: 0, stderr: value.stderr }),
      (error: { code?: number; stderr?: string }) => ({
        code: error.code ?? 1,
        stderr: error.stderr,
      })
    )
    assert.equal(result.code, 0, result.stderr)

    const raw = await readFile(`${cwd}/report.jsonl`, 'utf8')
    const lines = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    assert.equal(lines.at(-1).event, 'summary')
    assert.equal(lines.at(-1).ok, true)
    // No git repository, so --changed=auto falls back to everything.
    assert.equal(lines.at(-1).selection.fallback, true)

    // The wrapper must honour --cache-dir for caches and metrics.
    const cache = await readdir(`${cwd}/.japa`)
    assert.equal(
      cache.some((name) => name.startsWith('index-')),
      true
    )
    assert.equal(
      cache.some((name) => name.startsWith('dependencies-')),
      true
    )
    assert.equal(cache.includes('agent-metrics.jsonl'), true)
  })

  test('the japa-agent digest names new failures with their message and line', async () => {
    const { formatDigest, parseAgentReport } = await import('../src/agent_delta.js')
    const lines = [
      {
        event: 'test',
        status: 'failed',
        file: 'a.spec.ts',
        group: 'g',
        title: 'old',
        errors: [{ message: 'known one' }],
      },
      {
        event: 'test',
        status: 'failed',
        file: 'b.spec.ts',
        group: 'g',
        title: 'fresh',
        errors: [{ message: 'expected 1 to equal 2', location: { file: 'b.spec.ts', line: 7 } }],
      },
      {
        event: 'summary',
        total: 10,
        failed: 2,
        selection: { mode: 'changed', planned: 2, skipped: 8 },
        baseline: {
          known: 1,
          new: 1,
          fixed: 0,
          newFailures: [{ file: 'b.spec.ts', title: 'fresh' }],
        },
      },
    ]
    const report = parseAgentReport(lines.map((line) => JSON.stringify(line)).join('\n'))
    const digest = formatDigest({
      report,
      exit: 1,
      runMs: 1500,
      reportPath: 'r.jsonl',
      logPath: 'r.log',
    })
    assert.include(digest, 'FAILED exit=1 · 10 tests, 2 failed (1 new, 1 known) · 1.5s')
    assert.include(digest, 'selection changed: 2 of 10 test files')
    assert.include(digest, 'b.spec.ts:7  g › fresh\n    expected 1 to equal 2')
    assert.notInclude(digest, 'known one')

    const crashed = formatDigest({
      report: undefined,
      exit: 2,
      runMs: 10,
      reportPath: 'r.jsonl',
      logTail: 'Error: boom',
    })
    assert.include(crashed, 'wrote no summary')
    assert.include(crashed, 'Error: boom')
  })

  test('japa-agent keeps the command output in a log and prints a digest', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile } = await import('node:fs/promises')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const { fileURLToPath } = await import('node:url')
    const wrapper = fileURLToPath(new URL('../bin/agent.ts', import.meta.url))
    const result = await promisify(execFile)(
      process.execPath,
      [
        `--import=${loader}`,
        wrapper,
        '--no-prepare',
        '--full',
        '--workers=1',
        '--out',
        'report.jsonl',
        '--',
        process.execPath,
        `--import=${loader}`,
        entry,
      ],
      // The fixture prints nothing itself; debug lines give the log something to hold.
      { cwd, env: { ...process.env, TEST_FAIL: '1', NODE_DEBUG: 'japa:runner' } }
    ).then(
      (value) => ({ stdout: value.stdout, stderr: value.stderr }),
      (error: { stdout?: string; stderr?: string }) => ({
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? '',
      })
    )
    assert.equal(result.stdout, '')
    assert.include(result.stderr, 'japa-agent: FAILED')
    assert.include(result.stderr, 'log=report.log')
    const log = await readFile(`${cwd}/report.log`, 'utf8')
    assert.isAbove(log.length, 0)
  })

  test('never write a baseline from a partial serial selection', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = (args: string[]) =>
      promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], {
        cwd,
        env: { ...process.env, TEST_FAIL: '1' },
      }).catch(() => {})

    await run(['--update-baseline'])
    const full = JSON.parse(await readFile(`${cwd}/japa.baseline.json`, 'utf8'))
    assert.equal(full.failures.length, 2)

    // A title filter is a slice of the suite and must not replace the baseline.
    await run(['--update-baseline', '--tests=case 0'])
    const after = JSON.parse(await readFile(`${cwd}/japa.baseline.json`, 'utf8'))
    assert.deepEqual(after, full)
  })

  test('never write a baseline when global teardown fails', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { access, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const result = await promisify(execFile)(
      process.execPath,
      [`--import=${loader}`, entry, '--update-baseline'],
      {
        cwd,
        env: {
          ...process.env,
          TEST_FAIL: '1',
          TEST_GLOBAL_TEARDOWN_FAIL: '1',
        },
      }
    ).then(
      () => ({ code: 0 }),
      (error: { code?: number }) => ({ code: error.code })
    )
    assert.notEqual(result.code, 0)
    const exists = await access(`${cwd}/japa.baseline.json`).then(
      () => true,
      () => false
    )
    assert.isFalse(exists)
  })

  test('merge baseline failures once in the coordinator, not per worker', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile } = await import('node:fs/promises')
    const { runParallel } = await import('../src/parallel.js')
    const options = {
      command: process.execPath,
      args: [`--import=${loader}`, entry, '--update-baseline'],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
      updateBaseline: true,
    }
    const result = await runParallel({ ...options, env: { TEST_FAIL: '1' } })
    assert.notEqual(result.exitCode, 0)
    assert.isTrue(result.baselineUpdated)

    const baseline = JSON.parse(await readFile(`${cwd}/japa.baseline.json`, 'utf8'))
    assert.deepEqual(baseline.failures.map((failure: { file: string }) => failure.file).sort(), [
      'file0.spec.ts',
      'file1.spec.ts',
    ])

    // A partial selection must not replace the baseline with a slice.
    const { rm } = await import('node:fs/promises')
    await rm(`${cwd}/japa.baseline.json`)
    const partial = await runParallel({
      ...options,
      args: [...options.args, '--tests=case 0'],
      env: { TEST_FAIL: '1' },
    })
    assert.isFalse(partial.baselineUpdated)

    const changed = await runParallel({
      ...options,
      args: [...options.args, '--changed=file0.spec.ts'],
      env: { TEST_FAIL: '1' },
    })
    assert.isFalse(changed.baselineUpdated)
  })

  test('parallel --changed keeps unrecorded specs and honours the current policy', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    const { dependencyFile } = await import('../src/cache_paths.js')
    const { runParallel } = await import('../src/parallel.js')
    const files = Object.fromEntries(
      [0, 1, 2, 3, 4].map((i) => [`file${i}.spec.ts`, i === 0 ? ['app/a.ts'] : []])
    )
    const map = { version: 3, complete: true, files, boot: [], bridged: [] }
    await mkdir(dirname(dependencyFile(cwd)), { recursive: true })
    await writeFile(dependencyFile(cwd), JSON.stringify(map))
    const options = {
      command: process.execPath,
      args: [`--import=${loader}`, entry, '--changed=app/a.ts'],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
    }
    const imported = async () => {
      const rows = (await Promise.all([1, 2].map((id) => json(`${cwd}/observed-${id}.json`)))) as {
        imported: string[]
      }[]
      return rows.flatMap((row) => row.imported).sort()
    }

    const narrowed = await runParallel(options)
    assert.equal(narrowed.exitCode, 0)
    // file5 is not in the map, so nothing can rule it out.
    assert.deepEqual(await imported(), ['file0.spec.ts', 'file5.spec.ts'])

    // Prepared with guessing on; this config has it off, so the workers run everything.
    await writeFile(dependencyFile(cwd), JSON.stringify({ ...map, heuristic: [] }))
    const widened = await runParallel(options)
    assert.equal(widened.exitCode, 0)
    assert.lengthOf(await imported(), 6)
  })

  test('parallel --changed runs a new spec alone and settles other unknown paths in workers', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { mkdir, readFile, writeFile } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    const { dependencyFile } = await import('../src/cache_paths.js')
    const { runParallel } = await import('../src/parallel.js')
    const files = Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`file${i}.spec.ts`, []]))
    const map = { version: 3, complete: true, files, boot: [], bridged: [] }
    await mkdir(dirname(dependencyFile(cwd)), { recursive: true })
    await writeFile(dependencyFile(cwd), JSON.stringify(map))
    const run = (changed: string) =>
      runParallel({
        command: process.execPath,
        args: [`--import=${loader}`, entry, `--changed=${changed}`, '--agent-file=report.jsonl'],
        cwd,
        workers: 2,
        historyFile: 'history.json',
        stdio: 'ignore',
      })
    const imported = async () => {
      const rows = (await Promise.all([1, 2].map((id) => json(`${cwd}/observed-${id}.json`)))) as {
        imported: string[]
      }[]
      return rows.flatMap((row) => row.imported).sort()
    }

    const newSpec = await run('file5.spec.ts')
    assert.equal(newSpec.exitCode, 0)
    assert.deepEqual(await imported(), ['file5.spec.ts'])

    const orphan = await run('app/orphan.ts')
    assert.equal(orphan.exitCode, 0)
    assert.lengthOf(await imported(), 6)
    const report = await readFile(`${cwd}/report.jsonl`, 'utf8')
    const summary = JSON.parse(report.trim().split('\n').at(-1)!)
    assert.include(summary.selection.fallbackReason, 'app/orphan.ts')
  })

  test('an unhandled rejection in global setup fails the run', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const serialRun = await serial(cwd, entry, loader).then(
      () => 0,
      (error: { code?: number }) => error.code
    )
    assert.equal(serialRun, 0)
    const env = { ...process.env, TEST_SETUP_UNHANDLED: '1' }
    const failedSerial = await (async () => {
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      return promisify(execFile)(process.execPath, [`--import=${loader}`, entry], { cwd, env })
        .then(() => 0)
        .catch((error: { code?: number }) => error.code)
    })()
    assert.notEqual(failedSerial, 0)

    const result = await runParallel({
      command: process.execPath,
      args: [`--import=${loader}`, entry, '--update-baseline'],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
      updateBaseline: true,
      env: { TEST_SETUP_UNHANDLED: '1' },
    })
    assert.notEqual(result.exitCode, 0)
    assert.isFalse(result.historyUpdated)
    assert.isFalse(result.baselineUpdated)
  })

  test('japa-agent on a pool still updates the baseline', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const { access } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const wrapper = fileURLToPath(new URL('../bin/agent.ts', import.meta.url))
    await promisify(execFile)(
      process.execPath,
      [
        '--import=@poppinss/ts-exec',
        wrapper,
        '--no-prepare',
        '--full',
        '--workers=2',
        '--',
        process.execPath,
        `--import=${loader}`,
        entry,
        '--update-baseline',
      ],
      { cwd, env: { ...process.env, TEST_FAIL: '1' } }
    ).catch(() => {})
    await access(`${cwd}/japa.baseline.json`)
  })

  test('auto worker count prices only the named suites', async (context) => {
    const { cwd } = await fixture(context)
    const { writeFile, realpath } = await import('node:fs/promises')
    const { availableParallelism } = await import('node:os')
    const { plannedWorkerCount } = await import('../src/parallel.js')
    const durations = { 'unit:a.spec.ts': 1_000, 'functional:b.spec.ts': 200_000 }
    const history = { version: 1, cwd: await realpath(cwd), durations }
    await writeFile(`${cwd}/history.json`, JSON.stringify(history))
    const count = (args: string[]) => plannedWorkerCount({ args, cwd, historyFile: 'history.json' })

    assert.equal(await count(['bin/test.ts', 'unit']), 1)
    assert.equal(await count(['bin/test.ts']), Math.max(1, Math.min(8, availableParallelism() - 2)))
  })

  test('a merged summary is ok only when every worker reported and passed', async (context) => {
    const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { mergeAgentReports } = await import('../src/parallel.js')
    const dir = await mkdtemp(fileURLToPath(new URL('../.merge-', import.meta.url)))
    context.after(() => rm(dir, { recursive: true, force: true }))
    const summary = (fields: Record<string, unknown>) =>
      `${JSON.stringify({ event: 'summary', total: 1, passed: 1, failed: 0, ...fields })}\n`
    const merged = async (reports: string[], workers: { exitCode: number; error?: string }[]) => {
      const files = await Promise.all(
        reports.map(async (text, index) => {
          const file = `${dir}/agent-${index}.jsonl`
          await writeFile(file, text)
          return file
        })
      )
      await mergeAgentReports(files, `${dir}/merged.jsonl`, undefined, workers)
      const text = await readFile(`${dir}/merged.jsonl`, 'utf8')
      return JSON.parse(text.trim())
    }
    const fine = { exitCode: 0 }

    const dead = await merged([summary({ ok: true }), ''], [fine, { exitCode: 1, error: 'died' }])
    assert.isFalse(dead.ok)
    assert.isTrue(dead.processError)
    assert.equal(dead.missingSummaries, 1)

    const crashed = await merged(
      [summary({ ok: true }), summary({ ok: true, processError: true })],
      [fine, fine]
    )
    assert.isTrue(crashed.processError)

    const known = await merged(
      [summary({ ok: false, knownOnly: true }), summary({ ok: true })],
      [{ exitCode: 0 }, fine]
    )
    assert.isTrue(known.knownOnly)
    const real = await merged(
      [summary({ ok: false }), summary({ ok: true })],
      [{ exitCode: 1 }, fine]
    )
    assert.notProperty(real, 'knownOnly')
  })

  test('reject a parallel baseline update when a worker has a process error', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { runParallel } = await import('../src/parallel.js')
    const result = await runParallel({
      command: process.execPath,
      args: [`--import=${loader}`, entry, '--update-baseline'],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
      updateBaseline: true,
      env: { TEST_FAIL: '1', TEST_LATE_UNHANDLED: '1' },
    })
    assert.notEqual(result.exitCode, 0)
    assert.isFalse(result.baselineUpdated)
  })

  test('merge agent reports from parallel workers', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { readFile, writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { runParallel } = await import('../src/parallel.js')
    const result = await runParallel({
      command: process.execPath,
      args: [`--import=${loader}`, entry, '--agent-file=agent.jsonl'],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore' as const,
      env: { TEST_FAIL: '1' },
    })
    assert.notEqual(result.exitCode, 0)
    const report = await readFile(`${cwd}/agent.jsonl`, 'utf8')
    const lines = report
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    assert.lengthOf(
      lines.filter((line) => line.event === 'test' && line.status === 'failed'),
      2
    )
    assert.equal(lines.at(-1).event, 'summary')
    assert.equal(lines.at(-1).total, 6)
    assert.equal(lines.at(-1).failed, 2)
  })

  test('do not let known failures suppress a late unhandled rejection', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { writeFile } = await import('node:fs/promises')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = (env: NodeJS.ProcessEnv, args: string[] = []) =>
      promisify(execFile)(process.execPath, [`--import=${loader}`, entry, ...args], {
        cwd,
        env: { ...process.env, ...env },
      }).then(
        () => 0,
        (error: { code?: number }) => error.code ?? 1
      )
    await run({ TEST_FAIL: '1' }, ['--update-baseline'])
    assert.notEqual(
      await run({ TEST_FAIL: '1', TEST_LATE_UNHANDLED: '1' }, [
        '--allow-known-failures',
        '--agent',
      ]),
      0
    )
  })

  test('compare failures against a baseline and report agent-readable results', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { writeFile, readFile } = await import('node:fs/promises')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    for (let index = 0; index < 6; index++) await writeFile(`${cwd}/file${index}.spec.ts`, '')
    const run = async (
      args: string[],
      env: NodeJS.ProcessEnv = {}
    ): Promise<{ code: number; stdout: string }> => {
      try {
        const result = await promisify(execFile)(
          process.execPath,
          [`--import=${loader}`, entry, ...args],
          {
            cwd,
            env: { ...process.env, TEST_OBSERVED: `${cwd}/observed-serial.json`, ...env },
          }
        )
        return { code: 0, stdout: result.stdout }
      } catch (error) {
        const failed = error as { code?: number; stdout?: string }
        return { code: failed.code ?? 1, stdout: failed.stdout ?? '' }
      }
    }

    // No baseline: the failing run stays red.
    const red = await run(['--agent'], { TEST_FAIL: '1' })
    assert.equal(red.code, 1)
    const lines = String(red.stdout)
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    const failed = lines.filter((line) => line.event === 'test' && line.status === 'failed')
    assert.lengthOf(failed, 2)
    assert.include(failed[0].file, 'file0.spec.ts')
    assert.match(failed[0].errors[0].message, /Expected fixture failure/)
    assert.deepEqual(lines.at(-1).event, 'summary')
    assert.equal(lines.at(-1).ok, false)

    // A pathological error is clipped without turning the JSON line invalid.
    const long = await run(['--agent'], { TEST_LONG_ERROR: '1' })
    assert.equal(long.code, 1)
    const longLines = String(long.stdout).trim().split('\n')
    for (const line of longLines) {
      assert.isAtMost(line.length, 4000)
      assert.doesNotThrow(() => JSON.parse(line))
    }

    // Record those failures, then the same run is accepted as known.
    await run(['--update-baseline'], { TEST_FAIL: '1' })
    const baseline = JSON.parse(await readFile(`${cwd}/japa.baseline.json`, 'utf8'))
    assert.equal(baseline.failures.length, 2)
    assert.equal(baseline.failures[0].file, 'file0.spec.ts')

    const known = await run(['--allow-known-failures'], { TEST_FAIL: '1' })
    assert.equal(known.code, 0)

    // A setup/hook error is not a known test failure and must stay red.
    const hook = await run(['--allow-known-failures'], { TEST_FAIL: '1', TEST_HOOK_FAIL: '1' })
    assert.equal(hook.code, 1)

    // A test that fails for a different reason has a different identity, so it
    // is a regression even though the title matches nothing in the baseline.
    await writeFile(`${cwd}/japa.baseline.json`, JSON.stringify({ version: 1, failures: [] }))
    const different = await run(['--allow-known-failures'], { TEST_FAIL: '1' })
    assert.equal(different.code, 1)
  })

  test('propagate spawn errors and cancellation without leaving workers running', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const { readFile } = await import('node:fs/promises')
    const failed = await runParallel({
      command: `${cwd}/missing-command`,
      cwd,
      workers: 1,
      stdio: 'ignore',
    })
    assert.equal(failed.exitCode, 1)
    const controller = new AbortController()
    const pending = runParallel({
      command: process.execPath,
      args: [`--import=${loader}`, entry],
      cwd,
      workers: 1,
      historyFile: 'history.json',
      stdio: 'ignore',
      signal: controller.signal,
      env: { TEST_HANG: '1' },
    })
    let pid: number | undefined
    for (let attempt = 0; attempt < 500; attempt++) {
      try {
        pid = (JSON.parse(await readFile(`${cwd}/started-1.json`, 'utf8')) as { pid: number }).pid
        break
      } catch {
        await new Promise((done) => setTimeout(done, 10))
      }
    }
    controller.abort()
    const stopped = await pending
    assert.isDefined(pid)
    assert.equal(stopped.exitCode, 130)
    assert.throws(() => process.kill(pid!, 0))
  })

  test('keep the planning snapshot stable when another run updates the cache', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    const { readHistory, writeHistory } = await import('../src/duration_history.js')
    const { readFile, writeFile } = await import('node:fs/promises')
    await serial(cwd, entry, loader)
    const history = await readHistory(`${cwd}/history.json`, cwd, true)
    const saved = await readFile(`${cwd}/history.json`, 'utf8')
    const controller = new AbortController()
    const pending = runParallel({
      command: process.execPath,
      args: [`--import=${loader}`, entry],
      cwd,
      workers: 2,
      historyFile: 'history.json',
      stdio: 'ignore',
      signal: controller.signal,
      workerEnv: (id) => (id === 2 ? { TEST_START_GATE: 'release-worker-2' } : {}),
    })
    context.after(async () => {
      controller.abort()
      await pending
    })
    let finishedFirst = false
    for (let attempt = 0; attempt < 500; attempt++) {
      try {
        await readFile(`${cwd}/observed-1.json`, 'utf8')
        finishedFirst = true
        break
      } catch {
        await new Promise((done) => setTimeout(done, 10))
      }
    }
    assert.isTrue(finishedFirst)
    assert.equal(await readFile(`${cwd}/history.json`, 'utf8'), saved)
    await writeHistory(`${cwd}/history.json`, {
      ...history,
      durations: { 'default:future.spec.ts': 9999 },
    })
    await writeFile(`${cwd}/release-worker-2`, '')
    const result = await pending
    assert.equal(result.exitCode, 0)
    const second = (await json(`${cwd}/observed-2.json`)) as { estimates: Record<string, number> }
    assert.deepEqual(second.estimates, history.durations)
    const merged = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.equal(merged.durations['default:future.spec.ts'], 9999)
    assert.lengthOf(Object.keys(merged.durations), 7)
  })

  test('validate coordinator options and run the CLI without handwritten shard arguments', async (context) => {
    const { cwd, entry, loader } = await fixture(context)
    const { runParallel } = await import('../src/parallel.js')
    for (const workers of [0, -1, 1.5, 257]) {
      await rejects(runParallel({ command: process.execPath, cwd, workers }), /workers/)
    }
    await rejects(
      runParallel({ command: process.execPath, args: ['--shard=1/2'], cwd }),
      /automatically/
    )
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const { fileURLToPath } = await import('node:url')
    const cli = fileURLToPath(new URL('../bin/parallel.ts', import.meta.url))
    const result = await promisify(execFile)(
      process.execPath,
      [
        `--import=${loader}`,
        cli,
        '--workers',
        '2',
        '--history=history.json',
        `--cwd=${cwd}`,
        '--',
        process.execPath,
        `--import=${loader}`,
        entry,
      ],
      { env: { ...process.env, TEST_NO_PLUGIN: '1' } }
    )
    assert.include(result.stdout, 'workers=2 exit=0 timings=updated')
    const { readHistory } = await import('../src/duration_history.js')
    const history = await readHistory(`${cwd}/history.json`, cwd, true)
    assert.lengthOf(Object.keys(history.durations), 6)
  })
})

test.describe('Agent loop safety', () => {
  test('a run lock wait can be cancelled, and an ownerless lock is recovered', async (context) => {
    const { mkdtemp, writeFile, utimes, rm } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { withRunLock } = await import('../src/cache_lock.js')
    const dir = await mkdtemp(fileURLToPath(new URL('../.run-lock-', import.meta.url)))
    context.after(() => rm(dir, { recursive: true, force: true }))
    const lock = `${dir}/parallel.lock`

    // Held by a live process: this one.
    await writeFile(lock, String(process.pid))
    const controller = new AbortController()
    setTimeout(() => controller.abort(new Error('cancelled')), 50)
    await rejects(
      withRunLock(
        lock,
        async () => 'ran',
        () => {},
        controller.signal
      ),
      /cancelled/
    )

    // Created, then the owner died before writing its pid.
    await writeFile(lock, '')
    const old = new Date(Date.now() - 60_000)
    await utimes(lock, old, old)
    assert.equal(
      await withRunLock(
        lock,
        async () => 'ran',
        () => {}
      ),
      'ran'
    )
  })

  test('the selection signature changes with the title filter', async () => {
    const { getSelectionStats } = await import('../src/planning_state.js')
    const { Planner } = await import('../src/planner.js')
    const signature = async (tests: string[]) => {
      const config = new ConfigManager({ files: ['tests/core.spec.ts'] }, {}).hydrate()
      config.filters.tests = tests
      await new Planner(config).plan()
      return getSelectionStats(config)?.signature
    }
    assert.notEqual(await signature(['a']), await signature(['b']))
    assert.equal(await signature(['a']), await signature(['a']))
  })

  test('--failed-new keeps a title another file also fails under', async (context) => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { cacheFailedTests } = await import('../src/plugins/retry_cache.js')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.failed-new-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    await writeFile(`${cwd}/package.json`, '{"private":true}')
    const baseline = {
      version: 2,
      failures: [{ suite: 'unit', file: 'a.spec.ts', title: 'same' }],
    }
    await writeFile(`${cwd}/japa.baseline.json`, JSON.stringify(baseline))
    const filtered = async (failures: { file: string; title: string }[]) => {
      await cacheFailedTests(['same'], cwd, failures)
      const config = { cwd, teardown: [], filters: {} as { tests?: string[] } }
      const emitter = { on: () => {} }
      await retryPlugin({ config, emitter, cliArgs: { failed: true, failedNew: true } } as never)
      return config.filters.tests
    }

    assert.deepEqual(
      await filtered([
        { file: 'a.spec.ts', title: 'same' },
        { file: 'b.spec.ts', title: 'same' },
      ]),
      ['same']
    )
    assert.isUndefined(await filtered([{ file: 'a.spec.ts', title: 'same' }]))
  })

  test('never prune files for a negated tag filter', async () => {
    const { shouldSkipFile } = await import('../src/selection_index.js')
    const entry = { mtimeMs: 0, size: 0, tests: [], groups: [], tags: ['@github'] }
    assert.isFalse(shouldSkipFile(entry, { tags: ['~@github'] }))
    assert.isFalse(shouldSkipFile(entry, { tags: ['!slow'] }))
    assert.isTrue(shouldSkipFile(entry, { tags: ['@unit'] }))
  })

  test('treat a missing current summary as a non-comparable delta', async () => {
    const { diffReports } = await import('../src/agent_delta.js')
    const delta = diffReports({ summary: { total: 1 }, failures: [] }, { failures: [] })
    assert.isFalse(delta.comparable)
    assert.deepEqual(delta.counts, { previous: 0, current: 0, new: 0, fixed: 0 })
  })

  test('do not report fixed failures from a partial selection', async () => {
    const { diffFailures } = await import('../src/failure_baseline.js')
    const baseline = {
      version: 1 as const,
      failures: [
        { suite: 'default', file: 'a.spec.ts', title: 'a' },
        { suite: 'default', file: 'b.spec.ts', title: 'b' },
      ],
    }
    const observed = [baseline.failures[0]]
    assert.lengthOf(diffFailures(baseline, observed, { fullRun: false }).fixed, 0)
    assert.lengthOf(diffFailures(baseline, observed).fixed, 1)
  })

  test('treat file and failed filters as narrow selections', async () => {
    const { autoWorkerCount } = await import('../src/parallel.js')
    assert.equal(autoWorkerCount(['--files=user']), 1)
    assert.equal(autoWorkerCount(['--failed']), 1)
  })

  test('update and compare a baseline only within the suites that ran', async () => {
    const { diffFailures, mergeBaseline, plannedSuites } =
      await import('../src/failure_baseline.js')
    const unit = { suite: 'unit', file: 'a.spec.ts', title: 'a', consecutive: 2, updatedAt: 'x' }
    const browser = {
      suite: 'browser',
      file: 'b.spec.ts',
      title: 'b',
      consecutive: 3,
      updatedAt: 'x',
    }
    const previous = { version: 2 as const, failures: [unit, browser] }

    const merged = mergeBaseline(previous, [], 'now', ['unit', 'functional'])
    assert.deepEqual(merged.removed, [unit])
    assert.deepInclude(merged.baseline.failures, { ...unit, consecutive: 0 })
    assert.deepInclude(merged.baseline.failures, browser)
    assert.deepEqual(diffFailures(previous, [], { suites: ['unit'] }).fixed, [unit])

    const suites = [{ name: 'unit' }, { name: 'functional' }, { name: 'browser' }]
    assert.deepEqual(plannedSuites({ suites, filters: { suites: ['unit', 'functional'] } }), [
      'unit',
      'functional',
    ])
    assert.deepEqual(plannedSuites({ suites }), ['unit', 'functional', 'browser'])
    assert.deepEqual(plannedSuites({}), ['default'])
  })

  test('keep the baseline counts of an agent report summary', async () => {
    const { parseAgentReport } = await import('../src/agent_delta.js')
    const report = parseAgentReport(
      '{"event":"summary","total":3,"baseline":{"known":2,"new":1,"fixed":0}}\n'
    )
    assert.deepEqual(report.summary?.baseline, { known: 2, new: 1, fixed: 0 })
  })

  test('merge repeated retry failures once', async () => {
    const { diffFailures, mergeBaseline } = await import('../src/failure_baseline.js')
    const entry = { suite: 'default', file: 'a.spec.ts', title: 'a' }
    const merged = mergeBaseline({ version: 1, failures: [] }, [entry, entry])
    assert.lengthOf(merged.baseline.failures, 1)
    assert.equal(merged.baseline.failures[0].consecutive, 1)
    assert.lengthOf(merged.added, 1)

    const baseline = { version: 1 as const, failures: [entry] }
    const diff = diffFailures(baseline, [entry, entry])
    assert.lengthOf(diff.known, 1)
  })

  test('compare selection signatures and group identities in deltas', async () => {
    const { diffReports } = await import('../src/agent_delta.js')
    const selection = (signature: string) => ({
      mode: 'filtered',
      planned: 1,
      skipped: 1,
      signature,
    })
    const previous = {
      summary: { total: 1, selection: selection('a') },
      failures: [{ suite: 'unit', group: 'A', file: 'f.spec.ts', title: 'same' }],
    }
    const differentSelection = diffReports(previous, {
      summary: { total: 1, selection: selection('b') },
      failures: [{ suite: 'unit', group: 'B', file: 'f.spec.ts', title: 'same' }],
    })
    assert.isFalse(differentSelection.comparable)
    assert.lengthOf(differentSelection.fixed, 0)
    assert.lengthOf(differentSelection.newFailures, 1)

    const same = diffReports(previous, {
      summary: { total: 1, selection: selection('a') },
      failures: [{ suite: 'unit', group: 'A', file: 'f.spec.ts', title: 'same' }],
    })
    assert.isTrue(same.comparable)
    assert.lengthOf(same.newFailures, 0)
  })

  test('include groups in baseline identities', async () => {
    const { diffFailures } = await import('../src/failure_baseline.js')
    const baseline = {
      version: 2 as const,
      failures: [{ suite: 'default', group: 'A', file: 'a.spec.ts', title: 'same' }],
    }
    const observed = [{ suite: 'default', group: 'B', file: 'a.spec.ts', title: 'same' }]
    assert.lengthOf(diffFailures(baseline, observed).new, 1)
  })

  test('never prune a file that registers a pinned test', async () => {
    const { shouldSkipFile } = await import('../src/selection_index.js')
    const entry = {
      mtimeMs: 0,
      size: 0,
      tests: ['a'],
      groups: [],
      tags: [],
      pinned: true,
    }
    assert.isFalse(shouldSkipFile(entry, { tests: ['b'] }))
  })

  test('invalidate indexed freshness when a dependency changes', async () => {
    const { isFresh, readIndex, writeSelectionIndex } = await import('../src/selection_index.js')
    const { readDependencyMap } = await import('../src/dependencies.js')
    const { dependencyFile, indexFile } = await import('../src/cache_paths.js')
    const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.fresh-', import.meta.url)))
    try {
      await writeFile(`${cwd}/test.spec.ts`, '')
      await writeFile(`${cwd}/helper.ts`, 'export const title = "old"\n')
      await mkdir(dirname(dependencyFile(cwd)), { recursive: true })
      await writeFile(
        dependencyFile(cwd),
        JSON.stringify({
          version: 3,
          complete: true,
          files: { 'test.spec.ts': ['helper.ts'] },
          boot: [],
          bridged: [],
        })
      )
      const registered = {
        suites: [
          {
            name: 'default',
            stack: [
              { options: { title: 'old', tags: [], meta: { fileName: `${cwd}/test.spec.ts` } } },
            ],
          },
        ],
      }
      await writeSelectionIndex(registered, cwd)
      const index = await readIndex(indexFile(cwd))
      const entry = index.files['test.spec.ts']
      const dependencies = await readDependencyMap(dependencyFile(cwd))

      assert.isString(entry.dependencyDigest)
      assert.isTrue(await isFresh(cwd, 'test.spec.ts', entry, dependencies))
      await writeFile(`${cwd}/helper.ts`, 'export const title = "new"\n')
      assert.isFalse(await isFresh(cwd, 'test.spec.ts', entry, dependencies))
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('reject malformed selection and dependency caches', async () => {
    const { emptyIndex, readIndex } = await import('../src/selection_index.js')
    const { parseDependencyMap } = await import('../src/dependencies.js')
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const cwd = await mkdtemp(fileURLToPath(new URL('../.cache-', import.meta.url)))
    try {
      await writeFile(`${cwd}/index.json`, JSON.stringify({ version: 1, files: null }))
      assert.deepEqual(await readIndex(`${cwd}/index.json`), emptyIndex())
      const empty = { version: 3 as const, complete: false, files: {}, boot: [], bridged: [] }
      assert.deepEqual(parseDependencyMap({ version: 3, files: null, boot: [] }), empty)
      // Version 1 walked through packages, version 2 never recorded package bridges.
      assert.deepEqual(parseDependencyMap({ version: 1, complete: true, files: {} }), empty)
      const v2 = { version: 2, complete: true, files: {}, boot: [] }
      assert.deepEqual(parseDependencyMap(v2), empty)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('reject an invalid japa-agent timeout', async () => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const { fileURLToPath } = await import('node:url')
    const wrapper = fileURLToPath(new URL('../bin/agent.ts', import.meta.url))
    const result = await promisify(execFile)(
      process.execPath,
      ['--import=@poppinss/ts-exec', wrapper, '--timeout=0', '--', process.execPath, '-e', '0'],
      { cwd: process.cwd() }
    ).then(
      () => ({ code: 0 }),
      (error: { code?: number }) => ({ code: error.code })
    )
    assert.equal(result.code, 2)
  })
})
