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
import colors from '@poppinss/colors'

import type { CLIArgs } from '../src/types.js'
import { CliParser } from '../src/cli_parser.js'
import { wrapAssertions } from '../tests_helpers/main.js'

const DATASET: [CLIArgs, CLIArgs][] = [
  [
    new CliParser().parse([]),
    {
      '_': [] as string[],
      'files': '',
      'groups': '',
      'reporter': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['unit', 'functional']),
    {
      '_': ['unit', 'functional'] as string[],
      'files': '',
      'reporter': '',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--timeout', '1000']),
    {
      '_': [] as string[],
      'files': '',
      'reporter': '',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '1000',
    },
  ],
  [
    new CliParser().parse(['--timeout', '1000', '--retries', '2']),
    {
      '_': [] as string[],
      'files': '',
      'reporter': '',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '2',
      'tags': '',
      'tests': '',
      'timeout': '1000',
    },
  ],
  [
    new CliParser().parse(['--match-all']),
    {
      '_': [] as string[],
      'files': '',
      'reporter': '',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': true,
      'matchAll': true,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--force-exit']),
    {
      '_': [] as string[],
      'files': '',
      'force-exit': true,
      'forceExit': true,
      'reporter': '',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--browser=chrome', '--browser=firefox']),
    {
      '_': [] as string[],
      'files': '',
      'browser': ['chrome', 'firefox'],
      'reporter': '',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--reporter', 'spec']),
    {
      '_': [] as string[],
      'files': '',
      'reporter': 'spec',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--reporter', 'spec', '--reporter', 'dot']),
    {
      '_': [] as string[],
      'files': '',
      'reporter': ['spec', 'dot'],
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--reporter', 'spec,dot']),
    {
      '_': [] as string[],
      'files': '',
      'reporter': 'spec,dot',
      'groups': '',
      'h': false,
      'help': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
]

test.describe('CLI parser', () => {
  test('parse CLI arguments', async () => {
    for (let [cliArgs, output] of DATASET) {
      await wrapAssertions(() => {
        assert.deepEqual(cliArgs, output)
      })
    }
  })

  test('display help', async () => {
    const ansi = colors.ansi()
    console.log(new CliParser().getHelp())
    await wrapAssertions(() => {
      assert.deepEqual(new CliParser().getHelp().split('\n'), [
        '',
        ansi.yellow('@japa/runner v2.3.0'),
        '',
        `${ansi.green('--tests')}                     ${ansi.dim(
          'Filter tests by the test title'
        )}`,
        `${ansi.green('--groups')}                    ${ansi.dim(
          'Filter tests by the group title'
        )}`,
        `${ansi.green('--tags')}                      ${ansi.dim('Filter tests by tags')}`,
        `${ansi.green('--files')}                     ${ansi.dim('Filter tests by the file name')}`,
        `${ansi.green('--force-exit')}                ${ansi.dim('Forcefully exit the process')}`,
        `${ansi.green('--timeout')}                   ${ansi.dim(
          'Define default timeout for all tests'
        )}`,
        `${ansi.green('--retries')}                   ${ansi.dim(
          'Define default retries for all tests'
        )}`,
        `${ansi.green('--reporter')}                  ${ansi.dim(
          'Activate one or more test reporters'
        )}`,
        `${ansi.green('-h, --help')}                  ${ansi.dim('View help')}`,
        ``,
        `${ansi.yellow('Examples:')}`,
        `${ansi.dim('node bin/test.js --tags="@github"')}`,
        `${ansi.dim('node bin/test.js --tags="~@github"')}`,
        `${ansi.dim('node bin/test.js --tags="@github,@slow,@integration" --match-all')}`,
        `${ansi.dim('node bin/test.js --force-exit')}`,
        `${ansi.dim('node bin/test.js --files="user"')}`,
        `${ansi.dim('node bin/test.js --files="functional/user"')}`,
        `${ansi.dim('node bin/test.js --files="unit/user"')}`,
        ``,
        `${ansi.yellow('Notes:')}`,
        `- When groups and tests filters are applied together. We will first filter the`,
        `  tests by group title and then apply the tests title filter.`,
        `- The timeout defined on test object takes precedence over the ${ansi.green(
          '--timeout'
        )} flag.`,
        `- The retries defined on test object takes precedence over the ${ansi.green(
          '--retries'
        )} flag.`,
        `- The ${ansi.green(
          '--files'
        )} flag checks for the file names ending with the filter substring.`,
        ``,
      ])
    })
  })
})
