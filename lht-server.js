#!/usr/bin/env node

import { LhtInMemoryTable as Server } from './lht-in-memory-table.js'
import { program } from 'commander'

program
  .option('-i, --network-interface <interface>', 'The network interface whose IPV4 address will be used to join the LSD multicast group')
  .parse()

const options = program.opts()

const server = new Server(options.networkInterface ?? undefined)

server.start()
