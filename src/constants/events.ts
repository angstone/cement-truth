import { IEventTrusted } from '../'
import { AGENTS } from './'

export const VOID_EVENT: IEventTrusted = {
  agent: AGENTS.SYSTEM_DEVELOPER,
  createdAt: 0,
  number: -1,
  type: '',
}

export const SAMPLE_EVENT: IEventTrusted = {
  agent: AGENTS.SYSTEM_DEVELOPER,
  createdAt: Date.now() - 3000,
  number: 17,
  type: 'sample event',
}
