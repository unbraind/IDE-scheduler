/* eslint-disable import/first */
/**
 * Mock VSCode API before any imports that use it.
 * This mock will dispatch a fileContent event with the provided schedules
 * when postMessage is called with type "openFile".
 */
let mockSchedules: any[] = [];
const mockPostMessage = jest.fn((msg) => {
  if (msg && msg.type === "openFile" && msg.text === "./.kilo/schedules.json") {
    // Use setImmediate if available, otherwise fallback to setTimeout
    const dispatch = () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "fileContent",
            path: "./.kilo/schedules.json",
            content: JSON.stringify({ schedules: mockSchedules }),
          },
        })
      );
    };
    if (typeof setImmediate === "function") {
      setImmediate(dispatch);
    } else {
      setTimeout(dispatch, 0);
    }
  }
});
jest.mock("../../utils/vscode", () => ({
  vscode: { postMessage: mockPostMessage }
}));
/** Utility to set schedules for the next test */
function setMockSchedules(schedules: any[]) {
  mockSchedules = schedules;
}

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SchedulerView from "../../components/scheduler/SchedulerView";
import { ExtensionStateContextProvider } from "../../context/ExtensionStateContext";

// Mock Virtuoso to render items directly for testing
jest.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div data-testid="virtuoso-container">
      {data && data.map((item: any, idx: number) => itemContent(idx, item))}
    </div>
  ),
}));

// Mock the Select UI components to avoid Radix/react-select issues in test
jest.mock('../../components/ui/select', () => {
  // Stateful Select mock to support value changes
  const React = require("react");
  const { useState } = React;

  const Select = ({ children, onValueChange, value: controlledValue, ...props }: any) => {
    const [value, setValue] = useState(controlledValue ?? "");
    const handleValueChange = (newValue: any) => {
      setValue(newValue);
      if (onValueChange) onValueChange(newValue);
    };
    // Pass value and onValueChange to children
    return (
      <div>
        {React.Children.map(children, (child: any) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { onValueChange: handleValueChange, value });
          }
          return child;
        })}
      </div>
    );
  };

  const SelectContent = ({ children, onValueChange, value }: any) => (
    <div>
      {React.Children.map(children, (child: any) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { onValueChange, value });
        }
        return child;
      })}
    </div>
  );

  const SelectItem = ({ children, value, onValueChange, ...props }: any) => (
    <div
      {...props}
      onClick={() => onValueChange && onValueChange(value)}
      role="option"
      aria-selected={false}
    >
      {children}
    </div>
  );

  const SelectGroup = ({ children }: any) => <div>{children}</div>;
  const SelectLabel = ({ children }: any) => <div>{children}</div>;
  const SelectScrollDownButton = ({ children }: any) => <div>{children}</div>;
  const SelectScrollUpButton = ({ children }: any) => <div>{children}</div>;
  const SelectSeparator = () => <div />;
  const SelectTrigger = ({ children, onValueChange, ...props }: any) => (
    <button {...props} onClick={() => onValueChange && onValueChange("")}>
      {children}
    </button>
  );
  const SelectValue = ({ children }: any) => <span>{children}</span>;
  return {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
  };
});

// Mock getAllModes to return a minimal mode list
jest.mock("../../../../src/shared/modes", () => ({
  getAllModes: () => [
    { slug: "code", name: "Code", roleDefinition: "role-code", groups: ["read"], source: "global", customInstructions: "" }
  ]
}));


