import { spec } from '../src/reporters/main.js'
import { createDiverseTests, runner } from '../factories/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [spec()],
      activated: ['spec'],
    },
  })
  .runSuites(createDiverseTests)
