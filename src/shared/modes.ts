import * as vscode from "vscode"

import { GroupOptions, GroupEntry, ModeConfig, PromptComponent, CustomModePrompts } from "../schemas"


export type Mode = string

export type { GroupOptions, GroupEntry, ModeConfig, PromptComponent, CustomModePrompts }

// Helper to get group options if they exist
function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

// Helper to check if a file path matches a regex pattern
export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		const regex = new RegExp(pattern)
		return regex.test(filePath)
	} catch (error) {
		console.error(`Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

// Main modes configuration as an ordered array
export const modes: readonly ModeConfig[] = [
	{
		slug: "code",
		name: "Code",
		roleDefinition:
			"You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "architect",
		name: "Architect",
		roleDefinition:
			"You are Roo, an experienced technical leader who is inquisitive and an excellent planner. Your goal is to gather information and get context to create a detailed plan for accomplishing the user's task, which the user will review and approve before they switch into another mode to implement the solution.",
		groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
		customInstructions:
			"1. Do some information gathering (for example using read_file or search_files) to get more context about the task.\n\n2. You should also ask the user clarifying questions to get a better understanding of the task.\n\n3. Once you've gained more context about the user's request, you should create a detailed plan for how to accomplish the task. Include Mermaid diagrams if they help make your plan clearer.\n\n4. Ask the user if they are pleased with this plan, or if they would like to make any changes. Think of this as a brainstorming session where you can discuss the task and plan the best way to accomplish it.\n\n5. Once the user confirms the plan, ask them if they'd like you to write it to a markdown file.\n\n6. Use the switch_mode tool to request that the user switch to another mode to implement the solution.",
	},
	{
		slug: "ask",
		name: "Ask",
		roleDefinition:
			"You are Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics.",
		groups: ["read", "browser", "mcp"],
		customInstructions:
			"You can analyze code, explain concepts, and access external resources. Make sure to answer the user's questions and don't rush to switch to implementing code. Include Mermaid diagrams if they help make your response clearer.",
	},
	{
		slug: "debug",
		name: "Debug",
		roleDefinition:
			"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the diagnosis before fixing the problem.",
	},
    {
        slug: "orchestrator",
        name: "Orchestrator",
        roleDefinition:
            "You are Roo, a strategic workflow orchestrator coordinating tasks across specialized modes. Select the best specialist for each subtask and manage hand-offs.",
        groups: ["read", "browser", "modes", "mcp"],
        customInstructions:
            "Break complex problems into sub-modes. Propose a plan with explicit mode hand-offs and request user confirmation before dispatching.",
    },
] as const

// Export the default mode slug
export const defaultModeSlug = modes[0].slug

// Helper functions
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return modes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}

// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
    // Always include built-in modes, with project/global custom modes added
    // (and overriding any built-in by the same slug).
    const bySlug = new Map<string, ModeConfig>()

    // Start with built-ins to guarantee base modes are selectable
    for (const m of modes) {
        bySlug.set(m.slug, m)
    }

    // Layer custom modes (project/global), overriding built-ins when slugs match
    if (Array.isArray(customModes)) {
        for (const m of customModes) {
            bySlug.set(m.slug, m)
        }
    }

    return Array.from(bySlug.values())
}

// Check if a mode is custom or an override
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`This mode (${mode}) can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}


// Create the mode-specific default prompts
export const defaultPrompts: Readonly<CustomModePrompts> = Object.freeze(
	Object.fromEntries(
		modes.map((mode) => [
			mode.slug,
			{
				roleDefinition: mode.roleDefinition,
				customInstructions: mode.customInstructions,
			},
		]),
	),
)

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes(customModes)
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: customModePrompts[mode.slug]?.roleDefinition ?? mode.roleDefinition,
		customInstructions: customModePrompts[mode.slug]?.customInstructions ?? mode.customInstructions,
	}))
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<ModeConfig> {
	// First get the base mode config from custom modes or built-in modes
	const baseMode = getModeBySlug(modeSlug, customModes) || modes.find((m) => m.slug === modeSlug) || modes[0]

	// Check for any prompt component overrides
	const promptComponent = customModePrompts?.[modeSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseMode.customInstructions || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	

	// Return mode with any overrides applied
	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}

// Helper function to safely get custom instructions
export function getCustomInstructions(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.customInstructions ?? ""
}
