/**
 * Factor 4: Tools are Just Structured Outputs
 * Simplified tool executor with basic validation and structured outputs
 */

import type { AgentTool } from '../types/tools';
import { ToolExecutor } from './index'; // Legacy tool executor
import type { EnrichedToolResult } from './tool-execution-context';
import { ToolResultValidator } from './tool-result-validator';

/**
 * Simplified tool executor implementing Factor 4 principles
 */
export class EnhancedToolExecutor {
  private legacyExecutor: ToolExecutor;

  constructor() {
    this.legacyExecutor = new ToolExecutor();
  }

  /**
   * Execute tool with basic enhancements
   */
  async executeWithContext<T = Record<string, unknown>>(
    tool: AgentTool,
    options: {
      traceId?: string;
      timeout?: number;
      maxRetries?: number;
      retryDelayMs?: number;
      enableDebugMode?: boolean;
      validateInput?: boolean;
      validateOutput?: boolean;
    } = {}
  ): Promise<EnrichedToolResult<T>> {
    const startTime = new Date();

    if (options.enableDebugMode) {
      console.log(`🔍 [DEBUG] Executing tool: ${tool.function.name}`);
    }

    try {
      // Input validation phase
      const inputValidation = this.performInputValidation(tool, options.validateInput ?? true);
      if (!inputValidation.isValid) {
        return this.createErrorResult<T>(
          tool,
          startTime,
          'INPUT_VALIDATION_FAILED',
          `Input validation failed: ${inputValidation.errors.join(', ')}`,
          { validationErrors: inputValidation.errors },
          inputValidation
        );
      }

      // Execution phase with retry logic
      const executionResult = await this.executeWithRetry(
        tool, 
        options.maxRetries ?? 2, 
        options.retryDelayMs ?? 1000,
        options.timeout
      );

      // Output validation phase
      const outputValidation = this.performOutputValidation(tool, executionResult, options.validateOutput ?? true);

      // Create and return enriched result
      return this.createSuccessResult<T>(
        tool,
        startTime,
        executionResult.success,
        executionResult.data as T,
        executionResult.message,
        inputValidation,
        outputValidation
      );

    } catch (error) {
      return this.handleExecutionError<T>(tool, startTime, error);
    }
  }

