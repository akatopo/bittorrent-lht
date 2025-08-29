import test from 'tape'
import sinon from 'sinon'
import dgram from 'dgram'
import os from 'os'

import { Lht } from '../src/lht.js'

test('should emit a warning when addMembership fails', t => {
  const lht = new Lht()
  t.teardown(() => {
    lht.server.addMembership.restore()
  })

  sinon.stub(lht.server, 'addMembership').throws()

  lht.on('warning', (err) => {
    t.ok(err)

    lht.destroy(() => t.end())
  })

  lht.start()
})

test('should emit peer when receiving a valid announce', t => {
  const lht = new Lht()
  const client = dgram.createSocket('udp4')

  const host = '239.192.152.143:6771'
  const port = '51413'
  const infoHash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

  client.connect(6771, '239.192.152.143', (err) => {
    if (err) {
      t.error(err)
    }

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${infoHash}\r\n\r\n\r\n`
    client.send(announce)
    client.close()
  })

  lht.on('error', (err) => {
    t.error(err)
  })

  lht.on('peer', (peerAddress, infoHash) => {
    const addresses = Object.values(os.networkInterfaces())
      .flatMap(i => i)
      .filter(i => !i.internal && i.family === 'IPv4')
      .map(i => `${i.address}:${port}`)

    t.ok(addresses.includes(peerAddress))
    t.equal(infoHash, infoHash)

    lht.destroy(() => t.end())
  })

  lht.start()
})
