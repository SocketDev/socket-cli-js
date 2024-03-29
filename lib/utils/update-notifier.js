import { readFile } from 'node:fs/promises'

import updateNotifier from 'update-notifier'

/** @returns {void} */
export function initUpdateNotifier () {
  readFile(new URL('../../package.json', import.meta.url), 'utf8')
    .then(rawPkg => {
      /**
       * @type {Exclude<Parameters<typeof updateNotifier>[0], undefined>['pkg']}
       */
      const pkg = JSON.parse(rawPkg)
      updateNotifier({ pkg }).notify()
    })
    .catch(() => {
      // Fail silently if package.json could not be read or parsed
    })
}
