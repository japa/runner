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
      cliArgs: {
        '_': [],
        'files': 'maths-add.spec,maths-subtract.spec',
        'force-exit': false,
        'forceExit': false,
        'groups': '',
        'h': false,
        'help': false,
        'ignore-tags': '',
        'ignoreTags': '',
        'tags': '',
        'tests': '',
        'timeout': '',
      },
    })
  })

  test('process repeated flags as an array', (assert) => {
    assert.deepEqual(processCliArgs(['--files=maths-add.spec', '--files=maths-subtract.spec']), {
      filters: {
        files: ['maths-add.spec', 'maths-subtract.spec'],
      },
      cliArgs: {
        '_': [],
        'files': ['maths-add.spec', 'maths-subtract.spec'],
        'force-exit': false,
        'forceExit': false,
        'groups': '',
        'h': false,
        'help': false,
        'ignore-tags': '',
        'ignoreTags': '',
        'tags': '',
        'tests': '',
        'timeout': '',
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
        cliArgs: {
          '_': [],
          'files': 'maths-add.spec',
          'force-exit': false,
          'forceExit': false,
          'groups': 'Maths.add',
          'h': false,
          'help': false,
          'ignore-tags': '@subtract',
          'ignoreTags': '@subtract',
          'tags': '@maths',
          'tests': 'add two numbers',
          'timeout': '4000',
        },
      }
    )
  })

  test('ignore timeout when is not a number', (assert) => {
    assert.deepEqual(processCliArgs(['--timeout=foo']), {
      filters: {},
      cliArgs: {
        '_': [],
        'files': '',
        'force-exit': false,
        'forceExit': false,
        'groups': '',
        'h': false,
        'help': false,
        'ignore-tags': '',
        'ignoreTags': '',
        'tags': '',
        'tests': '',
        'timeout': 'foo',
      },
    })
  })

  test('collect suites from the CLI args', (assert) => {
    assert.deepEqual(processCliArgs(['unit', 'functional', '--timeout=foo']), {
      filters: {
        suites: ['unit', 'functional'],
      },
      cliArgs: {
        '_': ['unit', 'functional'],
        'files': '',
        'force-exit': false,
        'forceExit': false,
        'groups': '',
        'h': false,
        'help': false,
        'ignore-tags': '',
        'ignoreTags': '',
        'tags': '',
        'tests': '',
        'timeout': 'foo',
      },
    })
  })

  test('parse additional flags', (assert) => {
    assert.deepEqual(processCliArgs(['--browser=foo']), {
      filters: {},
      cliArgs: {
        '_': [],
        'files': '',
        'force-exit': false,
        'forceExit': false,
        'groups': '',
        'h': false,
        'help': false,
        'ignore-tags': '',
        'ignoreTags': '',
        'tags': '',
        'tests': '',
        'timeout': '',
        'browser': 'foo',
      },
    })
  })
})
