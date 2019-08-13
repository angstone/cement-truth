/* tslint:disable:no-unused-expression */
/* tslint:disable:no-implicit-dependencies */
import * as path from 'path'

import { expect } from 'chai'
// import { spy } from 'sinon'
import {
  AGENTS,
  ENVS,
  IEvent,
  IEventTrusted,
  ITruthObserver,
  logger,
  LOGLEVELS,
  signature,
} from '../'
import {
  DEFAULT_DB_NAME,
  EVENT_STORE_VOID_ERROR,
  LeveldbTruthModule as truth,
  state,
} from './leveldb-truth.module'

describe('TruthModule', () => {
  before(() => {
    process.env.APP_ENV = ENVS.DEV
    process.env.APP_LOGLEVEL = LOGLEVELS.DEV_NOTE
    signature()
  })

  it('should exists', () => {
    expect(truth).to.be.exist
  })

  describe('config', () => {
    it('should run with no arguments', () => {
      truth.config!()
      expect(state.levelDbPath).to.be.equals(
        path.join(__dirname, DEFAULT_DB_NAME)
      )
    })

    it('should config nice', () => {
      const TEST_NAME = './nicePath'
      truth.config!({ levelDbPath: TEST_NAME })
      expect(state.levelDbPath).to.be.equals(TEST_NAME)
      truth.config!({ levelDbPath: path.join(__dirname, DEFAULT_DB_NAME) })
    })
  })

  const SAMPLE_VOID_EVENT: IEvent = {
    agent: AGENTS.SYSTEM_DEVELOPER,
    type: 'sample void',
  }

  const SAMPLE_STRING_EVENT: IEvent = {
    agent: AGENTS.SYSTEM_DEVELOPER,
    payload: 'string payload',
    type: 'sample payload',
  }

  const SAMPLE_OBJECT_EVENT: IEvent = {
    agent: AGENTS.SYSTEM_DEVELOPER,
    payload: {
      sample: 'object',
      with: {
        internals: ['vari', 'ables'],
      },
    },
    type: 'sample object',
  }

  const agent = AGENTS.SYSTEM_DEVELOPER

  describe('wipe function', () => {
    it('should wipe events', async () => {
      await truth.wipe()
      await truth.registerEvent(SAMPLE_VOID_EVENT)
      await truth.registerEvent(SAMPLE_STRING_EVENT)
      await truth.registerEvent(SAMPLE_OBJECT_EVENT)
      const truthObserver = await truth.retrieveAllEvents()
      let eventsInside: number = 0
      truthObserver.eventStream$.on('event', () => {
        eventsInside++
      })
      await new Promise(continueTest => {
        truthObserver.eventStream$.once('live', () => {
          truth.releaseTruthObserver(truthObserver)
          expect(eventsInside).to.be.equals(3)
          continueTest()
        })
      })

      await truth.wipe()
      await truth.retrieveAllEvents().catch((err: Error) => {
        expect(err.message).to.be.equals(EVENT_STORE_VOID_ERROR)
      })
    })
  })

  describe('registerEvent function', () => {
    it('should register an event', async () => {
      const eventNumber: number = await truth.registerEvent(SAMPLE_VOID_EVENT)
      expect(eventNumber).to.be.an('number')
      expect(eventNumber).to.be.at.least(1)
    })

    it('should give the number 1 as first event number', async () => {
      await truth.wipe()
      const eventNumber: number = await truth.registerEvent(SAMPLE_VOID_EVENT)
      expect(eventNumber).to.be.equals(1)
    })

    it('should register an string-payloaded event', async () => {
      const eventNumber: number = await truth.registerEvent(SAMPLE_STRING_EVENT)
      expect(eventNumber).to.be.an('number')
      expect(eventNumber).to.be.at.least(1)
    })

    it('should register an object-payloaded event', async () => {
      const eventNumber: number = await truth.registerEvent(SAMPLE_OBJECT_EVENT)
      expect(eventNumber).to.be.an('number')
      expect(eventNumber).to.be.at.least(1)
    })
  })

  describe('retrieveEvent function', () => {
    it('should retrieve an event', async () => {
      const eventNumber: number = await truth.registerEvent(SAMPLE_VOID_EVENT)
      const gotEvent: IEventTrusted = await truth.retrieveEvent(eventNumber)
      expect(gotEvent.type).to.be.equals(SAMPLE_VOID_EVENT.type)
      expect(gotEvent.agent).to.be.deep.equals(SAMPLE_VOID_EVENT.agent)
    })

    it('should retrieve an string-payloaded event', async () => {
      const eventNumber: number = await truth.registerEvent(SAMPLE_STRING_EVENT)
      const gotEvent: IEventTrusted = await truth.retrieveEvent(eventNumber)
      expect(gotEvent.type).to.be.equals(SAMPLE_STRING_EVENT.type)
      expect(gotEvent.agent).to.be.deep.equals(SAMPLE_STRING_EVENT.agent)
      expect(gotEvent.payload).to.be.equals(SAMPLE_STRING_EVENT.payload)
    })

    it('should retrieve an object-payloaded event', async () => {
      const eventNumber: number = await truth.registerEvent(SAMPLE_OBJECT_EVENT)
      const gotEvent: IEventTrusted = await truth.retrieveEvent(eventNumber)
      expect(gotEvent.type).to.be.equals(SAMPLE_OBJECT_EVENT.type)
      expect(gotEvent.agent).to.be.deep.equals(SAMPLE_OBJECT_EVENT.agent)
      expect(gotEvent.payload).to.be.deep.equals(SAMPLE_OBJECT_EVENT.payload)
    })
  })

  describe('retrieveAllEvents function', async () => {
    it('should retrieve many past events sequentially', async () => {
      await truth.wipe()
      const HOW_MANY_EVENTS_TO_TEST = 100
      const eventTypes: string[] = []
      for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST; i++) {
        eventTypes.push('event type number ' + i + ' test')
      }

      await eventTypes.reduce(async (previousPromise, eventType: string) => {
        await previousPromise
        const event: IEvent = {
          agent: AGENTS.SYSTEM_DEVELOPER,
          type: eventType,
        }
        const eventNumber = await truth.registerEvent(event)
        expect(eventNumber).to.be.an('number')
        expect(eventNumber).to.be.at.least(1)
      }, Promise.resolve())

      const truthObserver = await truth.retrieveAllEvents()

      expect(truthObserver).to.be.exist
      expect(truthObserver.id).to.be.an('number')
      expect(truthObserver.eventStream$).to.be.exist

      const eventsGot: IEventTrusted[] = []
      truthObserver.eventStream$.on('event', (event: IEventTrusted) => {
        eventsGot.push(event)
      })
      await new Promise(continueTest => {
        truthObserver.eventStream$.once('live', () => {
          expect(eventsGot).to.be.an('array')
          expect(eventsGot.length).to.be.equals(HOW_MANY_EVENTS_TO_TEST)
          eventTypes.forEach((eventType: string) => {
            expect(
              eventsGot.filter(eventGot => eventGot.type === eventType).length
            ).to.be.equals(1)
          })
          continueTest()
        })
      })
      await truth.stop()
    })

    it('should retrieve many past events in parallel', async () => {
      await truth.wipe()
      const HOW_MANY_EVENTS_TO_TEST = 100
      const eventTypes: string[] = []
      for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST; i++) {
        eventTypes.push('event type number ' + i + ' test')
      }
      await Promise.all(
        eventTypes.map(async (eventType: string) => {
          const event: IEvent = {
            agent: AGENTS.SYSTEM_DEVELOPER,
            type: eventType,
          }
          const eventNumber = await truth.registerEvent(event)
          expect(eventNumber).to.be.an('number')
          expect(eventNumber).to.be.at.least(1)
        })
      )

      const truthObserver = await truth.retrieveAllEvents()

      expect(truthObserver).to.be.exist
      expect(truthObserver.id).to.be.an('number')
      expect(truthObserver.eventStream$).to.be.exist

      const eventsGot: IEventTrusted[] = []
      truthObserver.eventStream$.on('event', (event: IEventTrusted) => {
        eventsGot.push(event)
      })
      await new Promise(continueTest => {
        truthObserver.eventStream$.once('live', () => {
          expect(eventsGot).to.be.an('array')
          expect(eventsGot.length).to.be.equals(HOW_MANY_EVENTS_TO_TEST)
          eventTypes.forEach((eventType: string) => {
            expect(
              eventsGot.filter(eventGot => eventGot.type === eventType).length
            ).to.be.equals(1)
          })
          continueTest()
        })
      })
      await truth.stop()
    })

    it('should retrieve a live event', async () => {
      await truth.wipe()
      const HOW_MANY_EVENTS_TO_TEST = 3
      const eventTypes: string[] = []
      for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST; i++) {
        eventTypes.push('event type number ' + i + ' test')
      }
      await eventTypes.reduce(async (p, type: string) => {
        await p
        const eventNumber = await truth.registerEvent({ type, agent })
        expect(eventNumber).to.be.at.least(1)
      }, Promise.resolve())

      const truthObs = await truth.retrieveAllEvents()

      expect(truthObs).to.be.exist
      expect(truthObs.id).to.be.an('number')
      expect(truthObs.eventStream$).to.be.exist

      const eventsGot: IEventTrusted[] = []
      truthObs.eventStream$.on('event', event => {
        expect(event).to.be.exist
        eventsGot.push(event)
      })
      await new Promise(go => {
        truthObs.eventStream$.once('live', () => {
          expect(eventsGot).to.be.an('array')
          expect(eventsGot.length).to.be.equals(HOW_MANY_EVENTS_TO_TEST)
          eventTypes.forEach(eventType => {
            expect(eventsGot.find(eventGot => eventGot.type === eventType)).to
              .be.not.undefined
          })
          go()
        })
      })
      const liveType = 'important live test'
      const eventLiveNumber = await truth.registerEvent({
        agent,
        type: liveType,
      })
      await new Promise(r => setImmediate(r))
      const eventLiveGot = eventsGot.pop()
      expect(eventLiveGot!.type).to.be.equals(liveType)
      expect(eventLiveGot!.number).to.be.equals(eventLiveNumber)
    })
  })

  if (process.env.APP_TEST_OVERLOAD === 'true') {
    describe('overload tasks', () => {
      beforeEach(async () => {
        await truth.stop()
        await truth.wipe()
      })

      it('should retrieve all past events from given eventNumber in sequence', async () => {
        await truth.start()
        const HOW_MANY_EVENTS_TO_TEST = 50000
        const EVENT_NUMBER_FROM = 793

        logger.dev(`writing ${HOW_MANY_EVENTS_TO_TEST} events in sequence..`)

        const eventTypes: string[] = []
        for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST; i++) {
          eventTypes.push('event type number ' + i + ' test')
        }

        await eventTypes.reduce(async (p, type: string) => {
          await p
          const eventNumber = await truth.registerEvent({ type, agent })
          expect(eventNumber).to.be.at.least(1)
        }, Promise.resolve())

        logger.dev(
          `retrieving ${HOW_MANY_EVENTS_TO_TEST - EVENT_NUMBER_FROM} events..`
        )
        logger.dev(`.. from the event ${EVENT_NUMBER_FROM} ..`)

        const truthObs = await truth.retrieveAllEventsFrom(EVENT_NUMBER_FROM)
        const eventsGot: IEventTrusted[] = []
        truthObs.eventStream$.on('event', event => {
          eventsGot.push(event)
        })

        await new Promise(go => {
          truthObs.eventStream$.once('live', () => {
            expect(eventsGot.length).to.be.equals(
              HOW_MANY_EVENTS_TO_TEST - EVENT_NUMBER_FROM + 1
            )
            eventTypes.forEach((eventType: string, eventTypeIndex: number) => {
              if (eventTypeIndex + 1 >= EVENT_NUMBER_FROM) {
                expect(eventsGot.find(eventGot => eventGot.type === eventType))
                  .to.be.not.undefined
              } else {
                expect(eventsGot.find(eventGot => eventGot.type === eventType))
                  .to.be.undefined
              }
            })
            go()
          })
        })

        logger.dev(`... all done`)
      }).timeout(50000) // end it test case

      it('should retrieve all past events in parallel', async () => {
        await truth.start()
        const HOW_MANY_EVENTS_TO_TEST = 50000
        const eventTypes: string[] = []
        for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST; i++) {
          eventTypes.push('event type number ' + i + ' test')
        }

        logger.dev(`writing ${HOW_MANY_EVENTS_TO_TEST} events in parallel..`)

        await Promise.all(
          eventTypes.map(async (type: string) => {
            const eventNumber = await truth.registerEvent({ type, agent })
            expect(eventNumber).to.be.at.least(1)
          })
        )
        const truthObs = await truth.retrieveAllEvents()
        const eventsGot: IEventTrusted[] = []
        truthObs.eventStream$.on('event', event => {
          eventsGot.push(event)
        })
        logger.dev(`retrieving all ${HOW_MANY_EVENTS_TO_TEST} events..`)
        await new Promise(go => {
          truthObs.eventStream$.once('live', () => {
            expect(eventsGot.length).to.be.equals(HOW_MANY_EVENTS_TO_TEST)
            eventTypes.forEach((eventType: string) => {
              expect(eventsGot.find(eventGot => eventGot.type === eventType)).to
                .be.not.undefined
            })
            go()
          })
        })

        logger.dev(`... all done`)
      }).timeout(50000) // end it test case
    }) // end describe
  } // end if overload

  describe('persistence', () => {
    it('should persist a payloaded event', async () => {
      await truth.wipe()
      await truth.start()
      await truth.registerEvent(SAMPLE_OBJECT_EVENT)
      await truth.stop()
      const event = await truth.retrieveEvent(1)
      expect(event.type).to.be.equals(SAMPLE_OBJECT_EVENT.type)
      expect(event.payload).to.be.deep.equals(SAMPLE_OBJECT_EVENT.payload)
    })

    if (process.env.APP_TEST_OVERLOAD === 'true') {
      describe('overloaded', function() {
        this.timeout(200000)

        const HOW_MANY_EVENTS_TO_TEST = 50000
        const eventTypes: string[] = []

        before(async () => {
          await truth.wipe()
          await truth.start()
          for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST; i++) {
            eventTypes.push('event type number ' + i + ' test')
          }
          logger.dev(`writing ${HOW_MANY_EVENTS_TO_TEST} persisted events..`)

          await Promise.all(
            eventTypes.map(async (type: string) => {
              const eventNumber = await truth.registerEvent({
                agent,
                payload: SAMPLE_OBJECT_EVENT.payload,
                type,
              })
              expect(eventNumber).to.be.at.least(1)
            })
          )

          await truth.stop()
        })

        it('should recover everthing', async () => {
          const truthObs = await truth.retrieveAllEvents()
          const eventsGot: IEventTrusted[] = []
          truthObs.eventStream$.on('event', event => {
            eventsGot.push(event)
          })

          logger.dev(`retrieving ${HOW_MANY_EVENTS_TO_TEST} events..`)

          await new Promise(go => {
            truthObs.eventStream$.once('live', () => {
              expect(eventsGot.length).to.be.equals(HOW_MANY_EVENTS_TO_TEST)
              eventTypes.forEach((eventType: string) => {
                expect(eventsGot.find(eventGot => eventGot.type === eventType))
                  .to.be.not.undefined
              })
              go()
            })
          })
          logger.dev(`... all done`)
        }).timeout(200000) // end test case

        it('should recover everthing in live', async () => {
          const truthObs = await truth.retrieveAllEvents()

          logger.dev(`reading ${HOW_MANY_EVENTS_TO_TEST} events..`)

          await new Promise(go => {
            truthObs.eventStream$.once('live', () => {
              go()
            })
          })

          const HOW_MANY_EVENTS_TO_TEST_LIVE = 49000
          const eventsGot: IEventTrusted[] = []
          truthObs.eventStream$.on('event', event => {
            eventsGot.push(event)
          })

          const eventTypesLive: string[] = []
          for (let i = 1; i <= HOW_MANY_EVENTS_TO_TEST_LIVE; i++) {
            eventTypesLive.push('event live number ' + i + ' test')
          }

          logger.dev(`writing ${HOW_MANY_EVENTS_TO_TEST_LIVE} events in live..`)
          logger.dev(
            `.. and retrieving ${HOW_MANY_EVENTS_TO_TEST_LIVE} live events..`
          )

          await Promise.all(
            eventTypesLive.map(async (type: string) => {
              const eventNumber = await truth.registerEvent({
                agent,
                type,
              })
              expect(eventNumber).to.be.at.least(1)
            })
          )

          expect(eventsGot.length).to.be.equals(HOW_MANY_EVENTS_TO_TEST_LIVE)
          eventTypesLive.forEach((eventType: string) => {
            expect(eventsGot.find(eventGot => eventGot.type === eventType)).to
              .be.not.undefined
          })
          logger.dev(`... all done`)
        }).timeout(200000) // end test case
      }) // end describe
    } // enf if overload
  }) // end describe
  describe('parallel access', () => {
    it('should tolerate parallel access', async () => {
      const HOW_MANY_CLIENTS =
        process.env.APP_TEST_OVERLOAD === 'true' ? 500 : 50
      const HOW_MANY_EVENTS_PER_CLIENT = 100
      interface IClient {
        index: number
        truthObserver?: ITruthObserver
        eventPosts: IEvent[]
        eventNumbers: number[]
        eventGots: IEventTrusted[]
      }

      // avoid void stream error
      await truth.wipe()
      await truth.registerEvent(SAMPLE_OBJECT_EVENT)

      logger.dev(`setting up ${HOW_MANY_CLIENTS} clients..`)
      logger.dev(
        `... with ${HOW_MANY_EVENTS_PER_CLIENT} events to register each..`
      )
      const clients: IClient[] = []
      for (let index = 0; index < HOW_MANY_CLIENTS; index++) {
        const eventPosts: IEvent[] = []
        for (let i = 0; i < HOW_MANY_EVENTS_PER_CLIENT; i++) {
          const type = `event ${i} of client ${index}`
          const event: IEvent = { ...SAMPLE_STRING_EVENT, type }
          eventPosts.push(event)
        }
        const client = { eventPosts, index, eventNumbers: [], eventGots: [] }
        clients.push(client)
      }

      const toolchainClient = async (client: IClient) => {
        client.truthObserver = await truth.retrieveAllEvents()
        await new Promise(go => {
          client.truthObserver!.eventStream$.once('live', go)
        })
        client.truthObserver.eventStream$.on(
          'event',
          (event: IEventTrusted) => {
            client.eventGots.push(event)
          }
        )
        await Promise.all(
          client.eventPosts.map(async eventPost => {
            const eventNumber = await truth.registerEvent(eventPost)
            client.eventNumbers.push(eventNumber)
          })
        )
        await new Promise(setImmediate)
        client.eventPosts.forEach(eventPost => {
          expect(
            client.eventGots.find(eventGot => eventGot.type === eventPost.type)
          ).to.be.not.undefined
        })
        client.eventNumbers.forEach(eventNumber => {
          expect(
            client.eventGots.find(eventGot => eventGot.number === eventNumber)
          ).to.be.not.undefined
        })
      } // end toolchain client
      logger.dev(`making ${HOW_MANY_CLIENTS} clients call for registering
${HOW_MANY_EVENTS_PER_CLIENT} events and retrieving/checking all in parallel...`)
      await Promise.all(clients.map(toolchainClient))
      logger.dev('... all done')
    }).timeout(200000) // end test case
  }) // end describe parallel
})
