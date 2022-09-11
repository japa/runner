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
        '--timeout=4000',
        '--ignore-tags=@subtract',
      ]),
      {
        timeout: 4000,
        filters: {
          files: ['maths-add.spec'],
          groups: ['Maths.add'],
          tests: ['add two numbers'],
          tags: ['@maths', '!@subtract'],
        },
      }
    )
  })

  test('ignore timeout when is not a number', (assert) => {
    assert.deepEqual(processCliArgs(['--timeout=foo']), {
      filters: {},
    })
  })

  test('collect suites from the CLI args', (assert) => {
    assert.deepEqual(processCliArgs(['unit', 'functional', '--timeout=foo']), {
      filters: {
        suites: ['unit', 'functional'],
      },
    })
  })

  test('collect reporters from the CLI args', (assert) => {
    assert.deepEqual(processCliArgs(['--reporters=foo,bar']), {
      filters: {},
      cliReporters: ['foo', 'bar'],
    })
  })
})
