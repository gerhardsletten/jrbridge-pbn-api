import 'ava'
import test from 'ava'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { parsePbn } from '../parse-pbn.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function abbrTable({ header, data }) {
  return {
    header,
    xdata: data[0],
  }
}

test('Can parse a pbn type individuals', async (t) => {
  const file = await readFile(resolve(__dirname, './sample/individuals.pbn'), {
    encoding: 'utf8',
  })
  const data = await parsePbn(file)
  const { games, totalScoreTable, ...base } = data
  t.snapshot(base, 'Basic info')
  t.snapshot(abbrTable(totalScoreTable), 'totalScoreTable')
  const [{ scoreTable, ...game }] = games
  t.snapshot(game, 'game')
  t.snapshot(abbrTable(scoreTable), 'game scoreTable')
})
test('Can parse a pbn pairs', async (t) => {
  const file = await readFile(resolve(__dirname, './sample/pairs.pbn'), {
    encoding: 'utf8',
  })
  const data = await parsePbn(file)
  const { games, totalScoreTable, ...base } = data
  t.snapshot(base, 'Basic info')
  t.snapshot(abbrTable(totalScoreTable), 'totalScoreTable')
  const [{ scoreTable, ...game }] = games
  t.snapshot(game, 'game')
  t.snapshot(abbrTable(scoreTable), 'game scoreTable')
})
test('Can parse a pbn teams', async (t) => {
  const file = await readFile(resolve(__dirname, './sample/teams.pbn'), {
    encoding: 'utf8',
  })
  const data = await parsePbn(file)
  const { games, totalScoreTable, ...base } = data
  t.snapshot(base, 'Basic info')
  t.snapshot(abbrTable(totalScoreTable), 'totalScoreTable')
  t.is(games.length, 0)
})

test('Can parse a pbn teams - sub', async (t) => {
  const file = await readFile(resolve(__dirname, './sample/teams-sub.pbn'), {
    encoding: 'utf8',
  })
  const data = await parsePbn(file)
  const { games, totalScoreTable, ...base } = data
  t.snapshot(base, 'Basic info')
  t.snapshot(abbrTable(totalScoreTable), 'totalScoreTable')
  const [{ scoreTable, ...game }] = games
  t.snapshot(game, 'game')
  t.snapshot(abbrTable(scoreTable), 'game scoreTable')
})
