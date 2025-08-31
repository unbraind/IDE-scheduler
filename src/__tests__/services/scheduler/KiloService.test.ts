import * as vscode from 'vscode';
import { KiloService } from '../../../services/scheduler/KiloService';
import { KiloCodeAPI } from '../../../kilo-code';

// Mock vscode
jest.mock('vscode', () => ({
	extensions: {
		getExtension: jest.fn()
	}
}));

describe('KiloService', () => {
	let mockKiloCodeAPI: jest.Mocked<KiloCodeAPI>;
	
	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks();
		
		// Create mock KiloCodeAPI
		mockKiloCodeAPI = {
			getConfiguration: jest.fn(),
			startNewTask: jest.fn(),
			resumeTask: jest.fn(),
			isTaskInHistory: jest.fn(),
			getCurrentTaskStack: jest.fn(),
			clearCurrentTask: jest.fn(),
			cancelCurrentTask: jest.fn(),
			sendMessage: jest.fn(),
			pressPrimaryButton: jest.fn(),
			pressSecondaryButton: jest.fn(),
			setConfiguration: jest.fn(),
			createProfile: jest.fn(),
			getProfiles: jest.fn(),
			setActiveProfile: jest.fn(),
			getActiveProfile: jest.fn(),
			deleteProfile: jest.fn(),
			isReady: jest.fn(),
			on: jest.fn(),
			off: jest.fn(),
			emit: jest.fn(),
			addListener: jest.fn(),
			once: jest.fn(),
			removeListener: jest.fn(),
			removeAllListeners: jest.fn(),
			setMaxListeners: jest.fn(),
			getMaxListeners: jest.fn(),
			listeners: jest.fn(),
			rawListeners: jest.fn(),
			eventNames: jest.fn(),
			listenerCount: jest.fn(),
			prependListener: jest.fn(),
			prependOnceListener: jest.fn()
		} as any;
	});
	
	describe('getAvailableModes', () => {
		it('should return modes from Kilo Code configuration when available', async () => {
			// Arrange
			const mockCustomModes = [
				{
					slug: 'architect',
					name: 'Architect',
					roleDefinition: 'Architect role',
					groups: ['read', 'edit'],
					customInstructions: 'Some instructions',
					source: 'global'
				},
				{
					slug: 'code',
					name: 'Code',
					roleDefinition: 'Code role',
					groups: ['read', 'edit', 'command'],
					customInstructions: 'Other instructions',
					source: 'project'
				}
			];
			
			const mockConfig = {
				customModes: mockCustomModes
			};
			
			mockKiloCodeAPI.getConfiguration.mockReturnValue(mockConfig as any);
			(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				isActive: true,
				exports: mockKiloCodeAPI
			});
			
			// Act
			const result = await KiloService.getAvailableModes();
			
			// Assert
			expect(result).toEqual(mockCustomModes);
			expect(mockKiloCodeAPI.getConfiguration).toHaveBeenCalled();
		});
		
		it('should return empty array when no custom modes are available', async () => {
			// Arrange
			const mockConfig = {
				customModes: []
			};
			
			mockKiloCodeAPI.getConfiguration.mockReturnValue(mockConfig as any);
			(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				isActive: true,
				exports: mockKiloCodeAPI
			});
			
			// Act
			const result = await KiloService.getAvailableModes();
			
			// Assert
			expect(result).toEqual([]);
		});
		
		it('should return empty array when customModes is not an array', async () => {
			// Arrange
			const mockConfig = {
				customModes: null
			};
			
			mockKiloCodeAPI.getConfiguration.mockReturnValue(mockConfig as any);
			(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				isActive: true,
				exports: mockKiloCodeAPI
			});
			
			// Act
			const result = await KiloService.getAvailableModes();
			
			// Assert
			expect(result).toEqual([]);
		});
		
		it('should return empty array when Kilo Code extension is not available', async () => {
			// Arrange
			(vscode.extensions.getExtension as jest.Mock).mockReturnValue(null);
			
			// Act
			const result = await KiloService.getAvailableModes();
			
			// Assert
			expect(result).toEqual([]);
		});
		
		it('should return empty array when Kilo Code extension is not active', async () => {
			// Arrange
			(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				isActive: false
			});
			
			// Act
			const result = await KiloService.getAvailableModes();
			
			// Assert
			expect(result).toEqual([]);
		});
		
		it('should handle errors gracefully and return empty array', async () => {
			// Arrange
			(vscode.extensions.getExtension as jest.Mock).mockImplementation(() => {
				throw new Error('Extension error');
			});
			
			// Act
			const result = await KiloService.getAvailableModes();
			
			// Assert
			expect(result).toEqual([]);
		});
	});
});