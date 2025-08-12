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
import { wrapAssertions } from './helpers.js'

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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': true,
      'matchAll': true,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': false,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
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
      'bail': false,
      'bailLayer': '',
      'bail-layer': '',
      'help': false,
      'failed': true,
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--bail']),
    {
      '_': [] as string[],
      'files': '',
      'groups': '',
      'reporters': '',
      'h': false,
      'help': false,
      'failed': false,
      'bail': true,
      'bailLayer': '',
      'bail-layer': '',
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--bail', '--bail-layer=group']),
    {
      '_': [] as string[],
      'files': '',
      'groups': '',
      'reporters': '',
      'h': false,
      'help': false,
      'failed': false,
      'bail': true,
      'bail-layer': 'group',
      'bailLayer': 'group',
      'match-all': false,
      'matchAll': false,
      'list-pinned': false,
      'listPinned': false,
      'retries': '',
      'tags': '',
      'tests': '',
      'timeout': '',
    },
  ],
  [
    new CliParser().parse(['--list-pinned']),
    {
      '_': [] as string[],
      'files': '',
      'groups': '',
      'reporters': '',
      'h': false,
      'help': false,
      'failed': false,
      'bail': false,
      'bail-layer': '',
      'bailLayer': '',
      'match-all': false,
      'matchAll': false,
      'list-pinned': true,
      'listPinned': true,
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
          `${colors.green('--match-all')}                 ${colors.dim('Run tests that matches all the supplied tags')}`,
          `${colors.green('--list-pinned')}               ${colors.dim('List pinned tests')}`,
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
          `${colors.green('--bail')}                      ${colors.dim(
            'Exit early when a test fails'
          )}`,
          `${colors.green('--bail-layer')}                ${colors.dim('Specify at which layer to enable the bail mode. Can be "group" or "suite"')}`,
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
          `${colors.dim('node bin/test.js --failed')}`,
          `${colors.dim('node bin/test.js --bail')}`,
          `${colors.dim('node bin/test.js --bail=group')}`,
          ``,
          `${colors.yellow('Notes:')}`,
          `- When groups and tests filters are applied together. We will first filter the`,
          `  tests by group title and then apply the tests filter.`,
          `- The timeout defined on test object takes precedence over the ${colors.green(
            '--timeout'
          )} flag.`,
          `- The retries defined on test object takes precedence over the ${colors.green(
            '--retries'
          )} flag.`,
          `- The ${colors.green(
            '--files'
          )} flag checks for the file names ending with the filter substring.`,
          `- The ${colors.green('--tags')} filter runs tests that has one or more of the supplied tags.`,
          `- You can use the ${colors.green('--match-all')} flag to run tests that has all the supplied tags.`,
          ``,
        ])
      })
    })
  }
})
