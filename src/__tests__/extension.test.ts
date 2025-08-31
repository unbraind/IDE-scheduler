import * as vscode from "vscode";
import { activate } from "../extension";
import { KiloService } from "../services/scheduler/KiloService";

jest.mock("../services/scheduler/KiloService");

describe("Extension activation", () => {
  let context: any;
  let outputChannelMock: any;

  beforeEach(() => {
    // Minimal mock for ExtensionContext
    context = {
      subscriptions: [],
      extensionMode: vscode.ExtensionMode.Test,
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    };
    // Mock output channel
    outputChannelMock = {
      appendLine: jest.fn(),
    };
    jest.spyOn(vscode.window, "createOutputChannel").mockReturnValue(outputChannelMock);
    jest.clearAllMocks();
  });

  it("calls KiloService.getLastActivityTimeForActiveTask on activation", async () => {
    const mockGetLastActivity = jest
      .spyOn(KiloService, "getLastActivityTimeForActiveTask")
      .mockResolvedValue(1234567890);

    // Mock dynamic import for SchedulerService
    jest.doMock("../services/scheduler/SchedulerService", () => ({
      SchedulerService: {
        getInstance: () => ({
          initialize: jest.fn().mockResolvedValue(undefined),
        }),
      },
    }));

    await activate(context);

    expect(mockGetLastActivity).toHaveBeenCalled();
    // Optionally, check output log
    // Optionally, check output log
    // expect(outputChannelMock.appendLine).toHaveBeenCalledWith(
    //   expect.stringContaining("KiloService.getLastActivityTimeForActiveTask() called on activation")
    // );
  });
});
