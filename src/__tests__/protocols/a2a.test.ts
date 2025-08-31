import * as vscode from 'vscode'
import { handleA2ATrigger, validateA2AMessage, A2AMessage } from '../../protocols/a2a'
import { SchedulerService } from '../../services/scheduler/SchedulerService'

describe('A2A protocol', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__extensionContext = { subscriptions: [] }
  })

  test('validateA2AMessage catches invalid shapes', () => {
    expect(validateA2AMessage(null).valid).toBe(false)
    expect(validateA2AMessage({}).valid).toBe(false)
    expect(validateA2AMessage({ protocol: 'x', version: '1', target: { agent: '' }, action: '' }).valid).toBe(false)
    expect(
      validateA2AMessage({ protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'trigger' }).valid,
    ).toBe(true)
  })

  test('handleA2ATrigger respects disabled cross-IDE setting', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => (key === 'experimental.crossIde' ? false : undefined)),
    } as any)
    const infoSpy = jest.spyOn(vscode.window, 'showInformationMessage')
    await handleA2ATrigger({ protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'trigger' })
    expect(infoSpy).toHaveBeenCalled()
  })

  test('handleA2ATrigger routes to Kilo Code adapter when enabled', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => (key === 'experimental.crossIde' ? true : undefined)),
    } as any)
    const exec = jest.spyOn(vscode.commands, 'executeCommand')
    const res = await handleA2ATrigger({
      protocol: 'a2a',
      version: '1',
      target: { agent: 'kilocode' },
      action: 'trigger',
      payload: { mode: 'Code', instructions: 'Hello' },
    } satisfies A2AMessage)
    expect(exec).toHaveBeenCalled()
    expect(res).toEqual({ ok: true })
  })

  test('handleA2ATrigger does nothing for invalid message even if enabled', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => (key === 'experimental.crossIde' ? true : undefined)),
    } as any)
    const exec = jest.spyOn(vscode.commands, 'executeCommand')
    const res = await handleA2ATrigger({ protocol: 'wrong', version: '1', target: { agent: '' }, action: '' })
    expect(exec).not.toHaveBeenCalled()
    expect(res.ok).toBe(false)
  })

  test('list action returns schedule summaries', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => (key === 'experimental.crossIde' ? true : undefined)),
    } as any)

    // Seed a fake scheduler instance for adapter to read
    ;(SchedulerService as any).instance = {
      schedules: [
        { id: 'a', name: 'A', active: true },
        { id: 'b', name: 'B', active: false },
      ],
      getActiveScheduleCount: () => 1,
    }

    const res = await handleA2ATrigger({
      protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'list'
    })
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data[0].id).toBe('a')
  })

  test('setActive action validates payload and calls through', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => (key === 'experimental.crossIde' ? true : undefined)),
    } as any)

    const toggle = jest.fn()
    ;(SchedulerService as any).instance = {
      schedules: [ { id: 'a', name: 'A', active: false } ],
      getActiveScheduleCount: () => 0,
      toggleScheduleActive: toggle,
      updateSchedule: jest.fn(),
    }

    const bad = await handleA2ATrigger({ protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'setActive' })
    expect(bad.ok).toBe(false)

    const res = await handleA2ATrigger({ protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'setActive', payload: { scheduleId: 'a', active: true } })
    expect(res.ok).toBe(true)
    expect(toggle).toHaveBeenCalledWith('a', true)
  })

  test('disallowed action is blocked via allowedActions config', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => {
        if (key === 'experimental.crossIde') return true
        if (key === 'experimental.agents.kilocode.allowedActions') return ['list']
        return undefined
      }),
    } as any)
    const exec = jest.spyOn(vscode.commands, 'executeCommand')
    const res = await handleA2ATrigger({ protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'trigger', payload: { instructions: 'x' } })
    expect(res.ok).toBe(false)
    expect(exec).not.toHaveBeenCalled()
  })
})
