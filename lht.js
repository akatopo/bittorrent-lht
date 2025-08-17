/*! bittorrent-lsd. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */

import dgram from 'dgram'
import { EventEmitter } from 'events'
import Debug from 'debug'
import os from 'os'
import crypto from 'crypto'

import { LSD_HOST, LSD_PORT } from './lsd-constants.js'
import { parseAnnounce } from './announce.js'

const debug = Debug('bittorrent-lht')
export const cookiePrefix = 'bittorrent-lht-'

// TODO: Implement IPv6

export class Lht extends EventEmitter {
  constructor () {
    super()

    this.cookie = `${cookiePrefix}${os.hostname()}-${crypto.randomBytes(20).toString('hex')}`

    this.destroyed = false

    this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const onListening = () => {
      debug('listening')

      try {
        this.server.addMembership(LSD_HOST)
      } catch (err) {
        this.emit('warning', err)
      }
    }

    const onMessage = (msg, rinfo) => {
      debug('message', msg.toString(), `${rinfo.address}:${rinfo.port}`)

      const parsedAnnounce = parseAnnounce(msg.toString(), (error) => this.emit('warning', error))

      if (parsedAnnounce === null) return
      const { cookie, infoHash, port, type } = parsedAnnounce
      if ((cookie ?? '').startsWith(cookiePrefix)) return

      switch (type) {
        case 'LSD':
          infoHash.forEach((i) => {
            const peer = `${rinfo.address}:${port}`
            this.emit('peer', peer, i)
          })
          break
        case 'LHT':
          this.emit('lht', infoHash[0])
          break
        default:
          break
      }
    }

    const onError = (err) => {
      this.emit('error', err)
    }

    this.server.on('listening', onListening)
    this.server.on('message', onMessage)
    this.server.on('error', onError)
  }

  send (msg) {
    this.server.send(msg, LSD_PORT, LSD_HOST)
  }

  destroy (cb) {
    if (this.destroyed) return
    this.destroyed = true
    debug('destroy')

    this.server.close(cb)
  }

  start () {
    debug('start')
    this.server.bind(LSD_PORT)
  }
}
