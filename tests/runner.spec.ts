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

import { GlobalHooks } from '../src/hooks.js'
import { ConfigManager } from '../src/config_manager.js'
import { wrapAssertions } from '../tests_helpers/main.js'
import { createTest, createTestGroup } from '../src/create_test.js'
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
