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
  constructor (interfaceForMembership) {
    super()
    const interfacesWithIpv4 = Object.fromEntries(
      Object.entries(os.networkInterfaces())
        .filter(([, info]) => info.some((i) => !i.internal))
        .map(([iface, info]) => info.some((i) => i.family === 'IPv4') ? [iface, info.filter(i => i.family === 'IPv4')] : undefined)
        .filter(x => !!x)
    )

    const membershipIp = interfacesWithIpv4[interfaceForMembership]?.[0].address ?? undefined
    if (!membershipIp && interfaceForMembership) {
      const msg = 'provided interface does not match OS interfaces or does not have an IPV4'
      this.emit('warning', msg)
      debug('lht warning', msg)
    }

    this.cookie = `${cookiePrefix}${os.hostname()}-${crypto.randomBytes(10).toString('hex')}`

    this.destroyed = false

    this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const onListening = () => {
      debug('listening')

      try {
        debug('addMembership', `LSD host: ${LSD_HOST}, membership IP: ${membershipIp ?? 'none'}`)
        this.server.addMembership(LSD_HOST, membershipIp)
      } catch (err) {
        debug('addMembership error', err)
        this.emit('warning', err)
      }
    }

    const onMessage = (msg, rinfo) => {
      debug('message', msg.toString(), `${rinfo.address}:${rinfo.port}`)

      const parsedAnnounce = parseAnnounce(msg.toString(), (error) => this.emit('warning', error))

      if (parsedAnnounce === null) return
      const { cookie, infoHash, port, type } = parsedAnnounce
      if ((cookie ?? '') === this.cookie) return

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