describe("SchedulerView", () => {
  function renderWithProvider() {
    return render(
      <ExtensionStateContextProvider>
        <SchedulerView onDone={jest.fn()} />
      </ExtensionStateContextProvider>
    );
  }

  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  it("disables header Save button unless all required fields are filled", () => {
    renderWithProvider();

    // Enter edit mode
    fireEvent.click(screen.getByText(/Create New Schedule/i));

    const headerSaveButton = screen.getByTestId("header-save-button") as HTMLButtonElement;
    const nameInput = screen.getByPlaceholderText(/Enter schedule name/i);
    const promptInput = screen.getByPlaceholderText(/Enter task instructions/i);
    const intervalInput = screen.getByLabelText(/Time interval/i);

    // Clear all fields
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.change(promptInput, { target: { value: "" } });
    fireEvent.change(intervalInput, { target: { value: "" } });
    expect(headerSaveButton).toBeDisabled();

    // Fill name only
    fireEvent.change(nameInput, { target: { value: "Test Name" } });
    expect(headerSaveButton).toBeDisabled();

    // Fill prompt only
    fireEvent.change(promptInput, { target: { value: "Do something" } });
    expect(headerSaveButton).toBeDisabled();

    // Fill interval only
    fireEvent.change(intervalInput, { target: { value: "2" } });
    // Now all required fields are filled, Save should be enabled
    expect(headerSaveButton).not.toBeDisabled();

    // Clear prompt again
    fireEvent.change(promptInput, { target: { value: "" } });
    expect(headerSaveButton).toBeDisabled();
  });

  describe("row and button click edit mode behavior", () => {
    const schedule = {
      id: "123",
      name: "My Schedule",
      mode: "code",
      modeDisplayName: "Code",
      taskInstructions: "Do something important",
      scheduleType: "time",
      timeInterval: "5",
      timeUnit: "minutes",
      selectedDays: {},
      startDate: "2025-04-18",
      startHour: "10",
      startMinute: "00",
      expirationDate: "",
      expirationHour: "00",
      expirationMinute: "00",
      requireActivity: false,
      createdAt: "2025-04-18T10:00:00.000Z",
      updatedAt: "2025-04-18T10:00:00.000Z",
      active: true,
      taskInteraction: "wait",
      inactivityDelay: "15",
    };

    beforeEach(() => {
      setMockSchedules([schedule]);
    });

    it("enters edit mode when a schedule row is clicked", async () => {
      renderWithProvider();
      // Wait for the schedule to appear
      const row = await waitFor(() => screen.getByTestId("schedule-item-123"));
      fireEvent.click(row);
      // The edit form should appear (look for Save button)
      expect(await screen.findByTestId("header-save-button")).toBeInTheDocument();
      // The name field should be pre-filled
      expect(screen.getByDisplayValue("My Schedule")).toBeInTheDocument();
    });

    it("populates form fields with correct values when editing a schedule", async () => {
      renderWithProvider();
      const editButton = await waitFor(() => screen.getByTestId("edit-schedule-button"));
      fireEvent.click(editButton);
      
      // Verify that form fields are populated with the correct values
      expect(screen.getByDisplayValue("My Schedule")).toBeInTheDocument(); // Name
      expect(screen.getByDisplayValue("Do something important")).toBeInTheDocument(); // Task instructions
      
      // Verify that the inactivity delay field is populated with the correct value
      // First, make sure the taskInteraction is set to "wait" so the field is visible
      expect(screen.getByText("Run after specified inactivity")).toBeInTheDocument();
      
      // Then check the inactivity delay value
      const inactivityDelayInput = screen.getByLabelText(/Inactivity delay in minutes/i);
      expect(inactivityDelayInput).toHaveValue(15);
    });

    it("enters edit mode when Edit button is clicked, and does not double-trigger", async () => {
      renderWithProvider();
      const editButton = await waitFor(() => screen.getByTestId("edit-schedule-button"));
      fireEvent.click(editButton);
      expect(await screen.findByTestId("header-save-button")).toBeInTheDocument();
      expect(screen.getByDisplayValue("My Schedule")).toBeInTheDocument();
    });

    it("does not enter edit mode when Delete button is clicked", async () => {
      renderWithProvider();
      const deleteButton = await waitFor(() => screen.getByTestId("delete-schedule-button"));
      fireEvent.click(deleteButton);
      // The confirmation dialog should appear, but not the edit form
      expect(await screen.findByText(/Delete Schedule/i)).toBeInTheDocument();
      expect(screen.queryByTestId("header-save-button")).not.toBeInTheDocument();
    });

    it("does not enter edit mode when Active/Inactive button is clicked", async () => {
      renderWithProvider();
      // The Active/Inactive button is the first button in the row, with text "Active" or "Inactive"
      const activeButton = await waitFor(() => screen.getByLabelText(/Activate schedule|Deactivate schedule/));
      fireEvent.click(activeButton);
      // The edit form should NOT appear
      expect(screen.queryByTestId("header-save-button")).not.toBeInTheDocument();
    });
  });


  describe("ScheduleListItem rendering", () => {
    const baseSchedule = {
      id: "test-id",
      name: "Test Schedule",
      mode: "code",
      modeDisplayName: "Code",
      taskInstructions: "Test instructions",
      scheduleType: "time" as const,
      timeInterval: "10",
      timeUnit: "minutes" as const,
      selectedDays: {},
      startDate: "2025-01-01",
      startHour: "10",
      startMinute: "00",
      expirationDate: "",
      expirationHour: "00",
      expirationMinute: "00",
      requireActivity: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true,
      taskInteraction: "wait" as const,
      inactivityDelay: "5",
    };

    // Use the same date formatting as the component
    const formatDateWithoutYearAndSeconds = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    it("renders only last execution time when present", async () => {
      const scheduleWithExecution = {
        ...baseSchedule,
        lastExecutionTime: "2025-04-23T12:00:00.000Z",
        lastSkippedTime: undefined,
        lastTaskId: "task-1",
      };
      setMockSchedules([scheduleWithExecution]);
      render(
        <ExtensionStateContextProvider>
          <SchedulerView onDone={jest.fn()} />
        </ExtensionStateContextProvider>
      );
      await waitFor(() => {
        expect(screen.getByText(/Last executed:/)).toBeInTheDocument();
      });
      expect(screen.getByText(formatDateWithoutYearAndSeconds(scheduleWithExecution.lastExecutionTime))).toBeInTheDocument();
      expect(screen.getByTitle("Click to view/resume this task in Roo Code")).toBeInTheDocument(); // Check for button
      expect(screen.queryByText(/Last skipped:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Last executed:/).querySelector('.codicon-clock')).toBeInTheDocument();
    });

    it("renders only last skipped time when present and execution time is missing", async () => {
      const scheduleWithSkip = {
        ...baseSchedule,
        lastExecutionTime: undefined,
        lastSkippedTime: "2025-04-23T11:00:00.000Z",
      };
      setMockSchedules([scheduleWithSkip]);
      render(
        <ExtensionStateContextProvider>
          <SchedulerView onDone={jest.fn()} />
        </ExtensionStateContextProvider>
      );
      await waitFor(() => {
        expect(screen.getByText(/Last skipped:/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Last executed:/)).not.toBeInTheDocument();
      // Find the element containing "Last skipped:" and check if it contains the correct date
      const skippedElement = screen.getByText(/Last skipped:/);
      expect(skippedElement.textContent).toContain(formatDateWithoutYearAndSeconds(scheduleWithSkip.lastSkippedTime));
      expect(screen.getByText(/Last skipped:/).querySelector('.codicon-debug-step-back')).toBeInTheDocument();
    });

    it("renders both times when skipped time is later than execution time", async () => {
      const scheduleWithBoth = {
        ...baseSchedule,
        lastExecutionTime: "2025-04-23T10:00:00.000Z",
        lastSkippedTime: "2025-04-23T11:00:00.000Z",
        lastTaskId: undefined, // No task ID for this execution
      };
      setMockSchedules([scheduleWithBoth]);
      render(
        <ExtensionStateContextProvider>
          <SchedulerView onDone={jest.fn()} />
        </ExtensionStateContextProvider>
      );
      await waitFor(() => {
        expect(screen.getByText(/Last executed:/)).toBeInTheDocument();
        expect(screen.getByText(/Last skipped:/)).toBeInTheDocument();
      });
      // Find the element containing "Last executed:" and check if it contains the correct date
      const executedElement = screen.getByText(/Last executed:/);
      expect(executedElement.textContent).toContain(formatDateWithoutYearAndSeconds(scheduleWithBoth.lastExecutionTime));
      expect(screen.queryByTitle("Click to view/resume this task in Roo Code")).not.toBeInTheDocument(); // No button without task ID
      // Find the element containing "Last skipped:" and check if it contains the correct date
      const skippedElement = screen.getByText(/Last skipped:/);
      expect(skippedElement.textContent).toContain(formatDateWithoutYearAndSeconds(scheduleWithBoth.lastSkippedTime));
      expect(screen.getByText(/Last executed:/).querySelector('.codicon-clock')).toBeInTheDocument();
      expect(screen.getByText(/Last skipped:/).querySelector('.codicon-debug-step-back')).toBeInTheDocument();
    });

    it("renders only execution time when it is later than skipped time", async () => {
      const scheduleWithLaterExecution = {
        ...baseSchedule,
        lastExecutionTime: "2025-04-23T12:00:00.000Z",
        lastSkippedTime: "2025-04-23T11:00:00.000Z",
        lastTaskId: "task-2",
      };
      setMockSchedules([scheduleWithLaterExecution]);
      render(
        <ExtensionStateContextProvider>
          <SchedulerView onDone={jest.fn()} />
        </ExtensionStateContextProvider>
      );
      await waitFor(() => {
        expect(screen.getByText(/Last executed:/)).toBeInTheDocument();
      });
      expect(screen.getByText(formatDateWithoutYearAndSeconds(scheduleWithLaterExecution.lastExecutionTime))).toBeInTheDocument();
      expect(screen.getByTitle("Click to view/resume this task in Roo Code")).toBeInTheDocument(); // Check for button
      expect(screen.queryByText(/Last skipped:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Last executed:/).querySelector('.codicon-clock')).toBeInTheDocument();
    });

    it("renders both times when skipped time is equal to execution time", async () => {
      const scheduleWithEqualTimes = {
        ...baseSchedule,
        lastExecutionTime: "2025-04-23T11:00:00.000Z",
        lastSkippedTime: "2025-04-23T11:00:00.000Z",
        lastTaskId: "task-3",
      };
      setMockSchedules([scheduleWithEqualTimes]);
      render(
        <ExtensionStateContextProvider>
          <SchedulerView onDone={jest.fn()} />
        </ExtensionStateContextProvider>
      );
      await waitFor(() => {
        expect(screen.getByText(/Last executed:/)).toBeInTheDocument();
        expect(screen.getByText(/Last skipped:/)).toBeInTheDocument();
      });
      expect(screen.getByText(formatDateWithoutYearAndSeconds(scheduleWithEqualTimes.lastExecutionTime))).toBeInTheDocument();
      expect(screen.getByTitle("Click to view/resume this task in Roo Code")).toBeInTheDocument(); // Check for button
      expect(screen.getByText(formatDateWithoutYearAndSeconds(scheduleWithEqualTimes.lastSkippedTime))).toBeInTheDocument();
      expect(screen.getByText(/Last executed:/).querySelector('.codicon-clock')).toBeInTheDocument();
      expect(screen.getByText(/Last skipped:/).querySelector('.codicon-debug-step-back')).toBeInTheDocument();
    });
  });

});
