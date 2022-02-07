/*
 * @japa/runner
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { processCliArgs } from '../index'

test.group('processCliArgs', () => {
  test('process comma separated values', (assert) => {
    assert.deepEqual(processCliArgs(['--files=maths-add.spec,maths-subtract.spec']), {
      filters: {
        files: ['maths-add.spec', 'maths-subtract.spec'],
      },
    })
  })

  test('process repeated flags as an array', (assert) => {
    assert.deepEqual(processCliArgs(['--files=maths-add.spec', '--files=maths-subtract.spec']), {
      filters: {
        files: ['maths-add.spec', 'maths-subtract.spec'],
      },
    })
  })

  test('process all the accepted flags', (assert) => {
    assert.deepEqual(
      processCliArgs([
        '--files=maths-add.spec',
        '--groups=Maths.add',
        '--tests=add two numbers',
        '--tags=@maths',
        '--ignore-tags=@subtract',
      ]),
      {
        filters: {
          files: ['maths-add.spec'],
          groups: ['Maths.add'],
          tests: ['add two numbers'],
          tags: ['@maths', '!@subtract'],
        },
      }
    )
  })
})
