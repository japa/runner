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
import { setTimeout } from 'node:timers/promises'

import { wrapAssertions } from './helpers.ts'
import { dateTimeDoubles } from '../src/helpers.ts'
import { Emitter, Refiner, Test, TestContext } from '../modules/core/main.ts'

test.describe('Date time doubles | travelTo', () => {
  test('travel to a future date', async () => {
    let stack: string[] = []

    const context = (t: Test) => new TestContext(t)
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = new Test('foo', context, emitter, refiner)

    t.run(({ cleanup }) => {
      cleanup(() => {
        dateTimeDoubles.reset()
      })

      dateTimeDoubles.travelTo('1 day')
      stack.push(`${new Date().toDateString()}`)
    })

    await t.exec()
    await wrapAssertions(() => {
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() + 1)
      assert.deepEqual(stack, [expectedDate.toDateString()])
    })
  })

  test('travel to a future minute using milliseconds', async () => {
    let stack: string[] = []

    const context = (t: Test) => new TestContext(t)
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = new Test('foo', context, emitter, refiner)

    t.run(({ cleanup }) => {
      cleanup(() => {
        dateTimeDoubles.reset()
      })

      dateTimeDoubles.travelTo(60 * 2 * 1000)
      stack.push(`${new Date().toTimeString()}`)
    })

    await t.exec()
    await wrapAssertions(() => {
      const expectedDate = new Date()
      expectedDate.setMinutes(expectedDate.getMinutes() + 2)
      assert.deepEqual(stack, [expectedDate.toTimeString()])
    })
  })

  test('travel in past', async () => {
    let stack: string[] = []

    const context = (t: Test) => new TestContext(t)
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = new Test('foo', context, emitter, refiner)

    t.run(({ cleanup }) => {
      cleanup(() => {
        dateTimeDoubles.reset()
      })

      dateTimeDoubles.travelTo('-1 day')
      stack.push(`${new Date().toDateString()}`)
    })

    await t.exec()
    await wrapAssertions(() => {
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 1)
      assert.deepEqual(stack, [expectedDate.toDateString()])
    })
  })

  test('travel in past using date instance', async () => {
    let stack: string[] = []

    const context = (t: Test) => new TestContext(t)
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = new Test('foo', context, emitter, refiner)

    t.run(({ cleanup }) => {
      cleanup(() => {
        dateTimeDoubles.reset()
      })

      const toDate = new Date()
      toDate.setDate(toDate.getDate() - 1)
      dateTimeDoubles.travelTo(toDate)
      stack.push(`${new Date().toDateString()}`)
    })

    await t.exec()
    await wrapAssertions(() => {
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 1)
      assert.deepEqual(stack, [expectedDate.toDateString()])
    })
  })
})

test.describe('Date time doubles | freezeTime', () => {
  test('travel to a future date and freeze time there', async () => {
    let stack: string[] = []

    const context = (t: Test) => new TestContext(t)
    const emitter = new Emitter()
    const refiner = new Refiner()
    const t = new Test('foo', context, emitter, refiner)

    const originalDate = new Date()
    originalDate.setMinutes(originalDate.getMinutes() + 2)

    t.run(async ({ cleanup }) => {
      cleanup(() => {
        dateTimeDoubles.reset()
      })

      dateTimeDoubles.freeze(originalDate)
      await setTimeout(2000)
      /**
       * Even after 2 seconds we get the same time
       */
      const date = new Date()
      stack.push(`${date.toTimeString()}`)
    }).timeout(3000)

    await t.exec()
    await wrapAssertions(() => {
      assert.deepEqual(stack, [originalDate.toTimeString()])
    })
  })
})
