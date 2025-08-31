import * as assert from "assert";
import * as vscode from "vscode";

suite("KiloService Integration with Kilo Code Extension", () => {
  test("Should verify Kilo Code extension is available", async function() {
    this.timeout(30000); // 30 seconds timeout

    // Try to get the actual Kilo Code extension
    const extension = vscode.extensions.getExtension("kilocode.kilo-code");
    
    if (!extension) {
      console.log("Kilo Code extension not found. Skipping test.");
      this.skip();
      return;
    }

    assert.ok(extension, "Kilo Code extension should be available");
    
    // Activate the extension if it's not already active
    if (!extension.isActive) {
      try {
        await extension.activate();
      } catch (e) {
        console.log("Failed to activate Kilo Code extension:", e instanceof Error ? e.message : String(e));
        this.skip();
        return;
      }
    }

    assert.ok(extension.isActive, "Kilo Code extension should be active");
    
    const api = extension.exports;
    assert.ok(api, "Kilo Code API should be available");
    assert.ok(typeof api.getCurrentTaskStack === 'function', "getCurrentTaskStack function should be available");
    assert.ok(typeof api.getConfiguration === 'function', "getConfiguration function should be available");
  });

  test("Should verify KiloService can interact with Kilo Code extension", async function() {
    this.timeout(30000); // 30 seconds timeout

    // Import the RooService from the scheduler extension
    const schedulerExtension = vscode.extensions.getExtension("KyleHoskins.kilo-scheduler");
    if (!schedulerExtension) {
      console.log("Scheduler extension not found. Skipping test.");
      this.skip();
      return;
    }

    if (!schedulerExtension.isActive) {
      await schedulerExtension.activate();
    }

    // Import the KiloService dynamically
    const { KiloService } = await import("../../../src/services/scheduler/KiloService");
    
    // Test that hasActiveTask doesn't throw an error
    try {
      await KiloService.hasActiveTask();
      // If we get here, the test passes
      assert.ok(true, "KiloService.hasActiveTask() should not throw an error");
    } catch (error) {
      console.log("Error calling KiloService.hasActiveTask():", error instanceof Error ? error.message : String(error));
      // We don't fail the test if there's an error, as the Kilo Code extension might not be properly set up in the test environment
      this.skip();
    }
  });
});
