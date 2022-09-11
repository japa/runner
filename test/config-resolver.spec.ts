import test from 'japa'
import { resolveConfig } from '../src/ConfigResolver'

test.group('resolveConfig', () => {
  test('normalize reporters config - old api', (assert) => {
    const firstReporter = () => {}
    const config = resolveConfig({
      reporters: [firstReporter],
      files: ['foo.spec.ts'],
    })

    assert.deepEqual(config.reporters.list.length, 1)
    assert.deepEqual(config.reporters.defaults.length, 1)
    assert.deepEqual(config.reporters.list[0].handler, firstReporter)
  })

  test('normalize reporters config - defaults reporters from CLI args', (assert) => {
    const firstReporter = () => {}
    const config = resolveConfig({
      reporters: {
        defaults: ['spec'],
        list: [{ name: 'spec' as const, handler: firstReporter }],
      },
      files: ['foo.spec.ts'],
      cliReporters: ['my-reporter'],
    })

    assert.deepEqual(config.reporters, {
      defaults: ['my-reporter'],
      list: [{ name: 'spec', handler: firstReporter }],
    })
  })

  test('normalize reporters config - basic', (assert) => {
    const firstReporter = () => {}
    const config = resolveConfig({
      reporters: {
        defaults: ['first'],
        list: [{ name: 'first', handler: firstReporter }],
      },
      files: ['foo.spec.ts'],
    })

    assert.deepEqual(config.reporters, {
      defaults: ['first'],
      list: [{ name: 'first', handler: firstReporter }],
    })
  })

  test('should enable all reporters if using old api', (assert) => {
    const firstReporter = () => {}
    const config = resolveConfig({
      reporters: [firstReporter],
      files: ['foo.spec.ts'],
    })

    assert.deepEqual(config.reporters.defaults.length, 1)
  })

  test('should typerror when defaults is not in list', (_assert) => {
    const firstReporter = () => {}
    resolveConfig({
      // @ts-expect-error - Invalid config !
      reporters: {
        defaults: ['first'],
        list: [{ name: 'second' as const, handler: firstReporter }],
      },
      files: ['foo.spec.ts'],
    })
  })
})
