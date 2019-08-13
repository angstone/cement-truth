import { IEvent, IEventTrusted, ITruthObserver } from './'

export interface ITruthModule {
  config?: (truthModuleConfig?: any) => void
  registerEvent: (event: IEvent) => Promise<number>
  releaseTruthObserver: (truthObserver: ITruthObserver) => void
  retrieveEvent: (eventNumber: number) => Promise<IEventTrusted>
  retrieveAllEvents: () => Promise<ITruthObserver>
  retrieveAllEventsFrom: (eventNumber: number) => Promise<ITruthObserver>
  start: () => Promise<void>,
  stop: () => Promise<void>,
  wipe: () => Promise<void>,
}
