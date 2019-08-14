/* tslint:disable:no-unused-expression */
/* tslint:disable:no-implicit-dependencies */
import { expect } from 'chai'
import { spy } from 'sinon'

import {
  IEvent,
  IEventTrusted,
  ITruthModule,
  ITruthObserver,
  VOID_EVENT,
  VOID_TRUTH,
} from '../'
import { LeveldbTruthModule } from './leveldb-truth.module'
import { state, TruthModule } from './truth.module'

describe('TruthModule', () => {
  const MOCK_EVENT_NUMBER: number = 7

  /* tslint:disable:no-empty */
  const mockTruth: ITruthModule = {
    config: (some: any) => {},
    registerEvent: async (event: IEvent) => MOCK_EVENT_NUMBER,
    releaseTruthObserver: (truthObserver: ITruthObserver) => {},
    retrieveAllEvents: async () => VOID_TRUTH,
    retrieveAllEventsFrom: async (eventNumber: number) => VOID_TRUTH,
    retrieveEvent: async (eventNumber: number) => VOID_EVENT,
    start: async () => {},
    stop: async () => {},
    wipe: async () => {},
  }

  after(() => {
    TruthModule.useTruthModule(LeveldbTruthModule)
  })

  it('should use mock logger', () => {
    TruthModule.useTruthModule(mockTruth)
    expect(state.truthModule).to.be.equals(mockTruth)
  })

  it('should link the functionalities', async () => {
    TruthModule.useTruthModule(mockTruth)
    const configSpy = spy(mockTruth, 'config')
    const registerEventSpy = spy(mockTruth, 'registerEvent')
    const releaseTruthObserverSpy = spy(mockTruth, 'releaseTruthObserver')
    const retrieveAllEventsSpy = spy(mockTruth, 'retrieveAllEvents')
    const retrieveAllEventsFromSpy = spy(mockTruth, 'retrieveAllEventsFrom')
    const retrieveEventSpy = spy(mockTruth, 'retrieveEvent')
    const startSpy = spy(mockTruth, 'start')
    const stopSpy = spy(mockTruth, 'stop')
    const wipeSpy = spy(mockTruth, 'wipe')

    TruthModule.config!(VOID_EVENT)
    await TruthModule.start()
    await TruthModule.stop()
    await TruthModule.wipe()
    const eventNumber: number = await TruthModule.registerEvent(VOID_EVENT)
    TruthModule.releaseTruthObserver(VOID_TRUTH)
    const truthObserver: ITruthObserver = await TruthModule.retrieveAllEvents()
    const truthObserverTwo: ITruthObserver = await TruthModule.retrieveAllEventsFrom(
      MOCK_EVENT_NUMBER
    )
    const eventTrusted: IEventTrusted = await TruthModule.retrieveEvent(
      MOCK_EVENT_NUMBER
    )

    expect(eventNumber).to.be.equals(MOCK_EVENT_NUMBER)
    expect(truthObserver).to.be.equals(VOID_TRUTH)
    expect(truthObserverTwo).to.be.equals(truthObserver)
    expect(eventTrusted).to.be.equals(VOID_EVENT)

    configSpy.should.have.been.calledWith(VOID_EVENT)
    startSpy.should.have.been.called
    stopSpy.should.have.been.called
    wipeSpy.should.have.been.called
    registerEventSpy.should.have.been.calledWith(VOID_EVENT)
    releaseTruthObserverSpy.should.have.been.calledWith(VOID_TRUTH)
    retrieveAllEventsSpy.should.have.been.called
    retrieveAllEventsFromSpy.should.have.been.calledWith(MOCK_EVENT_NUMBER)
    retrieveEventSpy.should.have.been.calledWith(MOCK_EVENT_NUMBER)

    configSpy.restore()
    startSpy.restore()
    stopSpy.restore()
    wipeSpy.restore()
    registerEventSpy.restore()
    releaseTruthObserverSpy.restore()
    retrieveAllEventsSpy.restore()
    retrieveAllEventsFromSpy.restore()
    retrieveEventSpy.restore()
  })
})
