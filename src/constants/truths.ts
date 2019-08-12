import * as events from 'events'
import { ITruthObserver } from '../'

export const VOID_TRUTH: ITruthObserver = {
  eventStream$: new events.EventEmitter(),
  id: 0,
  lastEventNumberRead: 0,
}
