import * as path from "path"
import Mocha from "mocha"
import { glob } from "glob"
import * as vscode from "vscode"

export async function run() {
	console.log("Starting Kilo Scheduler extension tests");

	// Ensure the scheduler extension is active
	const schedulerExtension = vscode.extensions.getExtension("KyleHoskins.kilo-scheduler");
	if (!schedulerExtension) {
		throw new Error("Scheduler extension not found");
	}

	if (!schedulerExtension.isActive) {
		console.log("Activating Scheduler extension...");
		await schedulerExtension.activate();
	}
	console.log("Scheduler extension is active");

	// Check if Kilo Code extension is available
	const kiloCodeExtension = vscode.extensions.getExtension("kilocode.kilo-code");
	if (kiloCodeExtension) {
		console.log("Kilo Code extension found");
		if (!kiloCodeExtension.isActive) {
			try {
				console.log("Activating Kilo Code extension...");
				await kiloCodeExtension.activate();
				console.log("Kilo Code extension activated successfully");
			} catch (error) {
				console.log("Failed to activate Kilo Code extension:", error instanceof Error ? error.message : String(error));
				console.log("Some tests may be skipped");
			}
		} else {
			console.log("Kilo Code extension is already active");
		}
	} else {
		console.log("Kilo Code extension not found. Some tests may be skipped.");
	}

	// Focus the scheduler sidebar view if available
	try {
		await vscode.commands.executeCommand("kilo-scheduler.SidebarProvider.focus");
		console.log("Focused Scheduler sidebar view");
	} catch (error) {
		console.log("Failed to focus Scheduler sidebar view:", error instanceof Error ? error.message : String(error));
	}

	// Add all the tests to the runner.
	const mocha = new Mocha({ ui: "tdd", timeout: 300_000 });
	const cwd = path.resolve(__dirname, "..");
	const testFiles = await glob("**/**.test.js", { cwd });
	console.log(`Found ${testFiles.length} test files`);
	
	testFiles.forEach((testFile) => {
		console.log(`Adding test file: ${testFile}`);
		mocha.addFile(path.resolve(cwd, testFile));
	});

	// Run the tests
	return new Promise<void>((resolve, reject) =>
		mocha.run((failures) => {
			console.log(`Tests completed with ${failures} failures`);
			failures === 0 ? resolve() : reject(new Error(`${failures} tests failed.`));
		})
	);
}
