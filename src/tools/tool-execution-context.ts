/**
 * Factor 4: Tools are Just Structured Outputs
 * Tool execution context for enriched tool calling with metadata and tracing
 */

import type { ToolExecutionMetadata, ToolExecutionStatus } from '../types/tools';

/**
 * Rich context for tool execution with Factor 4 principles
 */
export interface ToolExecutionContext {
  // Execution metadata
  executionId: string;
  toolName: string;
  startTime: Date;
  inputParameters: Record<string, unknown>;

  // Tracing and debugging
  parentExecutionId?: string;
  traceId: string;
  debugMode?: boolean;

  // Retry and resilience
  maxRetries: number;
  currentRetry: number;
  retryDelayMs: number;

  // Validation settings
  validateInput: boolean;
  validateOutput: boolean;

  // Performance tracking
  timeoutMs?: number;
  expectedExecutionTimeMs?: number;
}

/**
 * Tool execution result with enriched context
 */
export interface EnrichedToolResult<T = Record<string, unknown>> {
  // Core result
  success: boolean;
  data?: T;

  // Execution context
  context: ToolExecutionContext;

  // Timing information
  startTime: Date;
  endTime: Date;
  executionTimeMs: number;

  // Status and metadata
  status: ToolExecutionStatus;
  message: string;
  metadata: ToolExecutionMetadata;

  // Error handling
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    recoverable: boolean;
    suggestedAction?: string;
    stackTrace?: string;
  };

  // Validation results
  inputValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };

  outputValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Context builder for creating tool execution contexts
 */
export class ToolExecutionContextBuilder {
  private context: Partial<ToolExecutionContext> = {
    maxRetries: 3,
    currentRetry: 0,
    retryDelayMs: 1000,
    validateInput: true,
    validateOutput: true,
  };

  static create(toolName: string): ToolExecutionContextBuilder {
    return new ToolExecutionContextBuilder().withToolName(toolName);
  }

  withToolName(toolName: string): this {
    this.context.toolName = toolName;
    return this;
  }

  withInputParameters(parameters: Record<string, unknown>): this {
    this.context.inputParameters = { ...parameters };
    return this;
  }

  withTraceId(traceId: string): this {
    this.context.traceId = traceId;
    return this;
  }

  withParentExecutionId(parentId: string): this {
    this.context.parentExecutionId = parentId;
    return this;
  }

  withRetrySettings(maxRetries: number, delayMs: number = 1000): this {
    this.context.maxRetries = maxRetries;
    this.context.retryDelayMs = delayMs;
    return this;
  }

  withTimeout(timeoutMs: number): this {
    this.context.timeoutMs = timeoutMs;
    return this;
  }

  withExpectedExecutionTime(expectedMs: number): this {
    this.context.expectedExecutionTimeMs = expectedMs;
    return this;
  }

  withValidationSettings(validateInput: boolean, validateOutput: boolean): this {
    this.context.validateInput = validateInput;
    this.context.validateOutput = validateOutput;
    return this;
  }

  enableDebugMode(): this {
    this.context.debugMode = true;
    return this;
  }

  build(): ToolExecutionContext {
    // Generate unique execution ID
    this.context.executionId = this.generateExecutionId();
    this.context.startTime = new Date();

    // Generate trace ID if not provided
    if (!this.context.traceId) {
      this.context.traceId = this.generateTraceId();
    }

    // Validate required fields
    if (!this.context.toolName) {
      throw new Error('Tool name is required for execution context');
    }

    if (!this.context.inputParameters) {
      this.context.inputParameters = {};
    }

    return this.context as ToolExecutionContext;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  }
}

/**
 * Tool execution context manager for tracking and managing contexts
 */
export class ToolExecutionContextManager {
  private activeContexts = new Map<string, ToolExecutionContext>();
  private contextHistory: ToolExecutionContext[] = [];
  private maxHistorySize = 100;

  /**
   * Register a new execution context
   */
  registerContext(context: ToolExecutionContext): void {
    this.activeContexts.set(context.executionId, context);

    // Add to history (keep size bounded)
    this.contextHistory.push(context);
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory.shift();
    }
  }

  /**
   * Complete an execution context
   */
  completeContext(executionId: string): void {
    this.activeContexts.delete(executionId);
  }

  /**
   * Get active context by execution ID
   */
  getContext(executionId: string): ToolExecutionContext | undefined {
    return this.activeContexts.get(executionId);
  }

  /**
   * Get all contexts for a specific trace
   */
  getContextsByTrace(traceId: string): ToolExecutionContext[] {
    return this.contextHistory.filter((ctx) => ctx.traceId === traceId);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    activeContexts: number;
    totalExecutions: number;
    averageRetryRate: number;
    topExecutedTools: Array<{ toolName: string; count: number }>;
  } {
    const toolCounts = new Map<string, number>();
    let totalRetries = 0;

    for (const context of this.contextHistory) {
      toolCounts.set(context.toolName, (toolCounts.get(context.toolName) || 0) + 1);
      totalRetries += context.currentRetry;
    }

    const topExecutedTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      activeContexts: this.activeContexts.size,
      totalExecutions: this.contextHistory.length,
      averageRetryRate:
        this.contextHistory.length > 0 ? totalRetries / this.contextHistory.length : 0,
      topExecutedTools,
    };
  }

  /**
   * Clear execution history (for testing or cleanup)
   */
  clearHistory(): void {
    this.contextHistory = [];
  }
}
