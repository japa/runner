/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { isRunningInAIAgent } from '@poppinss/utils'
import { assert } from 'chai'
import { test } from 'node:test'
import { Planner } from '../src/planner.js'
import { ConfigManager, NOOP } from '../src/config_manager.js'
import { wrapAssertions } from './helpers.js'

test.describe('Planner | files', () => {
  test('get suites for files', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, {}).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 2000,
        },
      ])
    })
  })

  test('apply files filter to the list', async () => {
    const config = new ConfigManager(
      { files: ['tests/**/*.spec.ts'], filters: { files: ['parser'] } },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [new URL('../tests/cli_parser.spec.ts', import.meta.url)],
          retries: 0,
          timeout: 2000,
        },
      ])
    })
  })

  test('use inline global timeout', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'], timeout: 1000 }, {}).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 1000,
        },
      ])
    })
  })

  test('use cli timeout', async () => {
    const config = new ConfigManager(
      { files: ['tests/**/*.spec.ts'], timeout: 1000 },
      {
        timeout: '3000',
      }
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 3000,
        },
      ])
    })
  })

  test('use inline global retries', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'], retries: 2 }, {}).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 2,
          timeout: 2000,
        },
      ])
    })
  })

  test('use cli retries', async () => {
    const config = new ConfigManager(
      { files: ['tests/**/*.spec.ts'], retries: 2 },
      {
        retries: '3',
      }
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 3,
          timeout: 2000,
        },
      ])
    })
  })

  test('error when suite filter is applied with files', async () => {
    const config = new ConfigManager(
      {
        files: [],
      },
      {
        _: ['functional'],
      }
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        'Cannot apply suites filter. You have not configured any test suites'
      )
    })
  })
})

test.describe('Planner | suites', () => {
  test('get suites', async () => {
    const config = new ConfigManager(
      { suites: [{ name: 'unit', files: 'tests/**/*.spec.ts' }] },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'unit',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 2000,
          configure: NOOP,
        },
      ])
    })
  })

  test('apply files filter to the suites', async () => {
    const config = new ConfigManager(
      { suites: [{ name: 'unit', files: 'tests/**/*.spec.ts' }], filters: { files: ['manager'] } },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'unit',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 2000,
          configure: NOOP,
        },
      ])
    })
  })

  test('use inline timeout', async () => {
    const config = new ConfigManager(
      {
        suites: [{ name: 'unit', files: 'tests/**/*.spec.ts', timeout: 1000 }],
      },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'unit',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 1000,
          configure: NOOP,
        },
      ])
    })
  })

  test('use cli timeout', async () => {
    const config = new ConfigManager(
      { suites: [{ name: 'unit', files: 'tests/**/*.spec.ts', timeout: 1000 }] },
      {
        timeout: '3000',
      }
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'unit',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 3000,
          configure: NOOP,
        },
      ])
    })
  })

  test('use inline retries', async () => {
    const config = new ConfigManager(
      { suites: [{ name: 'unit', files: 'tests/**/*.spec.ts', retries: 2 }] },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'unit',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 2,
          timeout: 2000,
          configure: NOOP,
        },
      ])
    })
  })

  test('use cli retries', async () => {
    const config = new ConfigManager(
      { suites: [{ name: 'unit', files: 'tests/**/*.spec.ts', retries: 2 }] },
      { retries: '3' }
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'unit',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 3,
          timeout: 2000,
          configure: NOOP,
        },
      ])
    })
  })

  test('error on duplicate suites', async () => {
    const config = new ConfigManager(
      {
        suites: [
          { name: 'unit', files: 'tests/**/*.spec.ts' },
          { name: 'unit', files: 'tests/**/*.spec.ts' },
        ],
      },
      {}
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(() => new Planner(config), 'Duplicate suite "unit"')
    })
  })

  test('error when suite filter mentions non-existing suite', async () => {
    const config = new ConfigManager(
      {
        suites: [{ name: 'unit', files: 'tests/**/*.spec.ts' }],
      },
      {
        _: ['functional'],
      }
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        'Cannot apply suites filter. "functional" suite is not configured'
      )
    })
  })

  test('error when suite filter is applied without defining suites', async () => {
    const config = new ConfigManager(
      {
        suites: [],
      },
      {
        _: ['functional'],
      }
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        'Cannot apply suites filter. You have not configured any test suites'
      )
    })
  })

  test('apply suites filter', async () => {
    const config = new ConfigManager(
      {
        suites: [
          { name: 'unit', files: 'tests/**/*.spec.ts' },
          { name: 'functional', files: 'tests/**/*.spec.ts' },
        ],
      },
      {
        _: ['functional'],
      }
    ).hydrate()

    const { suites } = await new Planner(config).plan()
    await wrapAssertions(() => {
      assert.deepEqual(suites, [
        {
          name: 'functional',
          files: 'tests/**/*.spec.ts',
          filesURLs: [
            new URL('../tests/base_reporter.spec.ts', import.meta.url),
            new URL('../tests/cli_parser.spec.ts', import.meta.url),
            new URL('../tests/config_manager.spec.ts', import.meta.url),
            new URL('../tests/core.spec.ts', import.meta.url),
            new URL('../tests/files_manager.spec.ts', import.meta.url),
            new URL('../tests/github_reporter.spec.ts', import.meta.url),
            new URL('../tests/helpers.spec.ts', import.meta.url),
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 0,
          timeout: 2000,
          configure: NOOP,
        },
      ])
    })
  })
})

