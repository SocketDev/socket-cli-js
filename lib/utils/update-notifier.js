import { readFile } from 'node:fs/promises'

import simpleUpdateNotifier from 'simple-update-notifier'

/** @returns {Promise<void>} */
export async function updateNotifier () {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  await simpleUpdateNotifier({ pkg })
}
