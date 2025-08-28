#!/usr/bin/env node

import { program } from 'commander'
import { LhtClient } from './lht-client.js'
import { createMagnetLink } from './magnet.js'

program
  .name('lht-magnet')
  .arguments('<infoHash>')
  .option('-i, --network-interface <interface>', 'The network interface whose IPv4 address will be used to join the LSD multicast group, does nothing interface is not valid')
  .option('-b, --bind', 'Use interface for binding the UDP socket, does nothing if no valid interface is defined via -i/--network-interface')
  .option('-t --type <magnet|peerflix>', 'Command output type. Use magnet to print a magnet link and peerflix to print a peerflix command invocation', 'magnet')
  .addHelpText(
    'after', `

Examples:
  $ ${program.name()} f861ca444ce516cce8ca08ad640200ed6520f81e – Get a magnet link with local peers for the provided info hash
  $ ${program.name()} -i en0 f861ca444ce516cce8ca08ad640200ed6520f81e – Same but use en0's public IPv4 address to join the LSD multicast group
  $ sh -c "$(${program.name()} -t peerflix f861ca444ce516cce8ca08ad640200ed6520f81e)" – Execute peerflix with the fetched magnet link and local peers`
  )
  .action(infoHash => {
    const { networkInterface, bind, type } = program.opts()

    const client = new LhtClient(infoHash, networkInterface, bind)

    client.on('lht', (announce) => {
      const { peer: peers } = announce

      switch (type) {
        case 'peerflix':
          {
            const peerParams = peers.map(p => `-e '${p}'`).join(' ')

            console.log(`peerflix '${createMagnetLink(infoHash, peers)}' ${peerParams} --vlc`)
          }
          break
        case 'magnet':
        default:
          console.log(createMagnetLink(infoHash, peers))
          break
      }
      client.destroy()
      process.exit()
    })

    client.start()

    client.send()
    setTimeout(() => {
      client.send()
    }, 2_000)
    setInterval(() => {
      client.send()
    }, 60_000)
  })
  .parse()