  /**
   * Perform input validation
   */
  private performInputValidation(tool: AgentTool, validateInput: boolean) {
    if (!validateInput) {
      return { isValid: true, errors: [], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tool.function) {
      errors.push('Tool function is missing');
    } else {
      if (!tool.function.name) {
        errors.push('Tool function name is missing');
      }
      if (!tool.function.parameters) {
        errors.push('Tool function parameters are missing');
      }
    }

    // Tool-specific validation
    switch (tool.function.name) {
      case 'create_task':
        if (!tool.function.parameters.title || typeof tool.function.parameters.title !== 'string') {
          errors.push('Task title is required and must be a string');
        }
        if (!tool.function.parameters.task_type) {
          errors.push('Task type is required');
        }
        break;

      case 'create_project':
        if (!tool.function.parameters.name || typeof tool.function.parameters.name !== 'string') {
          errors.push('Project name is required and must be a string');
        }
        if (!tool.function.parameters.importance) {
          errors.push('Project importance is required');
        }
        break;

      case 'user_input':
        if (!tool.function.parameters.message || typeof tool.function.parameters.message !== 'string') {
          errors.push('Message is required and must be a string');
        }
        if (!tool.function.parameters.context || typeof tool.function.parameters.context !== 'string') {
          errors.push('Context is required and must be a string');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Perform output validation
   */
  private performOutputValidation(tool: AgentTool, executionResult: any, validateOutput: boolean) {
    if (!validateOutput || !executionResult.success || !executionResult.data) {
      return null;
    }

    const outputValidation = this.validateToolOutput(tool.function.name, executionResult.data);
    if (!outputValidation.isValid) {
      console.warn(`⚠️ Output validation warnings for ${tool.function.name}:`, outputValidation.warnings);
    }

    return outputValidation;
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    tool: AgentTool,
    maxRetries: number,
    retryDelayMs: number,
    timeoutMs?: number
  ): Promise<{ success: boolean; data?: unknown; message: string }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await this.sleep(retryDelayMs);
      }

      try {
        // Execute tool with optional timeout
        const executionPromise = this.legacyExecutor.execute(tool);
        
        const result = timeoutMs
          ? await Promise.race([executionPromise, this.createTimeoutPromise(timeoutMs)])
          : await executionPromise;

        return {
          success: result.success,
          data: result.data,
          message: result.message || (result.success ? 'Tool executed successfully' : 'Tool execution failed'),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is recoverable
        if (!this.isRecoverableError(lastError)) {
          throw lastError;
        }
      }
    }

    // All retries exhausted
    throw new Error(`All ${maxRetries + 1} attempts failed. Last error: ${lastError?.message}`);
  }

  /**
   * Validate tool output
   */
  private validateToolOutput(toolName: string, data: unknown) {
    switch (toolName) {
      case 'create_task':
        return ToolResultValidator.validateTaskResult(data);
      case 'create_project':
        return ToolResultValidator.validateProjectResult(data);
      case 'user_input':
        return ToolResultValidator.validateUserInputResult(data);
      default:
        return ToolResultValidator.validateToolResult(data);
    }
  }

  /**
   * Create success result
   */
  private createSuccessResult<T>(
    tool: AgentTool,
    startTime: Date,
    success: boolean,
    data?: T,
    message?: string,
    inputValidation?: any,
    outputValidation?: any
  ): EnrichedToolResult<T> {
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - startTime.getTime();

    const result: EnrichedToolResult<T> = {
      success,
      data,
      startTime,
      endTime,
      executionTimeMs,
      status: success ? 'success' : 'partial_success',
      message: message || (success ? 'Tool executed successfully' : 'Tool execution completed with issues'),
      metadata: {
        toolName: tool.function.name,
        inputParameters: tool.function.parameters,
        retryCount: 0,
      },
    };

    if (inputValidation) {
      result.inputValidation = inputValidation;
    }
    if (outputValidation) {
      result.outputValidation = outputValidation;
    }

    return result;
  }

  /**
   * Create error result
   */
  private createErrorResult<T>(
    tool: AgentTool,
    startTime: Date,
    errorCode: string,
    errorMessage: string,
    errorDetails?: Record<string, unknown>,
    inputValidation?: any
  ): EnrichedToolResult<T> {
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - startTime.getTime();

    const result: EnrichedToolResult<T> = {
      success: false,
      startTime,
      endTime,
      executionTimeMs,
      status: this.mapErrorCodeToStatus(errorCode),
      message: `Tool execution failed: ${errorMessage}`,
      metadata: {
        toolName: tool.function.name,
        inputParameters: tool.function.parameters,
        retryCount: 0,
      },
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        recoverable: this.isRecoverableErrorCode(errorCode),
        suggestedAction: this.getSuggestedAction(errorCode),
      },
    };

    if (inputValidation) {
      result.inputValidation = inputValidation;
    }

    return result;
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError<T>(tool: AgentTool, startTime: Date, error: unknown): EnrichedToolResult<T> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
    return this.createErrorResult<T>(
      tool,
      startTime,
      'EXECUTION_ERROR',
      errorMessage,
      { originalError: error instanceof Error ? error.stack : String(error) }
    );
  }

  /**
   * Helper methods
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /temporary/i,
    ];

    return recoverablePatterns.some((pattern) => pattern.test(error.message));
  }

  private isRecoverableErrorCode(errorCode: string): boolean {
    const recoverableCodes = ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMIT', 'TEMPORARY_ERROR'];
    return recoverableCodes.includes(errorCode);
  }

  private mapErrorCodeToStatus(errorCode: string) {
    switch (errorCode) {
      case 'INPUT_VALIDATION_FAILED':
        return 'validation_error' as const;
      case 'TIMEOUT':
        return 'timeout' as const;
      case 'EXECUTION_ERROR':
        return 'failure' as const;
      default:
        return 'failure' as const;
    }
  }

  private getSuggestedAction(errorCode: string): string {
    switch (errorCode) {
      case 'INPUT_VALIDATION_FAILED':
        return 'Check input parameters and ensure they match the expected schema';
      case 'TIMEOUT':
        return 'Consider increasing timeout value or optimizing tool implementation';
      case 'EXECUTION_ERROR':
        return 'Check tool implementation and external dependencies';
      default:
        return 'Review error details and tool configuration';
    }
  }

  /**
   * Test connection (delegates to legacy executor)
   */
  async testConnection(): Promise<boolean> {
    return this.legacyExecutor.testConnection();
  }
}