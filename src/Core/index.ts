/*
 * @japa/runner
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Test, Group, TestContext as BaseTestContext } from '@japa/core'

export class TestContext extends BaseTestContext {
  constructor(public test: Test<TestContext, any>) {
    super()
  }
}

export { Group, Test }
