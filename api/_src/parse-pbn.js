import pbn from 'pbn'
import { Readable } from 'stream'

function text(doc) {
  const s = new Readable()
  s.push(doc)
  s.push(null)
  return s
}

function parse(line) {
  const row = line.trim().replace(/\s+/g, ' ')
  let insideQuote = false,
    entries = [],
    entry = []
  row.split('').forEach(function (character) {
    if (character === '"') {
      insideQuote = !insideQuote
    } else {
      if (character === ' ' && !insideQuote) {
        entries.push(entry.join(''))
        entry = []
      } else {
        entry.push(character)
      }
    }
  })
  entries.push(entry.join(''))
  return entries
}

function parseOptimumResultTable(chunk) {
  const all = chunk.section.map((line) => parse(line))
  const header = ['S', 'H', 'D', 'C', 'NT']
  const lineHelper = (hand) => {
    const inHand = all.filter(([first]) => first === hand)
    return [
      hand,
      header.map((head) => {
        const found = inHand.find(([_, second]) => second === head)
        if (found && found.length === 3) {
          return parseInt(found[2])
        }
        return '-'
      }),
    ]
  }
  const lines = [
    lineHelper('N'),
    lineHelper('S'),
    lineHelper('E'),
    lineHelper('W'),
  ]
  const hands = 'NSEW'.split('')
  let data = []
  let computed = []
  hands.forEach((hand) => {
    if (!computed.includes(hand)) {
      const [_, cards] = lines.find(([itemHand]) => itemHand === hand)
      const signatur = cards.join(',')
      const others = lines.filter(([itemHand, itemCards]) => {
        if (itemHand !== hand) {
          const str = itemCards.join(',')
          if (str === signatur) {
            return true
          }
        }
        return false
      })
      const keys = [hand, ...others.map(([hand]) => hand)]
      computed = computed.concat(keys)
      const values = Object.fromEntries(
        cards.map((card, i) => [header[i].toLocaleLowerCase(), card])
      )
      data.push({
        declarer: keys.join('').toLocaleLowerCase(),
        ...values,
      })
    }
  })

  return {
    header: ['declarer', ...header].map((name) => {
      return {
        name: name.toLocaleLowerCase(),
      }
    }),
    data,
  }
}

function parseTable(chunk, filterDownCase = []) {
  const header = chunk.value.split(';').map((value) => {
    const [name, info] = value.split('\\')
    return {
      name: name.toLowerCase(),
      align: info.substring(info.length - 1).toLocaleLowerCase(),
      chars: parseInt(info.substring(0, info.length - 1)),
    }
  })
  return {
    header,
    data: chunk.section.map((line) => {
      return Object.fromEntries(
        parse(line).map((value, i) => {
          const head = header[i]
          let parsedValue = head.align === 'r' ? parseFloat(value) : value
          if (isNaN(parsedValue)) {
            parsedValue = value
          }
          if (filterDownCase.includes(head.name)) {
            parsedValue = parsedValue.toLocaleLowerCase()
          }
          if (head.name === 'contract') {
            parsedValue = parsedValue.replace('n', 'nt')
          }
          return [head.name, parsedValue]
        })
      )
    }),
  }
}

function filterTable(table, filter = []) {
  const { header: headerAll, data } = table
  const header = headerAll.filter(({ name }) => filter.includes(name))
  header.sort((a, b) => {
    const posA = filter.indexOf(a.name)
    const posB = filter.indexOf(b.name)
    return posA > posB ? 1 : -1
  })
  return {
    header,
    data: data.map((item) => {
      let data = {}
      filter.forEach((filter) => {
        if (item[filter]) {
          data[filter] = item[filter]
        }
      })
      return data
    }),
  }
}

function getCards(cards, seat) {
  return cards
    .filter((item) => item.seat === seat)
    .map(({ suit, rank }) => `${suit}${rank}`)
    .join(',')
    .toLocaleLowerCase()
}
function camelCase(name) {
  const [first, ...chars] = name
  return `${first.toLowerCase()}${chars.join('')}`
}

