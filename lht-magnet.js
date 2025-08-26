#!/usr/bin/env node

import { program } from 'commander'
import { LhtClient } from './lht-client.js'
import { createMagnetLink } from './magnet.js'

program
  .arguments('<infoHash>')
  .option('-i, --network-interface <interface>', 'The network interface whose IPV4 address will be used to join the LSD multicast group')
  .option('-b, --bind', 'Use interface for binding the UDP socket')
  .action(infoHash => {
    const options = program.opts()

    const client = new LhtClient(infoHash, options.networkInterface, options.bind)

    client.on('lht', (announce) => {
      const { peer: peers } = announce

      console.log(createMagnetLink(infoHash, peers))
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
