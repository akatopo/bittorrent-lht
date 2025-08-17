import { EventEmitter } from 'events'
import Debug from 'debug'
import { Lht } from './lht.js'
import { lhtAnnounce } from './announce.js'

const debug = Debug('bittorrent-lht:lht-in-memory-table')
const twentyMinutes = 20 * 60 * 1000

function getKey (infoHash, peer) {
  return JSON.stringify([infoHash, peer])
}

export class LhtInMemoryTable extends EventEmitter {
  constructor () {
    super()
    this.lht = new Lht()
    this.infoHashPeerMap = new Map()
    this.infoHashAndPeerTimeoutMap = new Map()

    this.lht.on('peer', (...args) => {
      const { infoHashPeerMap, infoHashAndPeerTimeoutMap } = this
      const [peer, infoHash] = args

      const peersForHash = infoHashPeerMap.get(infoHash) ?? new Set()
      peersForHash.add(peer)
      infoHashPeerMap.set(infoHash, peersForHash)
      const key = getKey(infoHash, peer)
      const timeout = infoHashAndPeerTimeoutMap.get(key)
      if (timeout) {
        clearTimeout(timeout)
      }
      infoHashAndPeerTimeoutMap.set(key, setTimeout(() => {
        debug(`removing ${key} from timeout map`)

        infoHashAndPeerTimeoutMap.delete(key)
        const peers = infoHashPeerMap.get(infoHash)
        peers?.delete(peer)
        if (peers?.size === 0) {
          infoHashPeerMap.delete(infoHash)
        }
      }, twentyMinutes))
      this.emit('peer', peer, infoHash)
    })

    this.lht.on('lht', (...args) => {
      const { infoHashPeerMap } = this
      const [infoHash] = args
      const peers = infoHashPeerMap.get(infoHash) ?? new Set()
      if (peers.size) {
        const peer = [...peers.values()][0]
        const announce = lhtAnnounce(infoHash, this.lht.cookie, peer)
        this.lht.send(announce)
        this.emit('lht', announce)
        debug(`LHT announce for ${infoHash} from peer`)
      }
    })
  }

  get infoHashPeerTable () {
    const { infoHashPeerMap } = this
    return [...infoHashPeerMap.entries()].map(([infoHash, peers]) => [infoHash, [...peers.values()]])
  }

  start () {
    this.lht.start()
  }

  destroy (cb) {
    const { infoHashAndPeerTimeoutMap } = this
    infoHashAndPeerTimeoutMap.forEach(timeout => {
      clearTimeout(timeout)
    })
    return this.lht.destroy(cb)
  }
}
