import got from 'got'
import parse from 'parse-apache-directory-index'

import { parsePbn } from './parse-pbn.js'

const IS_TEST = process.env.NODE_ENV === 'test'
const BASE_URL = process.env.BASE_URL || ''
const BASE_PATH = process.env.BASE_PATH || ''

async function getClub(club) {
  if (!BASE_URL) {
    throw new Error('Missing env BASE_URL')
  }
  const url = `${BASE_URL}${BASE_PATH}${club}`
  const { body } = await got(url)
  const { files } = parse(body)
  const data = files
    .filter(({ type, path }) => {
      return type === 'file' && path.includes('.pbn')
    })
    .map(({ name, path, lastModified, size }) => {
      const date = new Date(lastModified)
      const fullPath = `${BASE_URL}${path}`
      return {
        name,
        date,
        url: `/?pbn=${encodeURIComponent(fullPath)}`,
        size,
        pbn: fullPath,
      }
    })
    .sort((a, b) => {
      return a.date.getTime() > b.date.getTime() ? -1 : 1
    })
  return {
    data,
  }
}

async function getResult(url) {
  const { body } = await got(url, {
    hooks: {
      afterResponse: [
        (response) => {
          response.body = response.rawBody.toString('latin1')
          return response
        },
      ],
    },
  })
  const data = parsePbn(body)
  return data
}

const handler = async (req, res) => {
  try {
    let { club = '', pbn = '' } = req.query
    let payload = { message: 'Hello world' }
    if (club) {
      payload = await getClub(club)
    }
    if (pbn) {
      payload = await getResult(pbn)
    }
    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=86400, stale-while-revalidate'
    )
    if (IS_TEST) {
      return payload
    } else {
      return res.status(200).json(payload)
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    })
  }
}

export default handler
