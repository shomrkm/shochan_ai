/**
 * Factor 4: Tools are Just Structured Outputs
 * Enhanced tool executor with validation, context, and structured outputs
 */

import type { AgentTool } from '../types/tools';
import { ToolResultValidator } from './tool-result-validator';
import {
  ToolExecutionContextBuilder,
  ToolExecutionContextManager,
  type EnrichedToolResult,
  type ToolExecutionContext,
} from './tool-execution-context';
import { ToolExecutor } from './index'; // Legacy tool executor

/**
 * Enhanced tool executor implementing Factor 4 principles
 */
export class EnhancedToolExecutor {
  private legacyExecutor: ToolExecutor;
  private contextManager: ToolExecutionContextManager;
  
  constructor() {
    this.legacyExecutor = new ToolExecutor();
    this.contextManager = new ToolExecutionContextManager();
  }

  /**
   * Execute tool with Factor 4 enhancements
   */
  async executeWithContext<T = Record<string, unknown>>(
    tool: AgentTool,
    options: {
      traceId?: string;
      parentExecutionId?: string;
      timeout?: number;
      maxRetries?: number;
      retryDelayMs?: number;
      enableDebugMode?: boolean;
      validateInput?: boolean;
      validateOutput?: boolean;
    } = {}
  ): Promise<EnrichedToolResult<T>> {
    const context = this.buildExecutionContext(tool, options);
    this.contextManager.registerContext(context);
    
    this.logDebugStart(context);

    try {
      // Input validation phase
      const inputValidation = await this.performInputValidation<T>(tool, context);
      if (inputValidation) {
        return inputValidation;
      }

      // Execution phase
      const executionResult = await this.executeWithRetry(tool, context);
      
      // Output validation phase
      const outputValidation = this.performOutputValidation(tool, context, executionResult);

      // Create and return enriched result
      return this.buildEnrichedResult<T>(context, executionResult, inputValidation, outputValidation);

    } catch (error) {
      return this.handleExecutionError<T>(context, error);
    } finally {
      this.contextManager.completeContext(context.executionId);
    }
  }

  /**
   * Build execution context from tool and options
   */
  private buildExecutionContext(
    tool: AgentTool,
    options: {
      traceId?: string;
      parentExecutionId?: string;
      timeout?: number;
      maxRetries?: number;
      retryDelayMs?: number;
      enableDebugMode?: boolean;
      validateInput?: boolean;
      validateOutput?: boolean;
    }
  ): ToolExecutionContext {
    let contextBuilder = ToolExecutionContextBuilder
      .create(tool.function.name)
      .withInputParameters(tool.function.parameters);

    // Apply all options
    if (options.traceId) {
      contextBuilder = contextBuilder.withTraceId(options.traceId);
    }
    if (options.parentExecutionId) {
      contextBuilder = contextBuilder.withParentExecutionId(options.parentExecutionId);
    }
    if (options.timeout) {
      contextBuilder = contextBuilder.withTimeout(options.timeout);
    }
    if (options.maxRetries !== undefined) {
      contextBuilder = contextBuilder.withRetrySettings(options.maxRetries, options.retryDelayMs || 1000);
    }
    if (options.validateInput !== undefined || options.validateOutput !== undefined) {
      contextBuilder = contextBuilder.withValidationSettings(
        options.validateInput ?? true,
        options.validateOutput ?? true
      );
    }
    if (options.enableDebugMode) {
      contextBuilder = contextBuilder.enableDebugMode();
    }

    return contextBuilder.build();
  }

  /**
   * Log debug information at execution start
   */
  private logDebugStart(context: ToolExecutionContext): void {
    if (context.debugMode) {
      console.log(`🔍 [DEBUG] Starting execution: ${context.executionId} for tool: ${context.toolName}`);
    }
  }

  /**
   * Perform input validation phase
   */
  private async performInputValidation<T>(
    tool: AgentTool,
    context: ToolExecutionContext
  ): Promise<EnrichedToolResult<T> | null> {
    if (!context.validateInput) {
      return null;
    }

    const inputValidation = this.validateToolInput(tool);
    if (!inputValidation.isValid) {
      const errorResult = this.createErrorResult<T>(
        context,
        'INPUT_VALIDATION_FAILED',
        `Input validation failed: ${inputValidation.errors.join(', ')}`,
        { validationErrors: inputValidation.errors }
      );
      errorResult.inputValidation = inputValidation;
      return errorResult;
    }

    return null; // Validation passed
  }

  /**
   * Perform output validation phase
   */
  private performOutputValidation(
    tool: AgentTool,
    context: ToolExecutionContext,
    executionResult: { success: boolean; data?: unknown; message: string }
  ) {
    if (!context.validateOutput || !executionResult.success || !executionResult.data) {
      return null;
    }

    const outputValidation = this.validateToolOutput(tool.function.name, executionResult.data);
    if (!outputValidation.isValid) {
      console.warn(`⚠️ Output validation warnings for ${context.toolName}:`, outputValidation.warnings);
    }

    return outputValidation;
  }

