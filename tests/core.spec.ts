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
import { Emitter, Refiner, Test, TestContext } from '../modules/core/main.js'
import { wrapAssertions } from '../tests_helpers/main.js'

test.describe('Core', () => {
  test('define test cleanup callback using the test context', async () => {
    let stack: string[] = []

    const context = (t: Test) => new TestContext(t)
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = new Test('foo', context, emitter, refiner)

    t.run(({ cleanup }) => {
      cleanup(() => {
        stack.push('cleanup')
      })
      stack.push('executed')
    })

    await t.exec()
    await wrapAssertions(() => {
      assert.deepEqual(stack, ['executed', 'cleanup'])
    })
  })
})
