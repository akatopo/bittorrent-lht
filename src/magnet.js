export function createMagnetLink (infoHash, peers = []) {
  const peerParams = peers.map(p => `&x.pe=${p}`).join('')

  return `magnet:?xt=urn:btih:${infoHash}${(peerParams)}`
}
