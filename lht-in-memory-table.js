import { EventEmitter } from 'events'
import Debug from 'debug'
import { Lht } from './lht.js'
import { lhtAnnounce, checkInfoHash } from './announce.js'
import { createMagnetLink } from './magnet.js'
import http from 'http'
import Router from 'find-my-way'

const debug = Debug('bittorrent-lht:lht-in-memory-table')
const twentyMinutes = 20 * 60 * 1000

const defaults = {
  interfaceForMembership: undefined,
  httpServerHost: 'localhost',
  httpServerPort: 0
}

function getKey (infoHash, peer) {
  return JSON.stringify([infoHash, peer])
}

function createHttpServer (lhtInMemoryTable) {
  const router = Router()

  router.on('GET', '/lht', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify(lhtInMemoryTable.infoHashPeerTable))
  })

  router.on('GET', '/lht/:infoHash', (req, res, params) => {
    const { infoHash } = params
    res.setHeader('Content-Type', 'application/json')
    const notFound = () => {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Resource not found' }))
    }
    if (!checkInfoHash(infoHash)) {
      return notFound()
    }
    debug(`query ${infoHash}`)
    const peers = lhtInMemoryTable.peersFromInfoHash(infoHash)
    if (!peers.length) {
      return notFound()
    }

    res.writeHead(200)
    res.end(JSON.stringify(peers))
  })

  router.on('GET', '/magnet/:infoHash', (req, res, params) => {
    const { infoHash } = params
    res.setHeader('Content-Type', 'application/json')
    const notFound = () => {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Resource not found' }))
    }
    if (!checkInfoHash(infoHash)) {
      return notFound()
    }
    debug(`query ${infoHash}`)
    const peers = lhtInMemoryTable.peersFromInfoHash(infoHash)
    if (!peers.length) {
      return notFound()
    }

    res.writeHead(200)
    res.end(JSON.stringify(createMagnetLink(infoHash, peers)))
  })

  const httpServer = http.createServer((req, res) => router.lookup(req, res))

  return { httpServer, router }
}

export class LhtInMemoryTable extends EventEmitter {
  constructor ({
    interfaceForMembership = defaults.interfaceForMembership,
    httpServerHost = defaults.httpServerHost,
    httpServerPort = defaults.httpServerPort
  } = { ...defaults }) {
    super()
    this.lht = new Lht(interfaceForMembership)

    this.infoHashPeerMap = new Map()
    this.infoHashAndPeerTimeoutMap = new Map()

    const { httpServer } = createHttpServer(this)
    this.httpServer = httpServer
    httpServer.on('listening', () => {
      const { port } = httpServer.address()
      debug(`Server is listening on http://${httpServerHost}:${port}`)
    })
    httpServer.listen(httpServerPort, httpServerHost)

    this.lht.on('peer', (...args) => {
      const [peer, infoHash] = args

      this.addPeer(peer, infoHash)
      this.emit('peer', peer, infoHash)
    })

    this.lht.on('lht', (...args) => {
      const [infoHash] = args
      const peers = this.peersFromInfoHash(infoHash)
      if (peers.length) {
        // const peer = peers[0]
        const announce = lhtAnnounce(infoHash, this.lht.cookie, peers)
        this.lht.send(announce)
        this.emit('lht', announce)
        debug(`LHT announce for ${infoHash}: ${peers}`)
      }
    })
  }

  get infoHashPeerTable () {
    const { infoHashPeerMap } = this
    return [...infoHashPeerMap.entries()].map(([infoHash, peers]) => [infoHash, [...peers.values()]])
  }

  peersFromInfoHash (infoHash) {
    const { infoHashPeerMap } = this
    const peers = infoHashPeerMap.get(infoHash) ?? new Set()

    return [...peers.values()]
  }

  addPeer (peer, infoHash) {
    const { infoHashPeerMap, infoHashAndPeerTimeoutMap } = this

    const peersForHash = infoHashPeerMap.get(infoHash) ?? new Set()
    peersForHash.add(peer)
    infoHashPeerMap.set(infoHash, peersForHash)
    const key = getKey(infoHash, peer)
    const timeout = infoHashAndPeerTimeoutMap.get(key)
    if (timeout) {
      clearTimeout(timeout)
    }
    infoHashAndPeerTimeoutMap.set(key, setTimeout(() => {
      debug(`removing ${key} from timeout map and LHT`)

      infoHashAndPeerTimeoutMap.delete(key)
      const peers = infoHashPeerMap.get(infoHash)
      peers?.delete(peer)
      if (peers?.size === 0) {
        infoHashPeerMap.delete(infoHash)
      }
    }, twentyMinutes))
  }

  start () {
    this.lht.start()
  }

  destroy (cb) {
    const { infoHashAndPeerTimeoutMap } = this
    infoHashAndPeerTimeoutMap.forEach(timeout => {
      clearTimeout(timeout)
    })
    this.httpServer.close(() => this.httpServer.closeAllConnections())
    return this.lht.destroy(cb)
  }
}
