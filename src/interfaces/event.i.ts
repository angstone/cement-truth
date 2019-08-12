import { IAgent } from '../'

export interface IEvent {
  agent: IAgent
  type: string
  payload?: any
}

export interface IEventTrusted extends IEvent {
  number: number
  createdAt: number
}

export interface IEventStored {
  a: any // agent
  t: string // type
  p: any // payload
  c: number // createdAt
}
