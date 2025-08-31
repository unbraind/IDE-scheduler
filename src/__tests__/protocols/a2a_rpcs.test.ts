import { handleSendMessage, handleCreateTask, handleGetTask, handleListTasks, handleCancelTask } from '../../protocols/a2a'
import { SchedulerAdapterRegistry } from '../../services/scheduler/adapters'

jest.mock('../../services/scheduler/adapters', () => {
  const actual = jest.requireActual('../../services/scheduler/adapters')
  const dummyAdapter = {
    id: 'kilocode',
    title: 'Kilo Code',
    initialize: jest.fn(async () => {}),
    listSchedules: jest.fn(async () => []),
    getActiveCount: jest.fn(async () => 0),
    setActive: jest.fn(async () => {}),
    triggerAgent: jest.fn(async () => {}),
    sendMessage: jest.fn(async () => ({ ok: true })),
    createTask: jest.fn(async () => ({ ok: true, task: { id: '1', title: 't', status: 'pending' } })),
    getTask: jest.fn(async () => ({ ok: true, task: { id: '1', title: 't', status: 'pending' } })),
    listTasks: jest.fn(async () => ({ ok: true, tasks: [] })),
    cancelTask: jest.fn(async () => ({ ok: true })),
  }
  class FakeReg {
    private static _i: any
    private map = new Map<string, any>([['kilocode', dummyAdapter]])
    static instance() { return this._i || (this._i = new FakeReg()) }
    async initialize() {}
    get(id: string) { return this.map.get(id) }
  }
  return { SchedulerAdapterRegistry: FakeReg, __dummyAdapter: dummyAdapter, __esModule: true }
})

describe('A2A extended RPC handlers', () => {
  test('sendMessage routes to adapter', async () => {
    const res = await handleSendMessage({ agent: 'kilocode', text: 'hi' })
    expect(res.ok).toBeTruthy()
  })
  test('createTask returns a task', async () => {
    const res = await handleCreateTask({ agent: 'kilocode', title: 'X' })
    expect(res.ok).toBeTruthy(); expect(res.task?.id).toBeDefined()
  })
  test('getTask returns a task', async () => {
    const res = await handleGetTask({ agent: 'kilocode', id: '1' })
    expect(res.ok).toBeTruthy(); expect(res.task?.id).toBe('1')
  })
  test('listTasks returns array', async () => {
    const res = await handleListTasks({ agent: 'kilocode' })
    expect(res.ok).toBeTruthy(); expect(Array.isArray(res.tasks)).toBe(true)
  })
  test('cancelTask returns ok', async () => {
    const res = await handleCancelTask({ agent: 'kilocode', id: '1' })
    expect(res.ok).toBeTruthy()
  })
})

