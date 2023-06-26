import { runner } from '../factories/main.js'
import { dot } from '../src/reporters/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [dot()],
      activated: ['dot'],
    },
  })
  .run()
