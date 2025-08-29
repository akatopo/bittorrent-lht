import Debug from 'debug'
import os from 'os'
import crypto from 'crypto'

import { LhtBase } from './lht-base.js'

import { parseAnnounce } from './announce.js'

const debug = Debug('bittorrent-lht:lht')
export const cookiePrefix = 'bittorrent-lht-'

export class Lht extends LhtBase {
  constructor (interfaceForMembership) {
    super(interfaceForMembership)

    this.cookie = `${cookiePrefix}${os.hostname()}-${crypto.randomBytes(10).toString('hex')}`

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

    this.server.on('message', onMessage)
  }
}
