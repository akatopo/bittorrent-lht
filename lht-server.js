#!/usr/bin/env node

import { LhtInMemoryTable as Server } from './lht-in-memory-table.js'
import { program } from 'commander'

program
  .option('-i, --network-interface <interface>', 'The network interface whose IPV4 address will be used to join the LSD multicast group')
  .option('-h, --http-host <host>', 'The host that the http server will listen to')
  .option('-p, --http-port <port>', 'The port that the http server will listen to')
  .parse()

const options = program.opts()

const server = new Server({
  interfaceForMembership: options.networkInterface,
  httpServerPort: options.httpPort,
  httpServerHost: options.httpHost
})

server.start()
