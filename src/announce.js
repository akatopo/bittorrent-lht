import { LSD_HOST, LSD_PORT } from './lsd-constants.js'
import Debug from 'debug'
const debug = Debug('bittorrent-lht:announce')

export function lhtAnnounce (infoHash, cookie, peers = []) {
  const host = `${LSD_HOST}:${LSD_PORT}`
  const peerSection = peers.map(p => `peer: ${p}`).join('\r\n')

  return `BT-LHT * HTTP/1.1\r\nHost: ${host}\r\nPort: 0\r\nInfohash: ${infoHash}\r\ncookie: ${cookie}\r\n${peerSection}\r\n\r\n`
}

export function checkLsdHost (host) {
  return /^(239.192.152.143|\[ff15::efc0:988f]):6771$/.test(host)
}

export function checkPort (port) {
  return /^\d+$/.test(port)
}

export function checkInfoHash (infoHash) {
  return /^[0-9a-fA-F]{40}$/.test(infoHash)
}

export function parseAnnounce (announce, err = () => undefined) {
  debug('parse announce', announce)
  const sections = announce.split('\r\n')

  if (
    sections[0] !== 'BT-SEARCH * HTTP/1.1' &&
      sections[0] !== 'BT-LHT * HTTP/1.1'
  ) {
    err('Invalid LSD or LHT announce (header)')
    return null
  }
  const type = sections[0] === 'BT-SEARCH * HTTP/1.1' ? 'LSD' : 'LHT'

  const host = sections[1].split('Host: ')[1]

  if (type === 'LSD' && !checkLsdHost(host)) {
    err(`Invalid ${type} announce (host)`)
    return null
  }

  const port = sections[2].split('Port: ')[1]

  if (!checkPort(port)) {
    err(`Invalid ${type} announce (port)`)
    return null
  }

  const infoHash = sections
    .filter((section) => section.includes('Infohash: '))
    .map((section) => section.split('Infohash: ')[1])
    .filter((infoHash) => checkInfoHash(infoHash))

  if (infoHash.length === 0) {
    err(`Invalid ${type} announce (infoHash)`)
    return null
  }

  const cookie = sections
    .filter((section) => section.includes('cookie: '))
    .map((section) => section.split('cookie: ')[1])
    .reduce((acc, cur) => cur, null)

  // TODO peer check for arbitrary ipv4/ipv6 port pair for LHT
  const peer = sections
    .filter((section) => section.includes('peer: '))
    .map((section) => section.split('peer: ')[1])

  return {
    host,
    port,
    infoHash,
    cookie,
    peer,
    type
  }
}
