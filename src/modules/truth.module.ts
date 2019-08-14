import { IEvent, IEventTrusted, ITruthModule, ITruthObserver } from '../'
import { LeveldbTruthModule } from './leveldb-truth.module'

interface ITruthModuleWrapper extends ITruthModule {
  useTruthModule: (truthModule: ITruthModule) => void
}

interface ITruthModuleState {
  truthModule: ITruthModule
}

export const state: ITruthModuleState = {
  truthModule: LeveldbTruthModule,
}

const useTruthModule = (truthModule: ITruthModule) => {
  state.truthModule = truthModule
}

const config = (truthConfig?: any) => {
  if(state.truthModule.config) {
    state.truthModule.config(truthConfig)
  }
}

const registerEvent = (event: IEvent): Promise<number> =>
  state.truthModule.registerEvent(event)

const releaseTruthObserver = (truthObserver: ITruthObserver) =>
  state.truthModule.releaseTruthObserver(truthObserver)

const retrieveEvent = (eventNumber: number): Promise<IEventTrusted> =>
  state.truthModule.retrieveEvent(eventNumber)

const retrieveAllEvents = (): Promise<ITruthObserver> =>
  state.truthModule.retrieveAllEvents()

const retrieveAllEventsFrom = (eventNumber: number): Promise<ITruthObserver> =>
  state.truthModule.retrieveAllEventsFrom(eventNumber)

const start = (): Promise<void> => state.truthModule.start()
const stop = (): Promise<void> => state.truthModule.stop()
const wipe = (): Promise<void> => state.truthModule.wipe()

export const TruthModule: ITruthModuleWrapper = {
  config,
  registerEvent,
  releaseTruthObserver,
  retrieveAllEvents,
  retrieveAllEventsFrom,
  retrieveEvent,
  start,
  stop,
  useTruthModule,
  wipe,
}
