import { dot } from '../src/reporters/main.js'
import { createDiverseTests, runner } from '../factories/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [dot()],
      activated: ['dot'],
    },
  })
  .runSuites(createDiverseTests)
