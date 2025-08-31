// npx jest src/__tests__/App.test.tsx

import React from "react"
import { render, screen, act, cleanup } from "@testing-library/react"
import "@testing-library/jest-dom"

import AppWithProviders from "../App"

jest.mock("../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock extension state to render immediately
jest.mock("../context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		didHydrateState: true,
		showWelcome: false,
		shouldShowAnnouncement: false,
	}),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("App", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		window.removeEventListener("message", () => {})
	})

	afterEach(() => {
		cleanup()
		window.removeEventListener("message", () => {})
	})

	const triggerMessage = (action: string) => {
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "action",
				action,
			},
		})
		window.dispatchEvent(messageEvent)
	}

  it("shows Scheduler view by default", () => {
    render(<AppWithProviders />)
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/Create New Schedule/i)).toBeInTheDocument()
  })

  it("handles settingsButtonClicked action without leaving Scheduler view", async () => {
    render(<AppWithProviders />)
    act(() => { triggerMessage("settingsButtonClicked") })
    expect(screen.queryByTestId("settings-view")).not.toBeInTheDocument()
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
  })

  it("handles historyButtonClicked action without leaving Scheduler view", async () => {
    render(<AppWithProviders />)
    act(() => { triggerMessage("historyButtonClicked") })
    expect(screen.queryByTestId("history-view")).not.toBeInTheDocument()
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
  })

  it("handles mcpButtonClicked action without leaving Scheduler view", async () => {
    render(<AppWithProviders />)
    act(() => { triggerMessage("mcpButtonClicked") })
    expect(screen.queryByTestId("mcp-view")).not.toBeInTheDocument()
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
  })

  it("handles promptsButtonClicked action without leaving Scheduler view", async () => {
    render(<AppWithProviders />)
    act(() => { triggerMessage("promptsButtonClicked") })
    expect(screen.queryByTestId("prompts-view")).not.toBeInTheDocument()
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
  })

  it("ignores done click targets and keeps Scheduler view", async () => {
    render(<AppWithProviders />)
    act(() => { triggerMessage("settingsButtonClicked") })
    expect(screen.queryByTestId("settings-view")).not.toBeInTheDocument()
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
  })

  it.each(["history", "mcp", "prompts"])('does not navigate to %s view in Scheduler UI', async (view) => {
    render(<AppWithProviders />)
    act(() => { triggerMessage(`${view}ButtonClicked`) })
    expect(screen.getByText(/Scheduler/i)).toBeInTheDocument()
    expect(screen.queryByTestId(`${view}-view`)).not.toBeInTheDocument()
  })
})
