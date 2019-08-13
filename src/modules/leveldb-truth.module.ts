import * as events from 'events'
import * as path from 'path'
// for cleanup
import * as rimraf from 'rimraf'
/* tslint:disable:no-var-requires */
const level = require('level')
// for using integer++ as id
const lexi = require('lexicographic-integer')

import {
  error,
  IEvent,
  IEventStored,
  IEventTrusted,
  ITruthModule,
  ITruthObserver,
  logger,
  VOID_TRUTH,
} from '../'

// this key in db stores the current amount of events instead of a regular event
const KEY_OF_AMOUNT_OF_EVENTS: number = 0
export const DEFAULT_DB_NAME = 'db'
// try to increase that to give more time to db to work and shortening load effort
// tried that with no success.. avoid this design!
export const EVENT_REGISTER_LOCK_REST_TIME: number = 10
// this is funny but its a bad design, you know that
export const PATIENCE_FOR_WAITING_TO_REGISTER: number = 70 * 7
export const EVENT_STORE_VOID_ERROR = 'NO EVENTS YET, VOID STORE'
const LEVEL_DB_OPTIONS = {
  keyEncoding: {
    buffer: false,
    decode: lexi.unpack,
    encode: (dt: number) => lexi.pack(dt, 'hex'),
    type: 'lexicographic-integer',
  },
  valueEncoding: 'json',
}

const ASKED_EVENT_GREATER_THEN_LAST_REGISTERED_ERROR = `The eventNumber
provided for reading from is greater then last event registered
`
// const REGISTER_LOCKED_ERROR = 'The register is locked now. Please try later'
export const EVENT_NOT_FOUND_ERROR = `The event was not found in db.`
const EVENT_READ_ERROR = `EVENT_READ_ERROR`

export interface ITruthModuleConfig {
  levelDbPath?: string
}

interface ITruthModuleState {
  startedAt?: number
  starting: boolean
  lastEventNumber?: number
  // you must get rid of this somehow.. it IS a bad design!
  registeringLock: boolean
  truthObservers: ITruthObserver[]
  totalTruthsObservers: number
  eventRegister$: events.EventEmitter
  levelDbPath: string
  db?: any
}

const state: ITruthModuleState = {
  eventRegister$: new events.EventEmitter(),
  levelDbPath: path.join(__dirname, DEFAULT_DB_NAME),
  registeringLock: false,
  startedAt: undefined,
  starting: false,
  totalTruthsObservers: 0,
  truthObservers: [],
}

const config = (truthConfig?: ITruthModuleConfig) => {
  if (truthConfig) {
    if (truthConfig.levelDbPath) {
      state.levelDbPath = truthConfig.levelDbPath
    }
  }
}

const start = async () => {
  while (state.starting) {
    await new Promise(r => setTimeout(r, 10))
  }
  if (!state.startedAt) {
    state.starting = true
    await new Promise(resolveStartedDb => {
      level(state.levelDbPath, LEVEL_DB_OPTIONS, (err: any, db: any) => {
        if (err) {
          error.fatal(err)
        } else {
          state.db = db
          resolveStartedDb()
        }
      })
    })

    state.lastEventNumber = await getLastEventNumber()

    state.starting = false
    state.startedAt = Date.now()
    logger.note('LeveldbTruthModule started at ' + state.startedAt)
  }
}

const getLastEventNumber = async (): Promise<number> => {
  return new Promise<number>(resolveToNumber => {
    state.db!.get(
      KEY_OF_AMOUNT_OF_EVENTS,
      (err: any, numberOfEvents: number) => {
        if (err) {
          if (err.notFound) {
            resolveToNumber(0)
          } else {
            error.fatal(EVENT_READ_ERROR, err)
          }
        } else {
          resolveToNumber(numberOfEvents)
        }
      }
    )
  })
}

const stop = async () => {
  if (state.startedAt) {
    state.truthObservers.forEach((truth: ITruthObserver) => {
      releaseTruthObserver(truth)
    })

    await new Promise(closedResolved => {
      state.db!.close((err: any) => {
        if (err) {
          error.fatal(err)
        } else {
          closedResolved()
        }
      })
    })
    logger.note('LeveldbTruthModule stopped at ' + Date.now())

    state.startedAt = undefined
  }
}

