import dgram from 'dgram'
import os from 'os'
import crypto from 'crypto'
import { EventEmitter } from 'events'
import Debug from 'debug'

import { LSD_HOST, LSD_PORT } from './lsd-constants.js'
import { parseAnnounce, lhtAnnounce, checkInfoHash } from './announce.js'

const debug = Debug('bittorrent-lht:lht-client')
const cookiePrefix = 'bittorrent-lht-client-'

export class LhtClient extends EventEmitter {
  constructor (infoHash) {
    super()

    if (!checkInfoHash(infoHash)) {
      throw new Error('Invalid infohash provided')
    }

    this.cookie = `${cookiePrefix}${os.hostname()}-${crypto.randomBytes(10).toString('hex')}`
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.infoHash = infoHash
    this.destroyed = false

    const onListening = () => {
      debug('listening')

      try {
        this.socket.addMembership(LSD_HOST)
      } catch (err) {
        throw new Error("couldn't add membership")
      }
    }

    const onMessage = (msg, rinfo) => {
      debug('message', msg.toString(), `${rinfo.address}:${rinfo.port}`)

      const parsedAnnounce = parseAnnounce(msg.toString(), (err) => console.error(err))

      if (parsedAnnounce === null) return
      if (parsedAnnounce.type !== 'LHT') return
      // also ignore other clients
      if ((parsedAnnounce.cookie ?? '').startsWith(cookiePrefix)) return
      if (parsedAnnounce.infoHash[0] !== infoHash) return

      this.emit('lht', parsedAnnounce)
    }

    const { socket } = this

    socket.on('listening', onListening)
    socket.on('message', onMessage)
    socket.on('error', () => {})
  }

  send () {
    const { socket, cookie, infoHash } = this

    debug('send')
    socket.send(lhtAnnounce(infoHash, cookie), LSD_PORT, LSD_HOST)
  }

  destroy (cb) {
    if (this.destroyed) return
    this.destroyed = true
    debug('destroy')

    this.socket.close(cb)
  }

  start () {
    debug('start')
    this.socket.bind(LSD_PORT)
  }
}
