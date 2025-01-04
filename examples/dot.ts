import { dot } from '../src/reporters/main.js'
import { createDummyTests, runner } from '../factories/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [dot()],
      activated: ['dot'],
    },
  })
  .runSuites(createDummyTests)