test.describe('Planner | reporters', () => {
  test('get collection of activated reporters', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, {}).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(
        reporters,
        [
          {
            handler: reporters[0].handler,
            name: isRunningInAIAgent() ? 'dot' : 'spec',
          },
        ].concat(
          !isRunningInAIAgent() && process.env.GITHUB_ACTIONS === 'true'
            ? [
                {
                  handler: reporters[1].handler,
                  name: 'github',
                },
              ]
            : []
        )
      )
    })
  })

  test('get collection of manually activated reporters', async () => {
    const config = new ConfigManager(
      {
        files: ['tests/**/*.spec.ts'],
        reporters: {
          activated: ['dot'],
          list: [
            {
              name: 'spec',
              handler: {} as any,
            },
            {
              name: 'dot',
              handler: {} as any,
            },
          ],
        },
      },
      {}
    ).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(reporters, [
        {
          handler: {} as any,
          name: 'dot',
        },
      ])
    })
  })

  test('get collection of reporters activated via CLI flag', async () => {
    const config = new ConfigManager(
      {
        files: ['tests/**/*.spec.ts'],
        reporters: {
          activated: ['dot'],
          list: [
            {
              name: 'spec',
              handler: {} as any,
            },
            {
              name: 'dot',
              handler: {} as any,
            },
          ],
        },
      },
      {
        reporters: 'spec',
      }
    ).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(reporters, [
        {
          handler: {} as any,
          name: 'spec',
        },
      ])
    })
  })

  test('report error when activated reporter is not in the list', async () => {
    const config = new ConfigManager(
      {
        files: ['tests/**/*.spec.ts'],
        reporters: {
          activated: ['progress'],
          list: [
            {
              name: 'spec',
              handler: {} as any,
            },
            {
              name: 'dot',
              handler: {} as any,
            },
          ],
        },
      },
      {}
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        'Invalid reporter "progress". Make sure to register it first inside the "reporters.list" array'
      )
    })
  })

  test('report error when CLI activated reporter is not in the list', async () => {
    const config = new ConfigManager(
      {
        files: ['tests/**/*.spec.ts'],
        reporters: {
          activated: ['dot'],
          list: [
            {
              name: 'spec',
              handler: {} as any,
            },
            {
              name: 'dot',
              handler: {} as any,
            },
          ],
        },
      },
      {
        reporters: 'progress',
      }
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        'Invalid reporter "progress". Make sure to register it first inside the "reporters.list" array'
      )
    })
  })
})

test.describe('Planner | refinerFilters', () => {
  test('get refinerFilters from the filters list', async () => {
    const config = new ConfigManager(
      {
        files: ['tests/**/*.spec.ts'],
        filters: {
          tests: ['user'],
          tags: ['@slow'],
          files: ['manager'],
          groups: ['customers'],
        },
      },
      {}
    ).hydrate()
    const { refinerFilters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(refinerFilters, [
        {
          layer: 'tests',
          filters: ['user'],
        },
        {
          layer: 'tags',
          filters: ['@slow'],
        },
        {
          layer: 'groups',
          filters: ['customers'],
        },
      ])
    })
  })
})