const defaultConfig = {
  singleValues: ['Event', 'Annotator', 'Competition', 'EventDate'],
  downCase: [
    'Competition',
    'Vulnerable',
    'Dealer',
    'OptimumContract',
    'OptimumScore',
  ],
  singleValuesGame: ['Vulnerable', 'Dealer', 'OptimumScore', 'OptimumContract'],
  totalScoreTableKeys: [
    'rank',
    'playerid',
    'pairid',
    'teamid',
    'name',
    'roster',
    'names',
    'club',
    'team',
    'teamname',
    'totalscoremp',
    'totalpercentage',
    'totalscorevp',
    'totalscoreimp',
  ],
  scoreTableKeys: [
    'playerid_north',
    'playerid_south',
    'playerid_east',
    'playerid_west',
    'pairid_ns',
    'pairid_ew',
    'round',
    'contract',
    'declarer',
    'result',
    'lead',
    'score_ns',
    'score_ew',
    'mp_north',
    'mp_east',
    'mp_ns',
    'mp_ew',
    'imp_ns',
    'imp_ew',
    'butlerdatum',
  ],
  downCaseScoreTable: ['contract', 'declarer', 'lead'],
}

export async function parsePbn(doc, userConfig = {}) {
  const config = {
    ...defaultConfig,
    ...userConfig,
  }
  function formatValue(name, value) {
    return config.downCase.includes(name) ? value.toLocaleLowerCase() : value
  }
  return new Promise((resolve, reject) => {
    let data = {}
    let game = null
    let games = []
    text(doc)
      .pipe(pbn())
      .on('data', (chunk) => {
        if (config.singleValues.includes(chunk.name)) {
          const key = camelCase(chunk.name)
          data[key] = formatValue(chunk.name, chunk.value)
          if (key === 'eventDate') {
            data[key] = new Date(data[key]).toISOString()
          }
        }
        if (chunk.name === 'TotalScoreTable') {
          data.totalScoreTable = filterTable(
            parseTable(chunk),
            config.totalScoreTableKeys
          )
        }
        // Game
        if (chunk.name === 'Board') {
          if (game) {
            games.push(game)
          }
          game = {
            number: parseInt(chunk.value),
          }
        }
        if (game) {
          if (config.singleValuesGame.includes(chunk.name)) {
            const key = camelCase(chunk.name)
            game[key] = formatValue(chunk.name, chunk.value)
            if (key === 'optimumContract') {
              let parts = game[key].split(' ')
              if (parts.length) {
                const first = parts[0].split('')
                if (first[first.length - 1] === 'n') {
                  parts[0] = parts[0].replace('n', 'nt')
                  game[key] = parts.join(' ')
                }
              }
            }
            if (key === 'optimumScore') {
              const old = game[key]
              let optimumScore = old.replace('ns ', '')
              if (!isNaN(parseInt(optimumScore))) {
                optimumScore = parseInt(optimumScore)
              }
              game[key] = optimumScore
            }
          }
          if (chunk.name === 'ScoreTable') {
            game.scoreTable = filterTable(
              parseTable(chunk, config.downCaseScoreTable),
              config.scoreTableKeys
            )
          }
          if (chunk.name === 'OptimumResultTable') {
            game.optimumResultTable = parseOptimumResultTable(chunk)
          }
          if (chunk.name === 'Deal' && chunk.cards && chunk.cards.length) {
            game.deal = {
              n: getCards(chunk.cards, 'N'),
              s: getCards(chunk.cards, 'S'),
              w: getCards(chunk.cards, 'W'),
              e: getCards(chunk.cards, 'E'),
            }
          }
        }
      })
      .on('end', () => {
        if (game && game.deal) {
          data.rounds = game.scoreTable.data[0].round
          games.push(game)
        }
        data.games = games
        resolve(data)
      })
      .on('error', reject)
  })
}
