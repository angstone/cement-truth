import * as events from 'events'
import { ITruth } from '../'

export const VOID_TRUTH: ITruth = {
  eventStream$: new events.EventEmitter(),
  id: 0,
  lastEventNumberRead: 0,
  onLive$: new events.EventEmitter(),
}
