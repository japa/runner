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
import { ErrorsPrinter } from '@japa/errors-printer'

import { wrapAssertions } from './helpers.js'
import { GithubReporter } from '../src/reporters/github.js'

test.describe('Github reporter', () => {
  test('report errors in correct format', async () => {
    const reporter = new GithubReporter()
    const errorPrinter = new ErrorsPrinter()
    const annotation = await reporter.getErrorAnnotation(errorPrinter, {
      phase: 'test',
      title: '2 + 2 is 4',
      error: new Error('Expected 5 to equal 4'),
    })

    wrapAssertions(() => {
      assert.equal(
        annotation,
        '::error file=tests/github_reporter.spec.ts,title=2 + 2 is 4,line=24,column=14::Expected 5 to equal 4'
      )
    })
  })

  test('do not report values other than errors', async () => {
    const reporter = new GithubReporter()
    const errorPrinter = new ErrorsPrinter()
    const annotation = await reporter.getErrorAnnotation(errorPrinter, {
      phase: 'test',
      title: '2 + 2 is 4',
      error: 22,
    } as any)

    wrapAssertions(() => {
      assert.isUndefined(annotation)
    })
  })
})