const registerEvent = async (event: IEvent): Promise<number> => {
  if (!state.startedAt) {
    await start()
  }

  // let patience: number = 0
  // while (state.registeringLock) {
  //   if (patience > PATIENCE_FOR_WAITING_TO_REGISTER) {
  //     error.fatal(REGISTER_LOCKED_ERROR)
  //   }
  //   await new Promise(r => setTimeout(r, EVENT_REGISTER_LOCK_REST_TIME))
  //   patience++
  // }

  const createdAt = Date.now()

  const eventToRegister: IEventTrusted = {
    agent: event.agent,
    createdAt,
    number: ++state.lastEventNumber!,
    payload: event.payload,
    type: event.type,
  }

  return new Promise<number>(resolveToNumber => {
    state
      .db!.batch()
      .put(eventToRegister.number, convertEventToDbEvent(eventToRegister))
      .put(KEY_OF_AMOUNT_OF_EVENTS, eventToRegister.number)
      .write((err: any) => {
        if (err) {
          error.fatal(err)
        } else {
          state.eventRegister$.emit('event', eventToRegister)
          resolveToNumber(eventToRegister.number)
        }
      })
  })
}

const convertEventToDbEvent = (
  eventToRegister: IEventTrusted
): IEventStored => {
  const storableEvent: IEventStored = {
    a: eventToRegister.agent, // agent
    c: eventToRegister.createdAt, // createdAt
    p: eventToRegister.payload, // payload
    t: eventToRegister.type, // type
  }
  return storableEvent
}

const convertDbEventToEvent = (
  eventNumber: number,
  eventInDb: IEventStored
): IEventTrusted => {
  const eventRestored: IEventTrusted = {
    agent: eventInDb.a,
    createdAt: eventInDb.c,
    number: eventNumber,
    payload: eventInDb.p,
    type: eventInDb.t,
  }
  return eventRestored
}

const registerLockOpen = async () => {
  while (state.registeringLock) {
    await new Promise(resolve =>
      setTimeout(resolve, EVENT_REGISTER_LOCK_REST_TIME)
    )
  }
  state.registeringLock = true
}

const registerLockClose = async () => {
  state.registeringLock = false
}

const retrieveEvent = async (eventNumber: number): Promise<IEventTrusted> => {
  if (!state.startedAt) {
    await start()
  }
  return new Promise<IEventTrusted>((resolveEvent, reject) => {
    state.db!.get(eventNumber, (err: any, eventInDb: IEventStored) => {
      if (err) {
        if (err.notFound) {
          reject(error.is(EVENT_NOT_FOUND_ERROR))
        } else {
          error.fatal(EVENT_READ_ERROR, err)
        }
      } else {
        resolveEvent(convertDbEventToEvent(eventNumber, eventInDb))
      }
    })
  })
}

const retrieveAllEventsFrom = async (
  eventNumberFrom: number
): Promise<ITruthObserver> => {
  if (!state.startedAt) {
    await start()
  }
  if (eventNumberFrom > state.lastEventNumber!) {
    error.throw(ASKED_EVENT_GREATER_THEN_LAST_REGISTERED_ERROR)
    return VOID_TRUTH
  } else {
    const truthObserver: ITruthObserver = {
      eventStream$: new events.EventEmitter(),
      id: state.totalTruthsObservers++,
      lastEventNumberRead: eventNumberFrom - 1,
    }

    // truthObserver.eventStream$.setMaxListeners(Infinity)
    // truthObserver.onLive$.setMaxListeners(Infinity)

    state.truthObservers.push(truthObserver)

    truthObserver.eventStream$.on('event', (eventRead: IEventTrusted) => {
        truthObserver.lastEventNumberRead = eventRead!.number
    })

    // this is a BAD REALLY REALLY BAD DESIGN AND I THINK THE FAULT IS HERE
    setImmediate(() => {
      recursiveCheckIfTruthObserverIsInLiveBeforeRetrieveStream(truthObserver)
    })

    return truthObserver
  }
}

