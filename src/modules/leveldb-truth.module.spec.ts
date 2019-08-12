/* tslint:disable:no-unused-expression */
/* tslint:disable:no-implicit-dependencies */

import { expect } from 'chai'
// import { spy } from 'sinon'
import { AGENTS, IEvent, IEventTrusted } from '../'
import {
  EVENT_STORE_VOID_ERROR,
  LeveldbTruthModule as truth,
} from './leveldb-truth.module'

describe('TruthModule', () => {
  it('should exists', () => {
    expect(truth).to.be.exist
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

  describe('wipe function', () => {
    it('should wipe events', async () => {
      await truth.wipe()
      await truth.registerEvent(SAMPLE_VOID_EVENT)
      await truth.registerEvent(SAMPLE_STRING_EVENT)
      await truth.registerEvent(SAMPLE_OBJECT_EVENT)
      const truthObserver = await truth.retrieveAllEvents()
      let eventsInside: number = 0
      truthObserver.eventStream$.on('event', event => {
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
  })
})
