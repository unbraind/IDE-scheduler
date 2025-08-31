# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kilo Scheduler is a VS Code extension that provides task scheduling capabilities integrated with Kilo Code. It's a fork of roo-scheduler adapted to work natively with Kilo Code APIs. The extension allows users to schedule recurring tasks and workflows directly within VS Code.

## Development Commands

### Building and Testing
- `npm run build` - Build VSIX package (alias for `npm run vsix`)
- `npm run compile` - Compile TypeScript and build with esbuild
- `npm run build:webview` - Build the webview UI component
- `npm run build:esbuild` - Build main extension with esbuild for production
- `npm run package` - Full package build including webview, esbuild, type checking, and linting

### Development Workflow
- `npm run dev` - Start webview development server
- `npm run watch` - Watch mode for both esbuild and TypeScript compilation
- `npm run watch:esbuild` - Watch mode for esbuild only
- `npm run watch:tsc` - Watch TypeScript compilation without emitting files

### Quality Assurance
- `npm run lint` - Run ESLint on all projects (extension, webview, e2e)
- `npm run check-types` - Run TypeScript type checking on all projects
- `npm run test` - Run tests for extension and webview
- `npm run test:extension` - Run Jest tests for the main extension
- `npm run test:webview` - Run webview-specific tests
- `npm run test:e2e` - Run end-to-end VS Code integration tests

### Installation and Setup
- `npm run install:all` - Install dependencies for all subprojects
- `npm run clean` - Clean build artifacts from all projects

## Architecture Overview

### Core Components

**Extension Entry Point** (`src/extension.ts`)
- Main activation/deactivation logic
- Command registration and VS Code API integration
- Experimental A2A (Agent-to-Agent) communication setup
- MCP (Model Context Protocol) and gRPC server initialization

**Scheduler Service** (`src/services/scheduler/SchedulerService.ts`)
- Singleton service managing scheduled tasks
- Handles task execution timing, persistence, and lifecycle management
- Stores schedules in `.kilo/schedules.json` within workspace

**Kilo Service Integration** (`src/services/scheduler/KiloService.ts`)
- Bridge to Kilo Code extension API
- Handles task creation with specific modes and instructions
- Manages mode configuration and availability

**Webview Provider** (`src/core/webview/ClineProvider.ts`)
- VS Code webview integration for the scheduler UI
- Message handling between extension and React-based webview

### Multi-Agent Architecture

The extension supports experimental cross-IDE agent adapters in `src/services/scheduler/adapters/`:
- KiloCodeAdapter, ClineAdapter, ContinueAdapter, CursorAdapter
- ClaudeCodeAdapter, GeminiCliAdapter, QwenCoderCliAdapter
- Enables Agent-to-Agent (A2A) communication via gRPC and MCP protocols

### Frontend Structure

**React Webview UI** (`webview-ui/`)
- TypeScript React application using VS Code Webview UI Toolkit
- Scheduler interface components, settings management
- Internationalization support with multiple locales

### Key Configuration Files

- `package.json` - Extension manifest with VS Code contribution points and extensive configuration schema
- `tsconfig.json` - TypeScript configuration targeting ES2022 with strict mode
- `esbuild.js` - Custom esbuild configuration for extension bundling

### Data Storage

Schedules are persisted as JSON in the workspace's `.kilo/schedules.json` file. Each schedule contains timing configuration, task instructions, execution history, and interaction preferences (wait/interrupt/skip modes).

### Testing Strategy

- Jest unit tests for core services and utilities
- VS Code integration tests using `@vscode/test-electron`
- Webview component testing with React Testing Library
- E2E testing scenarios in the `e2e/` directory

### Development Notes

- The extension requires the `kilocode.kilo-code` extension as a dependency
- Experimental features are gated behind configuration flags (`experimental.*`)
- Supports multiple locales with i18n infrastructure
- Uses VS Code's webview API for custom UI while maintaining security boundaries