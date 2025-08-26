import os from 'os'
import crypto from 'crypto'
import { LhtBase } from './lht-base.js'
import Debug from 'debug'

import { parseAnnounce, lhtAnnounce, checkInfoHash } from './announce.js'

const debug = Debug('bittorrent-lht:lht-client')
const cookiePrefix = 'bittorrent-lht-client-'

export class LhtClient extends LhtBase {
  constructor (infoHash, interfaceForMembership, useInterfaceForBinding = false) {
    super(interfaceForMembership, useInterfaceForBinding)

    if (!checkInfoHash(infoHash)) {
      throw new Error('Invalid infohash provided')
    }

    this.cookie = `${cookiePrefix}${os.hostname()}-${crypto.randomBytes(10).toString('hex')}`
    this.infoHash = infoHash

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

    const { server } = this

    server.on('message', onMessage)
  }

  send () {
    const { cookie, infoHash } = this

    debug('send')
    super.send(lhtAnnounce(infoHash, cookie))
  }
}
