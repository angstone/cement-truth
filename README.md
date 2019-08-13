
# The Cement Truth Module

Store Level Zero Of Cement Framework: an EventStore

## what is that?

It is an EventStore, called LEVEL ZERO store of the framework.

This is where, in last instance, the "truth" about the data is stored.

All other store levels can be built based on a safe backup of this.
They all are considered just an "image" of the data.

## install

```
npm install @angstone/cement-truth
```

## usage

```
import { signature } from '@angstone/cement-basic'
signature()

import { error, logger } from '@angstone/cement-basic'
import {
  AGENTS /*, ITruthModule, LeveldbTruthModule */,
  IEvent,
  IEventTrusted,
  ITruthObserver,
  TruthModule as truth,
} from '@angstone/cement-truth'

// you can use your own implementation
// but it already works with own implementation
// using leveldb

// truth.useTruthModule(YourOwnTruthModule) // YourOwnTruthModule must implements ITruthModule
// truth.useTruthModule(LeveldbTruthModule) // optional already set

// you can set the default path for leveldb folder storage
/*
truth.config({
    levelDbPath: './your/db'
})
*/

// indeed you can just use it like this:
const event: IEvent = {
  type: 'user signed up', // required
  agent: AGENTS.SYSTEM_DEVELOPER, // the user, the system, you, the developer REQUIRED
  payload: {
    // payload is optional
    username: 'john',
    password: '1234',
  },
}

// note on agent: You can define your own interface
// it is stored as json object. the provided IAgent
// only contains "name" field

truth.registerEvent(event).then(eventNumber => {
  logger.note(eventNumber)
})
// or inside async
// const eventNumber = await truth.registerEvent(event)

// so you retrieve this way:
const someAsyncFunc = async (eventNumber: number) => {
  const event: IEventTrusted = await truth.retrieveEvent(eventNumber)
}

// and of course, there is no static truth in this world so..
// the MAIN FUNCTION:

truth.retrieveAllEvents().then((truthObserver: ITruthObserver) => {
  truthObserver.eventStream$.on('event', (event: IEventTrusted) => {
    // do amazing stuff with the past events with the ones that are about to come
  })
  truthObserver.eventStream$.once('live', () => {
    // now you know that all past was read and the next ones are new in live!
  })
})
```
