import * as assert from "assert"
import * as vscode from "vscode"

suite("Kilo Scheduler Extension", () => {
	test("Extension should be active", async () => {
		const extension = vscode.extensions.getExtension("KyleHoskins.kilo-scheduler")
		assert.ok(extension, "Scheduler extension not found")
		assert.ok(extension.isActive, "Scheduler extension should be active")
	})

	test("Registered commands should be available", async () => {
		// Get all available commands
		const commands = await vscode.commands.getCommands(true);
		
		// Look for commands that start with "kilo-scheduler."
		const kiloSchedulerCommands = commands.filter(cmd => cmd.startsWith("kilo-scheduler."));
		
		// Log the found commands for debugging
		console.log("Found Kilo Scheduler commands:", kiloSchedulerCommands);
		
		// Verify we have at least some commands
		assert.ok(kiloSchedulerCommands.length > 0, "Should find at least one kilo-scheduler command");
		
		// Check for the SidebarProvider.focus command specifically
		assert.ok(
			kiloSchedulerCommands.includes("kilo-scheduler.SidebarProvider.focus"),
			"kilo-scheduler.SidebarProvider.focus command should be registered"
		);
	})

	test("Sidebar view should be registered", async () => {
		// Try to focus the sidebar view
		await assert.doesNotReject(async () => {
			await vscode.commands.executeCommand("kilo-scheduler.SidebarProvider.focus")
		}, "Sidebar view should be registered and focusable")
	})
})
