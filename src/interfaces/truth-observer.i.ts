import * as events from 'events'

export interface ITruthObserver {
  id: number
  eventStream$: events.EventEmitter
  lastEventNumberRead: number
  registeredEventStreamCallback?: any
  levelDbStream?: any
}