test.describe('Planner | shard', () => {
  test('split files across shards in round-robin order', async () => {
    const shards = await Promise.all(
      [1, 2, 3].map(async (current) => {
        const config = new ConfigManager(
          { files: ['tests/**/*.spec.ts'], filters: { shard: { current, total: 3 } } },
          {}
        ).hydrate()
        const { suites } = await new Planner(config).plan()
        return suites[0].filesURLs
      })
    )

    await wrapAssertions(() => {
      assert.deepEqual(shards, [
        [
          new URL('../tests/base_reporter.spec.ts', import.meta.url),
          new URL('../tests/core.spec.ts', import.meta.url),
          new URL('../tests/helpers.spec.ts', import.meta.url),
        ],
        [
          new URL('../tests/cli_parser.spec.ts', import.meta.url),
          new URL('../tests/files_manager.spec.ts', import.meta.url),
          new URL('../tests/planner.spec.ts', import.meta.url),
        ],
        [
          new URL('../tests/config_manager.spec.ts', import.meta.url),
          new URL('../tests/github_reporter.spec.ts', import.meta.url),
          new URL('../tests/runner.spec.ts', import.meta.url),
        ],
      ])
    })
  })

  test('continue shard index across suites', async () => {
    const config = new ConfigManager(
      {
        suites: [
          { name: 'unit', files: 'tests/*_manager.spec.ts' },
          { name: 'functional', files: 'tests/cli_parser.spec.ts' },
        ],
        filters: { shard: { current: 1, total: 2 } },
      },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(
        suites.map(({ name, filesURLs }) => ({ name, filesURLs })),
        [
          {
            name: 'unit',
            filesURLs: [new URL('../tests/config_manager.spec.ts', import.meta.url)],
          },
          {
            name: 'functional',
            filesURLs: [new URL('../tests/cli_parser.spec.ts', import.meta.url)],
          },
        ]
      )
    })
  })

  test('apply shard after the files filter', async () => {
    const config = new ConfigManager(
      {
        files: ['tests/**/*.spec.ts'],
        filters: { files: ['manager'], shard: { current: 2, total: 2 } },
      },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites[0].filesURLs, [
        new URL('../tests/files_manager.spec.ts', import.meta.url),
      ])
    })
  })

  test('use shard defined via CLI flag', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, { shard: '2/3' }).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepEqual(suites[0].filesURLs, [
        new URL('../tests/cli_parser.spec.ts', import.meta.url),
        new URL('../tests/files_manager.spec.ts', import.meta.url),
        new URL('../tests/planner.spec.ts', import.meta.url),
      ])
    })
  })

  test('report error when shard is invalid', async () => {
    for (let shard of ['0/4', '5/4', '1/0', '1', 'a/b', '-1/4', '1.5/4']) {
      const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, { shard }).hydrate()

      await wrapAssertions(() => {
        assert.throws(
          () => new Planner(config),
          'Invalid shard. Expected "current/total" where both are positive integers and current is not greater than total. For example: --shard=1/4'
        )
      })
    }
  })
})

test.describe('Planner | balanced shard', () => {
  const files = ['a', 'b', 'c', 'd'].map(
    (name) => new URL(`../tests/${name}.spec.ts`, import.meta.url)
  )

  async function shard(current: number, total: number, durations: Record<string, number>) {
    const config = new ConfigManager(
      { files: () => files, shardDurations: durations, filters: { shard: { current, total } } },
      {}
    ).hydrate()
    const plan = await new Planner(config).plan()
    return plan.suites[0].filesURLs
  }

  test('balance expensive files and preserve import order within each shard', async () => {
    const durations = {
      'tests/a.spec.ts': 10,
      'tests/b.spec.ts': 1,
      'tests/c.spec.ts': 9,
      'tests/d.spec.ts': 2,
    }
    const shards = await Promise.all([1, 2].map((current) => shard(current, 2, durations)))
    assert.deepEqual(shards, [
      [files[0], files[1]],
      [files[2], files[3]],
    ])
    assert.deepEqual(shards.flat().sort(), [...files].sort())
  })

  test('distribute zero estimates and allow empty shards without duplication', async () => {
    const durations = Object.fromEntries(['a', 'b', 'c', 'd'].map((n) => [`tests/${n}.spec.ts`, 0]))
    const shards = await Promise.all([1, 2, 3, 4, 5].map((current) => shard(current, 5, durations)))
    assert.deepEqual(shards, files.map((file) => [file]).concat([[]]))
  })

  test('reject non-finite or negative estimates', () => {
    for (const value of [Number.NaN, Infinity, -1]) {
      assert.throws(
        () =>
          new Planner(
            new ConfigManager(
              { files: [], shardDurations: { 'tests/a.spec.ts': value } },
              {}
            ).hydrate()
          ),
        /Invalid shard duration/
      )
    }
  })

  test('use suite-specific estimates and keep filtered-out files out of every shard', async () => {
    const durations = {
      'unit:tests/a.spec.ts': 10,
      'tests/b.spec.ts': 1,
      'tests/c.spec.ts': 9,
      'tests/d.spec.ts': 2,
    }
    const shards = await Promise.all(
      [1, 2].map(async (current) => {
        const config = new ConfigManager(
          {
            suites: [{ name: 'unit', files: () => files }],
            shardDurations: durations,
            filters: { files: ['a', 'b', 'c'], shard: { current, total: 2 } },
          },
          {}
        ).hydrate()
        const plan = await new Planner(config).plan()
        return plan.suites[0].filesURLs
      })
    )
    assert.deepEqual(shards, [[files[0]], [files[1], files[2]]])
  })
})
