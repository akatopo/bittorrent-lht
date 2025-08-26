import test from 'tape'
import sinon from 'sinon'
import dgram from 'dgram'

import { LhtInMemoryTable as Server } from '../lht-in-memory-table.js'
import { cookiePrefix } from '../lht.js'
import { lhtAnnounce, parseAnnounce } from '../announce.js'
import { LSD_PORT, LSD_HOST } from '../lsd-constants.js'

const tenMinutes = 10 * 60 * 1000

test('should add a peer to an infohash entry in the LHT', t => {
  const server = new Server()
  const client = dgram.createSocket('udp4')

  const host = `${LSD_HOST}:${LSD_PORT}`
  const port = '51413'
  const infoHash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

  client.connect(LSD_PORT, LSD_HOST, (err) => {
    if (err) {
      t.error(err)
    }

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${infoHash}\r\n\r\n\r\n`
    client.send(announce)
    client.close()
  })

  server.on('peer', (peer) => {
    t.equal(server.infoHashPeerTable.length, 1)
    t.deepEqual(server.infoHashPeerTable, [[infoHash, [peer]]])
    server.destroy(() => t.end())
  })

  server.start()
})

test('should add multiple peers to an infohash entry in the LHT', t => {
  const server = new Server()

  const peers = [
    '10.42.0.1:51413',
    '10.42.0.10:51413',
    '10.42.0.100:51413'
  ]
  const infoHash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

  const tests = (function * () {
    for (let counter = 1; counter < peers.length + 1; counter++) {
      t.deepEqual(server.infoHashPeerTable, [[infoHash, peers.slice(0, counter)]])
      yield (counter === peers.length ? server.destroy(() => t.end()) : true)
    }
  })()

  server.on('peer', () => tests.next())

  server.start()

  peers.forEach((p, i) => server.lht.emit('peer', p, infoHash))
})

test('should remove a peer from the LHT after 20 minutes of LSD announce inactivity', t => {
  const clock = sinon.useFakeTimers(new Date())
  t.teardown(() => {
    clock.restore()
  })
  const server = new Server()
  const client = dgram.createSocket('udp4')

  const host = `${LSD_HOST}:${LSD_PORT}`
  const port = '51413'
  const infoHash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

  client.connect(LSD_PORT, LSD_HOST, (err) => {
    if (err) {
      t.error(err)
    }

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${infoHash}\r\n\r\n\r\n`
    client.send(announce)
    client.close()
  })

  server.on('peer', (peer) => {
    t.deepEqual(server.infoHashPeerTable, [['F60AE72E07713D4F14878A5B24ADB34992401AC9', [peer]]])

    clock.tick(tenMinutes)

    t.deepEqual(server.infoHashPeerTable, [['F60AE72E07713D4F14878A5B24ADB34992401AC9', [peer]]])

    clock.tick(tenMinutes)

    t.equal(server.infoHashPeerTable.length, 0)

    server.destroy(() => t.end())
  })

  server.start()
})

test('should remove a peer from the LHT after 20 minutes of LSD announce inactivity from multiple infohash entries', t => {
  const clock = sinon.useFakeTimers(new Date())
  t.teardown(() => {
    clock.restore()
  })
  const server = new Server()

  const peersInfoHashes = [
    ['10.42.0.1:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC9'],
    ['10.42.0.10:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC9'],
    ['10.42.0.100:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC9'],
    ['10.42.0.100:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC8'],
    ['10.42.0.100:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC7']
  ]

  const tests = (function * () {
    const peers = peersInfoHashes.map(p => p[0])
    for (let counter = 0; counter < peersInfoHashes.length - 1; counter++) {
      yield
    }

    t.deepEqual(server.infoHashPeerTable, [
      ['F60AE72E07713D4F14878A5B24ADB34992401AC9', peers.slice(0, 3)],
      ['F60AE72E07713D4F14878A5B24ADB34992401AC8', [peers[2]]],
      ['F60AE72E07713D4F14878A5B24ADB34992401AC7', [peers[2]]]
    ])

    clock.tick(tenMinutes)

    t.deepEqual(server.infoHashPeerTable, [
      ['F60AE72E07713D4F14878A5B24ADB34992401AC9', peers.slice(0, 3)],
      ['F60AE72E07713D4F14878A5B24ADB34992401AC8', [peers[2]]],
      ['F60AE72E07713D4F14878A5B24ADB34992401AC7', [peers[2]]]
    ])
    yield 're-announce'

    yield

    clock.tick(tenMinutes)

    t.deepEqual(server.infoHashPeerTable, [
      ['F60AE72E07713D4F14878A5B24ADB34992401AC9', peers.slice(0, 2)]
    ])

    server.destroy(() => t.end())
    yield

    t.fail('more peer emits than expected')
  })()

  server.on('peer', () => {
    if (tests.next().value === 're-announce') {
      peersInfoHashes.slice(0, 2).forEach(([peer, infoHash]) => server.lht.emit('peer', peer, infoHash), 0)
    }
  })

  server.start()

  peersInfoHashes.forEach(([peer, infoHash]) => server.lht.emit('peer', peer, infoHash))
})

test('should do an LHT announce when receiving an LHT announce w/ a cookie that is not the same as the announcer', t => {
  const server = new Server()
  const client = dgram.createSocket('udp4')

  const announceHash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const peersInfoHashes = [
    ['10.42.0.1:51413', announceHash],
    ['10.42.0.10:51413', announceHash],
    ['10.42.0.100:51413', announceHash],
    ['10.42.0.100:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC8'],
    ['10.42.0.100:51413', 'F60AE72E07713D4F14878A5B24ADB34992401AC7']
  ]

  const peerTests = (function * () {
    for (let counter = 0; counter < peersInfoHashes.length - 1; counter++) {
      yield
    }
    client.connect(LSD_PORT, LSD_HOST, (err) => {
      if (err) {
        t.error(err)
      }

      const badAnnounce = lhtAnnounce('DEADBEEF07713D4F14878A5B24ADB34992401AC8', `${server.lht.cookie}`)
      const announce = lhtAnnounce(announceHash, 'a-cookie')
      client.send(badAnnounce)
      client.send(announce)
      client.close()
    })
    yield

    t.fail('more peer emits than expected')
  })()

  server.on('peer', () => {
    peerTests.next()
  })

  server.on('lht', (announce) => {
    const { port, type, infoHash, cookie } = parseAnnounce(announce, (err) => t.error(err))
    t.equal(type, 'LHT')
    t.deepEqual(infoHash, [announceHash])
    t.true(cookie.startsWith(cookiePrefix))
    t.equal(port, '0')
    server.destroy(() => t.end())
  })

  server.start()

  peersInfoHashes.forEach(([peer, infoHash]) => server.lht.emit('peer', peer, infoHash))
})
