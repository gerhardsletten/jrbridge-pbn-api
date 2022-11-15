import 'ava'
import { createServer } from 'vercel-node-server'
import test from 'ava'
import listen from 'test-listen'
import got from 'got'

import ApiService from '../index.js'

test('Should return hello world', async (t) => {
  const app = createServer(ApiService)
  const url = await listen(app)
  const { body, statusCode } = await got(`${url}`, { responseType: 'json' })
  t.is(statusCode, 200)
  t.is(body.message, 'Hello world')
})

test('Should return error on none pbn-files', async (t) => {
  const app = createServer(ApiService)
  const url = await listen(app)
  const file = encodeURIComponent(
    'https://www.bridge.no/var/ruter/html/0200/2022-03-02.htm'
  )
  const { body, statusCode } = await got(`${url}?pbn=${file}`, {
    responseType: 'json',
  })
  console.log(body)
  t.is(statusCode, 200)
  t.is(body.message, 'Hello world')
})
