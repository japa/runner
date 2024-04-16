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

import { colors } from '../src/helpers.js'
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
      'reporters': '',
      'h': false,
      'help': false,
      'failed': false,
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
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
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
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
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
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
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
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
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
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--browser', 'chrome', '--browser', 'firefox']),
    {
      '_': [] as string[],
      'files': '',
      'browser': ['chrome', 'firefox'],
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--reporters', 'spec']),
    {
      '_': [] as string[],
      'files': '',
      'reporters': 'spec',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--reporters', 'spec', '--reporters', 'dot']),
    {
      '_': [] as string[],
      'files': '',
      'reporters': ['spec', 'dot'],
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--reporters', 'spec,dot']),
    {
      '_': [] as string[],
      'files': '',
      'reporters': 'spec,dot',
      'groups': '',
      'h': false,
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--failed']),
    {
      '_': [] as string[],
      'files': '',
      'reporters': '',
      'groups': '',
      'h': false,
      'help': false,
      'failed': true,
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

  if (!process.env.CI) {
    test('display help', async () => {
      console.log(new CliParser().getHelp())
      await wrapAssertions(() => {
        assert.deepEqual(new CliParser().getHelp().split('\n'), [
          '',
          colors.yellow('@japa/runner v2.3.0'),
          '',
          `${colors.green('--tests')}                     ${colors.dim(
            'Filter tests by the test title'
          )}`,
          `${colors.green('--groups')}                    ${colors.dim(
            'Filter tests by the group title'
          )}`,
          `${colors.green('--tags')}                      ${colors.dim('Filter tests by tags')}`,
          `${colors.green('--files')}                     ${colors.dim(
            'Filter tests by the file name'
          )}`,
          `${colors.green('--force-exit')}                ${colors.dim('Forcefully exit the process')}`,
          `${colors.green('--timeout')}                   ${colors.dim(
            'Define default timeout for all tests'
          )}`,
          `${colors.green('--retries')}                   ${colors.dim(
            'Define default retries for all tests'
          )}`,
          `${colors.green('--reporters')}                 ${colors.dim(
            'Activate one or more test reporters'
          )}`,
          `${colors.green('--failed')}                    ${colors.dim(
            'Run tests failed during the last run'
          )}`,
          `${colors.green('-h, --help')}                  ${colors.dim('View help')}`,
          ``,
          `${colors.yellow('Examples:')}`,
          `${colors.dim('node bin/test.js --tags="@github"')}`,
          `${colors.dim('node bin/test.js --tags="~@github"')}`,
          `${colors.dim('node bin/test.js --tags="@github,@slow,@integration" --match-all')}`,
          `${colors.dim('node bin/test.js --force-exit')}`,
          `${colors.dim('node bin/test.js --files="user"')}`,
          `${colors.dim('node bin/test.js --files="functional/user"')}`,
          `${colors.dim('node bin/test.js --files="unit/user"')}`,
          ``,
          `${colors.yellow('Notes:')}`,
          `- When groups and tests filters are applied together. We will first filter the`,
          `  tests by group title and then apply the tests title filter.`,
          `- The timeout defined on test object takes precedence over the ${colors.green(
            '--timeout'
          )} flag.`,
          `- The retries defined on test object takes precedence over the ${colors.green(
            '--retries'
          )} flag.`,
          `- The ${colors.green(
            '--files'
          )} flag checks for the file names ending with the filter substring.`,
          ``,
        ])
      })
    })
  }
})
