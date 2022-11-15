import { createServer } from 'vercel-node-server'
import helloLambda from '../index.js'

const server = createServer(helloLambda)

// start listening on port 8000
server.listen(8000)
