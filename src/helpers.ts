/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/string'
import useColors from '@poppinss/colors'
import { fileURLToPath } from 'node:url'
import supportsColor from 'supports-color'
import { parse } from 'error-stack-parser-es'
import { Colors } from '@poppinss/colors/types'

import { Group, Runner, Test } from '../modules/core/main.js'

export const colors: Colors = supportsColor.stdout ? useColors.ansi() : useColors.silent()

/**
 * A collection of platform specific icons
 */
export const icons =
  process.platform === 'win32' && !process.env.WT_SESSION
    ? {
        tick: '√',
        cross: '×',
        bullet: '*',
        nodejs: '♦',
        pointer: '>',
        info: 'i',
        warning: '‼',
        branch: ' -',
        squareSmallFilled: '[█]',
      }
    : {
        tick: '✔',
        cross: '✖',
        bullet: '●',
        nodejs: '⬢',
        pointer: '❯',
        info: 'ℹ',
        warning: '⚠',
        branch: '└──',
        squareSmallFilled: '◼',
      }

/**
 * Returns a formatted string to print the information about
 * a pinned test
 */
export function formatPinnedTest(test: Test) {
  let fileName: string = ''
  let line: number = 0
  let column: number = 0

  /**
   * Throwing an error using the "meta.abort" method which will help
   * us find the test location by parsing error stack frame
   */
  try {
    test.options.meta.abort('Finding pinned test location')
  } catch (error) {
    const frame = parse(error).find(
      (f) =>
        f.fileName &&
        f.lineNumber !== undefined &&
        f.columnNumber !== undefined &&
        !f.fileName.includes('node:') &&
        !f.fileName.includes('ext:') &&
        !f.fileName.includes('node_modules/')
    )

    if (frame) {
      fileName = frame.fileName!.startsWith('file:')
        ? string.toUnixSlash(fileURLToPath(frame.fileName!))
        : string.toUnixSlash(frame.fileName!)

      line = frame.lineNumber!
      column = frame.columnNumber!
    }
  }

  return `${colors.yellow(` ⁃ ${test.title}`)}\n${colors.dim(`   ${fileName}:${line}:${column}`)}`
}

/**
 * Prints a summary of all the pinned tests
 */
export function printPinnedTests(runner: Runner) {
  let pinnedTests: string[] = []
  runner.suites.forEach((suite) => {
    suite.stack.forEach((testOrGroup: Test | Group) => {
      if (testOrGroup instanceof Group) {
        testOrGroup.tests.forEach(($test) => {
          if ($test.isPinned) {
            pinnedTests.push(formatPinnedTest($test))
          }
        })
      } else if (testOrGroup.isPinned) {
        pinnedTests.push(formatPinnedTest(testOrGroup))
      }
    })
  })

  if (pinnedTests.length) {
    console.log(colors.bgYellow().black(` ${pinnedTests.length} pinned test(s) found `))
    pinnedTests.forEach((row) => console.log(row))
  } else {
    console.log(colors.bgYellow().black(` No pinned tests found `))
  }
}
