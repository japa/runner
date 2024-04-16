/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import useColors from '@poppinss/colors'
import supportsColor from 'supports-color'
import { Colors } from '@poppinss/colors/types'

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
        squareSmallFilled: '◼',
      }
