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

import { runner } from '../factories/main.js'
import { GlobalHooks } from '../src/hooks.js'
import { ConfigManager } from '../src/config_manager.js'
import { pEvent, wrapAssertions } from '../tests_helpers/main.js'
import { createTest, createTestGroup } from '../src/create_test.js'
import { clearCache, getFailedTests, retryPlugin } from '../src/plugins/retry.js'
import { Emitter, Refiner, Runner, Suite } from '../modules/core/main.js'

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
    assert.deepEqual(suite.stack, [group])
  })

  test('add test to the suite when defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('', emitter, refiner)
    const t = createTest('', emitter, refiner, { suite })
    assert.deepEqual(suite.stack, [t])
  })

  test('add test to the group when group and suite both are defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('', emitter, refiner)

    const group = createTestGroup('', emitter, refiner, { suite })
    const t = createTest('', emitter, refiner, { suite, group })
    assert.deepEqual(suite.stack, [group])
    assert.deepEqual(group.tests, [t])
  })

  test('define test timeout from global options', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, { timeout: 1000 })

    await wrapAssertions(() => {
      assert.equal(t.options.timeout, 1000)
    })
  })

  test('define test retries from global options', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, { retries: 4 })

    await wrapAssertions(() => {
      assert.equal(t.options.retries, 4)
    })
  })

  test('execute test', async () => {
    const stack: string[] = []
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, { retries: 4 })
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
    const t = createTest('', emitter, refiner, {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failed')

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, false)
  })

  test('assert error matches the regular expression', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, {})
    t.run(() => {
      throw new Error('Failed')
    }).throws(/ed?/)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, false)
  })

  test('throw error when test does not have a callback defined', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, {})

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
    const t = createTest('', emitter, refiner, {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failed', Error)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, false)
  })

  test('fail when test does not throw an exception', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, {})
    t.run(() => {}).throws('Failed', Error)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, true)
    assert.equal(event!.errors[0].error.message, 'Expected test to throw an exception')
  })

  test('fail when error constructor mismatch', async () => {
    class Exception {}
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failed', Exception)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, true)
    assert.equal(event!.errors[0].error.message, 'Expected test to throw "[class Exception]"')
  })

  test('fail when error message mismatch', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, {})
    t.run(() => {
      throw new Error('Failed')
    }).throws('Failure')

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, true)
    assert.equal(
      event!.errors[0].error.message,
      'Expected test to throw "Failure". Instead received "Failed"'
    )
  })

  test('fail when error does not match the regular expression', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = createTest('', emitter, refiner, {})
    t.run(() => {
      throw new Error('Failed')
    }).throws(/lure?/)

    const [event] = await Promise.all([pEvent(emitter, 'test:end'), t.exec()])
    assert.equal(event!.hasError, true)
    assert.equal(
      event!.errors[0].error.message,
      'Expected test error to match "/lure?/" regular expression'
    )
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
    createTest('failing test', emitter, refiner, { suite }).run(() => {
      stack.push('executing failing test')
      throw new Error('Failing')
    })
    createTest('passing test', emitter, refiner, { suite }).run(() => {
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
      .withSuites([suite])
      .run()

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
      createTest('failing test', emitter, refiner, { suite }).run(() => {
        stack.push('executing failing test')
        throw new Error('Failing')
      })
      createTest('passing test', emitter, refiner, { suite }).run(() => {
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
        .withSuites([getSuite()])
    }

    await getExecutor().run()
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, ['executing failing test', 'executing passing test'])
    })

    await getExecutor(['--failed']).run()
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
      createTest('failing test', emitter, refiner, { suite }).run(() => {
        stack.push('executing failing test')
        throw new Error('Failing')
      })
      createTest('passing test', emitter, refiner, { suite }).run(() => {
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
        .withSuites([getSuite()])
    }

    await getExecutor().run()
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: ['failing test'] })
      assert.deepEqual(stack, ['executing failing test', 'executing passing test'])
    })

    await getExecutor([]).run()
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
      createTest('passing test', emitter, refiner, { suite }).run(() => {
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
        .withSuites([getSuite()])
    }

    await getExecutor().run()
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: [] })
      assert.deepEqual(stack, ['executing passing test'])
    })

    await getExecutor(['--failed']).run()
    await wrapAssertions(async () => {
      assert.deepEqual(await getFailedTests(), { tests: [] })
      assert.deepEqual(stack, ['executing passing test', 'executing passing test'])
    })

    await clearCache()
  })
})
