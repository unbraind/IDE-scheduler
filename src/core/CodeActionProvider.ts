import * as vscode from "vscode"
import { EditorUtils } from "./EditorUtils"

export const ACTION_NAMES = {
	EXPLAIN: "Kilo Code: Explain Code",
	FIX: "Kilo Code: Fix Code",
	FIX_LOGIC: "Kilo Code: Fix Logic",
	IMPROVE: "Kilo Code: Improve Code",
	ADD_TO_CONTEXT: "Kilo Code: Add to Context",
	NEW_TASK: "Kilo Code: New Task",
} as const

export const COMMAND_IDS = {
	EXPLAIN: "kilo-scheduler.explainCode",
	FIX: "kilo-scheduler.fixCode",
	IMPROVE: "kilo-scheduler.improveCode",
	ADD_TO_CONTEXT: "kilo-scheduler.addToContext",
	NEW_TASK: "kilo-scheduler.newTask",
} as const

export class CodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix,
		vscode.CodeActionKind.RefactorRewrite,
	]

	private createAction(title: string, kind: vscode.CodeActionKind, command: string, args: any[]): vscode.CodeAction {
		const action = new vscode.CodeAction(title, kind)
		action.command = { command, title, arguments: args }
		return action
	}

	private createActionPair(
		baseTitle: string,
		kind: vscode.CodeActionKind,
		baseCommand: string,
		args: any[],
	): vscode.CodeAction[] {
		return [
			this.createAction(`${baseTitle} in New Task`, kind, baseCommand, args),
			this.createAction(`${baseTitle} in Current Task`, kind, `${baseCommand}InCurrentTask`, args),
		]
	}

	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
	): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		try {
			const effectiveRange = EditorUtils.getEffectiveRange(document, range)
			if (!effectiveRange) {
				return []
			}

			const filePath = EditorUtils.getFilePath(document)
			const actions: vscode.CodeAction[] = []

			actions.push(
				this.createAction(
					ACTION_NAMES.ADD_TO_CONTEXT,
					vscode.CodeActionKind.QuickFix,
					COMMAND_IDS.ADD_TO_CONTEXT,
					[
						filePath,
						effectiveRange.text,
						effectiveRange.range.start.line + 1,
						effectiveRange.range.end.line + 1,
					],
				),
			)

			actions.push(
				...this.createActionPair(ACTION_NAMES.EXPLAIN, vscode.CodeActionKind.QuickFix, COMMAND_IDS.EXPLAIN, [
					filePath,
					effectiveRange.text,
					effectiveRange.range.start.line + 1,
					effectiveRange.range.end.line + 1,
				]),
			)

			if (context.diagnostics.length > 0) {
				const relevantDiagnostics = context.diagnostics.filter((d) =>
					EditorUtils.hasIntersectingRange(effectiveRange.range, d.range),
				)

				if (relevantDiagnostics.length > 0) {
					const diagnosticMessages = relevantDiagnostics.map(EditorUtils.createDiagnosticData)
					actions.push(
						...this.createActionPair(ACTION_NAMES.FIX, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
							filePath,
							effectiveRange.text,
							effectiveRange.range.start.line + 1,
							effectiveRange.range.end.line + 1,
							diagnosticMessages,
						]),
					)
				}
			} else {
				actions.push(
					...this.createActionPair(ACTION_NAMES.FIX_LOGIC, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
						filePath,
						effectiveRange.text,
						effectiveRange.range.start.line + 1,
						effectiveRange.range.end.line + 1,
					]),
				)
			}

			actions.push(
				...this.createActionPair(
					ACTION_NAMES.IMPROVE,
					vscode.CodeActionKind.RefactorRewrite,
					COMMAND_IDS.IMPROVE,
					[
						filePath,
						effectiveRange.text,
						effectiveRange.range.start.line + 1,
						effectiveRange.range.end.line + 1,
					],
				),
			)

			return actions
		} catch (error) {
			console.error("Error providing code actions:", error)
			return []
		}
	}
}
