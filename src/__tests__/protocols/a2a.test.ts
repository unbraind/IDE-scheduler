import * as vscode from 'vscode'
import { handleA2ATrigger, validateA2AMessage, A2AMessage } from '../../protocols/a2a'

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
    await handleA2ATrigger({
      protocol: 'a2a',
      version: '1',
      target: { agent: 'kilocode' },
      action: 'trigger',
      payload: { mode: 'Code', instructions: 'Hello' },
    } satisfies A2AMessage)
    expect(exec).toHaveBeenCalled()
  })

  test('handleA2ATrigger does nothing for invalid message even if enabled', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn((key: string) => (key === 'experimental.crossIde' ? true : undefined)),
    } as any)
    const exec = jest.spyOn(vscode.commands, 'executeCommand')
    await handleA2ATrigger({ protocol: 'wrong', version: '1', target: { agent: '' }, action: '' })
    expect(exec).not.toHaveBeenCalled()
  })
})

