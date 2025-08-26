/*! bittorrent-lsd. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */

import dgram from 'dgram'
import { EventEmitter } from 'events'
import Debug from 'debug'
import os from 'os'

import { LSD_HOST, LSD_PORT } from './lsd-constants.js'

const debug = Debug('bittorrent-lht:base')
export const cookiePrefix = 'bittorrent-lht-'

// TODO: Implement IPv6

export class LhtBase extends EventEmitter {
  constructor (interfaceForMembership, useInterfaceForBinding = false) {
    super()
    const interfacesWithIpv4 = Object.fromEntries(
      Object.entries(os.networkInterfaces())
        .filter(([, info]) => info.some((i) => !i.internal))
        .map(([iface, info]) => info.some((i) => i.family === 'IPv4') ? [iface, info.filter(i => i.family === 'IPv4')] : undefined)
        .filter(x => !!x)
    )

    this.membershipIp = interfacesWithIpv4[interfaceForMembership]?.[0].address ?? undefined
    const { membershipIp } = this
    if (!membershipIp && interfaceForMembership) {
      const msg = 'provided interface does not match OS interfaces or does not have an IPV4'
      this.emit('warning', msg)
      debug('lht warning', msg)
    }

    this.useInterfaceForBinding = useInterfaceForBinding

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

    const onError = (err) => {
      this.emit('error', err)
    }

    this.server.on('listening', onListening)
    // this.server.on('message', onMessage)
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

    const { useInterfaceForBinding, membershipIp } = this

    this.server.bind(LSD_PORT, useInterfaceForBinding ? membershipIp : undefined)
  }
}
