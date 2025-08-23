/**
 * Factor 4: Tools are Just Structured Outputs
 * Simplified tool execution result without complex context management
 */

import type { ToolExecutionMetadata, ToolExecutionStatus } from '../types/tools';

/**
 * Simplified tool execution result
 */
export interface EnrichedToolResult<T = Record<string, unknown>> {
  // Core result
  success: boolean;
  data?: T;

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
  };

  // Simple validation results
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
