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
      globalStorageUri: { fsPath: "/mock/storage" },
    };
    // Mock output channel
    outputChannelMock = {
      appendLine: jest.fn(),
    };
    jest.spyOn(vscode.window, "createOutputChannel").mockReturnValue(outputChannelMock);
    jest.clearAllMocks();
  });

  it("activates extension without error", async () => {

    // Mock dynamic import for SchedulerService
    jest.doMock("../services/scheduler/SchedulerService", () => ({
      SchedulerService: {
        getInstance: () => ({
          initialize: jest.fn().mockResolvedValue(undefined),
        }),
      },
    }));

    await activate(context);
    expect(outputChannelMock.appendLine).toHaveBeenCalledWith("Kilo-Code extension activated");
  });
});
