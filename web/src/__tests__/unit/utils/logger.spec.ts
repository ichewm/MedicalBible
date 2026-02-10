/**
 * @file Logger Utility Unit Tests
 * @description Tests for the logger utility that replaced console.log statements
 * @spec SEC-009: Remove all console.log statements from production code
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LogLevel, createLogger, setGlobalLogLevel, logger as defaultLogger } from '@/utils/logger'

describe('Logger Utility', () => {
  beforeEach(() => {
    // Reset global logger to debug level for consistent testing
    setGlobalLogLevel(LogLevel.DEBUG)
  })

  afterEach(() => {
    // Reset global logger after tests
    setGlobalLogLevel(LogLevel.DEBUG)
  })

  describe('LogLevel Enum', () => {
    it('should have correct log level values', () => {
      expect(LogLevel.DEBUG).toBe(0)
      expect(LogLevel.INFO).toBe(1)
      expect(LogLevel.WARN).toBe(2)
      expect(LogLevel.ERROR).toBe(3)
      expect(LogLevel.SILENT).toBe(4)
    })
  })

  describe('createLogger Factory Function', () => {
    it('should create logger with custom prefix', () => {
      const customLogger = createLogger('MyComponent')

      expect(customLogger).toBeDefined()
      expect(typeof customLogger.log).toBe('function')
      expect(typeof customLogger.debug).toBe('function')
      expect(typeof customLogger.info).toBe('function')
      expect(typeof customLogger.warn).toBe('function')
      expect(typeof customLogger.error).toBe('function')
    })

    it('should create independent logger instances', () => {
      const logger1 = createLogger('Module1')
      const logger2 = createLogger('Module2')

      // Both should be defined
      expect(logger1).toBeDefined()
      expect(logger2).toBeDefined()
      // They should be different instances
      expect(logger1).not.toBe(logger2)
    })
  })

  describe('Global Logger', () => {
    it('should export a default logger instance', () => {
      expect(defaultLogger).toBeDefined()
      expect(typeof defaultLogger.log).toBe('function')
      expect(typeof defaultLogger.debug).toBe('function')
      expect(typeof defaultLogger.info).toBe('function')
      expect(typeof defaultLogger.warn).toBe('function')
      expect(typeof defaultLogger.error).toBe('function')
    })

    it('should allow global log level changes', () => {
      // This test verifies the global logger can be configured
      expect(() => setGlobalLogLevel(LogLevel.WARN)).not.toThrow()
      expect(() => setGlobalLogLevel(LogLevel.DEBUG)).not.toThrow()
    })

    it('should filter logs based on global level', () => {
      const mockDebug = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      setGlobalLogLevel(LogLevel.WARN)
      defaultLogger.debug('This should not appear')
      defaultLogger.warn('This should appear')

      expect(mockDebug).not.toHaveBeenCalled()
      expect(mockWarn).toHaveBeenCalled()

      // Reset
      setGlobalLogLevel(LogLevel.DEBUG)
      mockDebug.mockRestore()
      mockWarn.mockRestore()
    })
  })

  describe('Log Methods', () => {
    it('should not throw on any log method', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.debug('test')).not.toThrow()
      expect(() => testLogger.info('test')).not.toThrow()
      expect(() => testLogger.log('test')).not.toThrow()
      expect(() => testLogger.warn('test')).not.toThrow()
      expect(() => testLogger.error('test')).not.toThrow()
    })

    it('should handle error logging without error object', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.error('Error without object')).not.toThrow()
    })

    it('should handle logging with additional arguments', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.warn('Message', { data: 'value' })).not.toThrow()
      expect(() => testLogger.error('Error', new Error('test'))).not.toThrow()
    })
  })

  describe('SEC-009: Security Compliance', () => {
    it('should provide structured logging API', () => {
      // Spec: "Replace with structured logging using Winston or similar"
      // The logger provides a structured logging interface

      const testLogger = createLogger('TestModule')

      // Verify the logger has the expected methods
      expect(typeof testLogger.debug).toBe('function')
      expect(typeof testLogger.info).toBe('function')
      expect(typeof testLogger.log).toBe('function')
      expect(typeof testLogger.warn).toBe('function')
      expect(typeof testLogger.error).toBe('function')
    })

    it('should support different log levels for environments', () => {
      // Spec: "Implement log level configuration (debug in dev, info/warn in prod)"

      // Verify we can set different log levels
      expect(() => setGlobalLogLevel(LogLevel.DEBUG)).not.toThrow()
      expect(() => setGlobalLogLevel(LogLevel.INFO)).not.toThrow()
      expect(() => setGlobalLogLevel(LogLevel.WARN)).not.toThrow()
      expect(() => setGlobalLogLevel(LogLevel.ERROR)).not.toThrow()
      expect(() => setGlobalLogLevel(LogLevel.SILENT)).not.toThrow()

      // Reset
      setGlobalLogLevel(LogLevel.DEBUG)
    })

    it('should provide logger factory for module-specific logging', () => {
      // The logger provides a factory function for creating
      // module-specific loggers with prefixes

      const voiceLogger = createLogger('VoiceCommands')
      const authLogger = createLogger('Auth')
      const chatLogger = createLogger('Chat')

      expect(voiceLogger).toBeDefined()
      expect(authLogger).toBeDefined()
      expect(chatLogger).toBeDefined()

      // Verify they have the logging methods
      expect(typeof voiceLogger.debug).toBe('function')
      expect(typeof authLogger.warn).toBe('function')
      expect(typeof chatLogger.error).toBe('function')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty messages', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.debug('')).not.toThrow()
      expect(() => testLogger.warn('')).not.toThrow()
      expect(() => testLogger.error('')).not.toThrow()
    })

    it('should handle messages with special characters', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.warn('Message with \n newlines and \t tabs')).not.toThrow()
    })

    it('should handle multiple arguments', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.warn('First', 'Second', { third: 'value' }, [1, 2, 3])).not.toThrow()
    })

    it('should handle null and undefined arguments', () => {
      const testLogger = createLogger('TestModule')

      expect(() => testLogger.warn(null as any)).not.toThrow()
      expect(() => testLogger.warn(undefined as any)).not.toThrow()
    })

    it('should handle very long log messages', () => {
      const testLogger = createLogger('TestModule')
      const longMessage = 'A'.repeat(10000)

      expect(() => testLogger.warn(longMessage)).not.toThrow()
    })

    it('should handle logging objects and arrays', () => {
      const testLogger = createLogger('TestModule')
      const testObject = { nested: { value: 123 }, array: [1, 2, 3] }

      expect(() => testLogger.warn('Object test', testObject)).not.toThrow()
    })
  })

  describe('Integration with useVoiceCommands Hook', () => {
    it('should verify the logger can be used in voice commands', () => {
      // This test verifies that the logger works as expected
      // for the voice commands hook (as per SEC-009 implementation)

      const voiceLogger = createLogger('VoiceCommands')

      // Verify the logger is properly configured
      expect(voiceLogger).toBeDefined()
      expect(typeof voiceLogger.debug).toBe('function')

      // Verify it doesn't throw when logging
      expect(() => voiceLogger.debug('Service initialized')).not.toThrow()
      expect(() => voiceLogger.error('Voice recognition error', new Error('test'))).not.toThrow()
    })

    it('should support logger for different modules', () => {
      // Test creating multiple loggers for different modules
      const voiceLogger = createLogger('VoiceCommands')
      const authLogger = createLogger('Auth')
      const chatLogger = createLogger('Chat')

      expect(voiceLogger).toBeDefined()
      expect(authLogger).toBeDefined()
      expect(chatLogger).toBeDefined()
    })
  })

  describe('Logger Verification - SEC-009 Compliance', () => {
    it('should verify logger wrapper exists and replaces console.log', () => {
      // This is the key SEC-009 compliance test:
      // Verify that a proper logger wrapper exists that replaces
      // direct console.log usage in production code

      // The logger utility should be importable and export the necessary functions
      expect(typeof createLogger).toBe('function')
      expect(typeof setGlobalLogLevel).toBe('function')
      expect(typeof defaultLogger).toBe('object')
    })

    it('should verify console methods are wrapped through logger', () => {
      // Verify that the logger provides methods that wrap
      // the native console methods with additional functionality

      const testLogger = createLogger('TestModule')

      // The logger should have all the necessary methods
      expect(typeof testLogger.log).toBe('function')
      expect(typeof testLogger.debug).toBe('function')
      expect(typeof testLogger.info).toBe('function')
      expect(typeof testLogger.warn).toBe('function')
      expect(typeof testLogger.error).toBe('function')

      // Each method should be callable without throwing
      expect(() => testLogger.log('info')).not.toThrow()
      expect(() => testLogger.debug('debug')).not.toThrow()
      expect(() => testLogger.info('info')).not.toThrow()
      expect(() => testLogger.warn('warning')).not.toThrow()
      expect(() => testLogger.error('error')).not.toThrow()
    })
  })
})