// this is a PIECE OF SHIT CODE
const recursiveCheckIfTruthObserverIsInLiveBeforeRetrieveStream = async (
  truthObserver: ITruthObserver
) => {
  if (truthObserver.lastEventNumberRead >= state.lastEventNumber!) {
  //  await registerLockOpen()
  //  if (truthObserver.lastEventNumberRead >= state.lastEventNumber!) {
      truthObserver.registeredEventStreamCallback = (eventRegistered: IEventTrusted) => {
        truthObserver.eventStream$.emit('event', eventRegistered!)
      }

      state.eventRegister$.on(
        'event',
        truthObserver.registeredEventStreamCallback
      )

      truthObserver.eventStream$.emit('live')

      // await registerLockClose()
    // } else {
    //   await registerLockClose()
    //   getPromiseOfRetrieveFromToInTruth(truthObserver).then(() => {
    //     recursiveCheckIfTruthObserverIsInLiveBeforeRetrieveStream(truthObserver)
    //   })
    // }
  } else {
    getPromiseOfRetrieveFromToInTruth(truthObserver).then(() => {
      recursiveCheckIfTruthObserverIsInLiveBeforeRetrieveStream(truthObserver)
    })
  }
}

const getPromiseOfRetrieveFromToInTruth = async (truthObserver: ITruthObserver) => {
  return new Promise(resolveOnEndOfStream => {
    const fromNumber = truthObserver.lastEventNumberRead + 1
    const toNumber = state.lastEventNumber!
    truthObserver.levelDbStream = state.db!.createReadStream({
      gte: fromNumber,
      lte: toNumber,
    })
    const subscribedFunction = (record: any) => {
      truthObserver.eventStream$.emit(
        'event',
        convertDbEventToEvent(record.key, record.value)
      )
    }
    truthObserver.levelDbStream.on('data', subscribedFunction)
    truthObserver.levelDbStream.once('end', () => {
      truthObserver.levelDbStream.removeListener('data', subscribedFunction)
      delete truthObserver.levelDbStream
      resolveOnEndOfStream()
    })
  })
}

const retrieveAllEvents = async (): Promise<ITruthObserver> => {
  if (state.lastEventNumber === 0) {
    return Promise.reject(error.is(EVENT_STORE_VOID_ERROR))
  } else {
    return retrieveAllEventsFrom(1)
  }
}

const releaseTruthObserver = (truthToRelease: ITruthObserver) => {
  if (truthToRelease && truthToRelease.eventStream$) {
    truthToRelease.eventStream$.removeAllListeners()
    state.truthObservers = state.truthObservers.filter(
      truth => truth.id !== truthToRelease.id
    )
  }
}

const wipe = async () => {
  await registerLockOpen()
  state.truthObservers = []
  state.totalTruthsObservers = 0
  state.lastEventNumber = undefined
  if (state.startedAt) {
    await stop()
    await new Promise(resolveWipe => {
      level.destroy(state.levelDbPath, (err: any) => {
        if (err) {
          error.fatal(err)
        } else {
          rimraf(state.levelDbPath, (err: any) => {
            if (err) {
              error.fatal(err)
            } else {
              resolveWipe()
            }
          })
        }
      })
    })
    await start()
  } else {
    await new Promise(resolveWipe => {
      level.destroy(state.levelDbPath, (err: any) => {
        if (err) {
          error.fatal(err)
        } else {
          rimraf(state.levelDbPath, (err: any) => {
            if (err) {
              error.fatal(err)
            } else {
              resolveWipe()
            }
          })
        }
      })
    })
  }
  await registerLockClose()
}

// const convertPositiveIntegerToBinary = (numberInteger: number): string => {
//   return numberInteger.toString(2)
// }

export const LeveldbTruthModule: ITruthModule = {
  config,
  registerEvent,
  releaseTruthObserver,
  retrieveAllEvents,
  retrieveAllEventsFrom,
  retrieveEvent,
  start,
  stop,
  wipe,
}