  /**
   * Build enriched result with all validation data
   */
  private buildEnrichedResult<T>(
    context: ToolExecutionContext,
    executionResult: { success: boolean; data?: unknown; message: string },
    inputValidation: any,
    outputValidation: any
  ): EnrichedToolResult<T> {
    const enrichedResult = this.createSuccessResult<T>(
      context,
      executionResult.success,
      executionResult.data as T,
      executionResult.message
    );

    // Add validation results
    if (inputValidation) {
      enrichedResult.inputValidation = inputValidation;
    }
    if (outputValidation) {
      enrichedResult.outputValidation = outputValidation;
    }

    this.logDebugComplete(context, enrichedResult);
    return enrichedResult;
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError<T>(
    context: ToolExecutionContext,
    error: unknown
  ): EnrichedToolResult<T> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
    const errorResult = this.createErrorResult<T>(
      context,
      'EXECUTION_ERROR',
      errorMessage,
      { 
        originalError: error instanceof Error ? error.stack : String(error) 
      }
    );

    if (context.debugMode) {
      console.error(`❌ [DEBUG] Execution failed: ${context.executionId} - ${errorMessage}`);
    }

    return errorResult;
  }

  /**
   * Log debug completion information
   */
  private logDebugComplete<T>(context: ToolExecutionContext, result: EnrichedToolResult<T>): void {
    if (context.debugMode) {
      console.log(`✅ [DEBUG] Completed execution: ${context.executionId} in ${result.executionTimeMs}ms`);
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    tool: AgentTool,
    context: ToolExecutionContext
  ): Promise<{ success: boolean; data?: unknown; message: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= context.maxRetries; attempt++) {
      context.currentRetry = attempt;
      
      if (attempt > 0) {
        if (context.debugMode) {
          console.log(`🔄 [DEBUG] Retry attempt ${attempt}/${context.maxRetries} for ${context.executionId}`);
        }
        await this.sleep(context.retryDelayMs);
      }

      try {
        // Check timeout
        const timeoutPromise = context.timeoutMs 
          ? this.createTimeoutPromise(context.timeoutMs)
          : null;

        // Execute tool
        const executionPromise = this.legacyExecutor.execute(tool);
        
        const result = timeoutPromise
          ? await Promise.race([executionPromise, timeoutPromise])
          : await executionPromise;

        return {
          success: result.success,
          data: result.data,
          message: result.message || (result.success ? 'Tool executed successfully' : 'Tool execution failed')
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is recoverable
        if (!this.isRecoverableError(lastError)) {
          throw lastError;
        }

        // Continue to retry for recoverable errors
      }
    }

    // All retries exhausted
    throw new Error(`All ${context.maxRetries + 1} attempts failed. Last error: ${lastError?.message}`);
  }

  /**
   * Validate tool input
   */
  private validateToolInput(tool: AgentTool) {
    // Basic parameter validation
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
        
      case 'ask_question':
        if (!tool.function.parameters.question || typeof tool.function.parameters.question !== 'string') {
          errors.push('Question is required and must be a string');
        }
        if (!tool.function.parameters.question_type) {
          errors.push('Question type is required');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
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
      case 'ask_question':
        return ToolResultValidator.validateQuestionResult(data);
      default:
        return ToolResultValidator.validateToolResult(data);
    }
  }

  /**
   * Create success result
   */
  private createSuccessResult<T>(
    context: ToolExecutionContext,
    success: boolean,
    data?: T,
    message?: string
  ): EnrichedToolResult<T> {
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - context.startTime.getTime();

    return {
      success,
      data,
      context,
      startTime: context.startTime,
      endTime,
      executionTimeMs,
      status: success ? 'success' : 'partial_success',
      message: message || (success ? 'Tool executed successfully' : 'Tool execution completed with issues'),
      metadata: {
        toolName: context.toolName,
        inputParameters: context.inputParameters,
        retryCount: context.currentRetry,
      }
    };
  }

  /**
   * Create error result
   */
  private createErrorResult<T>(
    context: ToolExecutionContext,
    errorCode: string,
    errorMessage: string,
    errorDetails?: Record<string, unknown>
  ): EnrichedToolResult<T> {
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - context.startTime.getTime();

    return {
      success: false,
      context,
      startTime: context.startTime,
      endTime,
      executionTimeMs,
      status: this.mapErrorCodeToStatus(errorCode),
      message: `Tool execution failed: ${errorMessage}`,
      metadata: {
        toolName: context.toolName,
        inputParameters: context.inputParameters,
        retryCount: context.currentRetry,
      },
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        recoverable: this.isRecoverableErrorCode(errorCode),
        suggestedAction: this.getSuggestedAction(errorCode),
      }
    };
  }

  /**
   * Helper methods
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private isRecoverableError(error: Error): boolean {
    // Define which errors are recoverable (can be retried)
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /temporary/i,
    ];

    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }

  private isRecoverableErrorCode(errorCode: string): boolean {
    const recoverableCodes = [
      'TIMEOUT',
      'NETWORK_ERROR',
      'RATE_LIMIT',
      'TEMPORARY_ERROR'
    ];
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
   * Get execution statistics from context manager
   */
  getExecutionStats() {
    return this.contextManager.getExecutionStats();
  }

  /**
   * Get contexts by trace ID
   */
  getContextsByTrace(traceId: string) {
    return this.contextManager.getContextsByTrace(traceId);
  }

  /**
   * Test connection (delegates to legacy executor)
   */
  async testConnection(): Promise<boolean> {
    return this.legacyExecutor.testConnection();
  }
}