import { runner } from '../factories/main.js'
import { spec } from '../src/reporters/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [spec()],
      activated: ['spec'],
    },
  })
  .run()
