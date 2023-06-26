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
import { Planner } from '../src/planner.js'
import { ConfigManager } from '../src/config_manager.js'
import { wrapAssertions } from '../tests_helpers/main.js'

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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
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
          retries: 1,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
          timeout: 2000,
          configure: undefined,
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
          retries: 1,
          timeout: 2000,
          configure: undefined,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
          timeout: 1000,
          configure: undefined,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
          timeout: 3000,
          configure: undefined,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 2,
          timeout: 2000,
          configure: undefined,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 3,
          timeout: 2000,
          configure: undefined,
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
            new URL('../tests/planner.spec.ts', import.meta.url),
            new URL('../tests/runner.spec.ts', import.meta.url),
          ],
          retries: 1,
          timeout: 2000,
          configure: undefined,
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
      assert.deepEqual(reporters, [
        {
          handler: {} as any,
          name: 'spec',
        },
      ])
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
        reporter: 'spec',
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
        reporter: 'progress',
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
