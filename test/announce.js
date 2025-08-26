import test from 'tape'

import { Lht } from '../lht.js'
import { parseAnnounce } from '../announce.js'

test('should emit a warning when invalid announce header', t => {
  const lht = new Lht()

  lht.on('warning', err => {
    t.equal(err, 'Invalid LSD or LHT announce (header)')
  })

  const announce = 'INVALID ANNOUNCE'

  t.notok(parseAnnounce(announce, (err) => lht.emit('warning', err)))

  lht.destroy(() => {
    t.end()
  })
})

test('should emit a warning when invalid announce host', t => {
  const lht = new Lht()

  lht.on('warning', err => {
    t.equal(err, 'Invalid LSD announce (host)')
  })

  const host = '127.0.0.1:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  t.notok(parseAnnounce(announce, (err) => lht.emit('warning', err)))

  lht.destroy(() => {
    t.end()
  })
})

test('should emit a warning when invalid announce port', t => {
  const lht = new Lht()

  lht.on('warning', err => {
    t.equal(err, 'Invalid LSD announce (port)')
  })

  const host = '239.192.152.143:6771'
  const port = ''
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  t.notok(parseAnnounce(announce, (err) => lht.emit('warning', err)))

  lht.destroy(() => {
    t.end()
  })
})

test('should emit a warning when invalid announce infoHash', t => {
  const lht = new Lht()

  lht.on('warning', err => {
    t.equal(err, 'Invalid LSD announce (infoHash)')
  })

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihash = 'ABCD'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  t.notok(parseAnnounce(announce, (err) => lht.emit('warning', err)))

  lht.destroy(() => {
    t.end()
  })
})

test('should parse an announce without cookie', t => {
  const lht = new Lht()

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const type = 'LSD'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  const parsedAnnounce = parseAnnounce(announce)
  const expectedAnnounce = {
    peer: [],
    host,
    port,
    infoHash: [ihash],
    cookie: null,
    type
  }

  t.deepEqual(parsedAnnounce, expectedAnnounce)

  lht.destroy(() => {
    t.end()
  })
})

test('should parse an announce with a single infohash', t => {
  const lht = new Lht()

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const cookie = 'cookie'
  const type = 'LSD'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\ncookie: ${cookie}\r\n\r\n\r\n`

  const parsedAnnounce = parseAnnounce(announce)
  const expectedAnnounce = {
    peer: [],
    host,
    port,
    infoHash: [ihash],
    cookie,
    type
  }

  t.deepEqual(parsedAnnounce, expectedAnnounce)

  lht.destroy(() => {
    t.end()
  })
})

test('should parse an announce with multiple infohashes', t => {
  const lht = new Lht()

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihashA = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const ihashB = '562A86EFE4DC660E9D216A901D74338AF34205AA'
  const cookie = 'cookie'
  const type = 'LSD'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihashA}\r\nInfohash: ${ihashB}\r\ncookie: ${cookie}\r\n\r\n\r\n`

  const parsedAnnounce = parseAnnounce(announce)
  const expectedAnnounce = {
    peer: [],
    host,
    port,
    infoHash: [ihashA, ihashB],
    cookie,
    type
  }

  t.deepEqual(parsedAnnounce, expectedAnnounce)

  lht.destroy(() => {
    t.end()
  })
})

test('should parse an announce with ipv6 host', t => {
  const lht = new Lht()

  const host = '[ff15::efc0:988f]:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const cookie = 'cookie'
  const type = 'LSD'

  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\ncookie: ${cookie}\r\n\r\n\r\n`

  const parsedAnnounce = parseAnnounce(announce)
  const expectedAnnounce = {
    peer: [],
    host,
    port,
    infoHash: [ihash],
    cookie,
    type
  }

  t.deepEqual(parsedAnnounce, expectedAnnounce)

  lht.destroy(() => {
    t.end()
  })
})
