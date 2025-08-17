/**
 * Factor 4: Tools are Just Structured Outputs
 * Validation utilities for structured tool results
 */

import type { ToolExecutionError, ToolResult } from '../types/tools';

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Type guard functions
function hasProperty<T extends PropertyKey>(obj: unknown, prop: T): obj is Record<T, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Tool Result Validator class implementing Factor 4 principles
 */
export class ToolResultValidator {
  /**
   * Validate task creation result
   */
  static validateTaskResult(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Task result data is missing or not an object');
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    if (!hasProperty(data, 'task_id') || !isString(data.task_id)) {
      errors.push('task_id is required and must be a string');
    }

    if (!hasProperty(data, 'title') || !isString(data.title)) {
      errors.push('title is required and must be a string');
    }

    if (!hasProperty(data, 'description') || !isString(data.description)) {
      errors.push('description is required and must be a string');
    }

    if (!hasProperty(data, 'task_type') || !isString(data.task_type)) {
      errors.push('task_type is required and must be a string');
    }

    if (!hasProperty(data, 'created_at') || !isDate(data.created_at)) {
      errors.push('created_at is required and must be a Date');
    }

    // Optional fields validation
    if (
      hasProperty(data, 'notion_url') &&
      data.notion_url !== undefined &&
      !isString(data.notion_url)
    ) {
      errors.push('notion_url must be a string if provided');
    }

    if (
      hasProperty(data, 'scheduled_date') &&
      data.scheduled_date !== undefined &&
      !isString(data.scheduled_date)
    ) {
      errors.push('scheduled_date must be a string if provided');
    }

    if (
      hasProperty(data, 'project_id') &&
      data.project_id !== undefined &&
      !isString(data.project_id)
    ) {
      errors.push('project_id must be a string if provided');
    }

    // Warnings for best practices
    if (
      hasProperty(data, 'notion_url') &&
      isString(data.notion_url) &&
      !data.notion_url.startsWith('https://')
    ) {
      warnings.push('notion_url should be a valid HTTPS URL');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate project creation result
   */
  static validateProjectResult(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Project result data is missing or not an object');
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    if (!hasProperty(data, 'project_id') || !isString(data.project_id)) {
      errors.push('project_id is required and must be a string');
    }

    if (!hasProperty(data, 'name') || !isString(data.name)) {
      errors.push('name is required and must be a string');
    }

    if (!hasProperty(data, 'description') || !isString(data.description)) {
      errors.push('description is required and must be a string');
    }

    if (!hasProperty(data, 'importance') || !isString(data.importance)) {
      errors.push('importance is required and must be a string');
    }

    if (!hasProperty(data, 'created_at') || !isDate(data.created_at)) {
      errors.push('created_at is required and must be a Date');
    }

    // Optional fields validation
    if (
      hasProperty(data, 'notion_url') &&
      data.notion_url !== undefined &&
      !isString(data.notion_url)
    ) {
      errors.push('notion_url must be a string if provided');
    }

    if (
      hasProperty(data, 'action_plan') &&
      data.action_plan !== undefined &&
      !isString(data.action_plan)
    ) {
      errors.push('action_plan must be a string if provided');
    }

    // Warnings
    if (
      hasProperty(data, 'notion_url') &&
      isString(data.notion_url) &&
      !data.notion_url.startsWith('https://')
    ) {
      warnings.push('notion_url should be a valid HTTPS URL');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate user input result
   */
  static validateUserInputResult(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('User input result data is missing or not an object');
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    if (!hasProperty(data, 'message') || !isString(data.message)) {
      errors.push('message is required and must be a string');
    }

    if (!hasProperty(data, 'context') || !isString(data.context)) {
      errors.push('context is required and must be a string');
    }

    if (!hasProperty(data, 'timestamp') || !isDate(data.timestamp)) {
      errors.push('timestamp is required and must be a Date');
    }

    // Optional fields validation
    if (hasProperty(data, 'user_response') && data.user_response !== undefined && !isString(data.user_response)) {
      errors.push('user_response must be a string if provided');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate tool result structure
   */
  static validateToolResult(toolResult: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!toolResult || typeof toolResult !== 'object') {
      errors.push('Tool result is missing or not an object');
      return { isValid: false, errors, warnings };
    }

    const result = toolResult as Partial<ToolResult>;

    // Required fields validation
    if (typeof result.success !== 'boolean') {
      errors.push('success field is required and must be a boolean');
    }

    if (!result.message || typeof result.message !== 'string') {
      errors.push('message field is required and must be a string');
    }

    if (!result.timestamp || !(result.timestamp instanceof Date)) {
      errors.push('timestamp field is required and must be a Date');
    }

    // Optional fields validation
    if (result.executionTime && typeof result.executionTime !== 'number') {
      errors.push('executionTime must be a number if provided');
    }

    if (result.executionTime && result.executionTime < 0) {
      errors.push('executionTime must be a positive number');
    }

    // Performance warnings
    if (result.executionTime && result.executionTime > 5000) {
      warnings.push('Tool execution took longer than 5 seconds');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate and create structured tool result with proper error handling
   */
  static createValidatedToolResult<T extends Record<string, any>>(
    success: boolean,
    message: string,
    data?: T,
    executionTime?: number
  ): ToolResult<T> {
    const result: ToolResult<T> = {
      success,
      message,
      data,
      timestamp: new Date(),
    };

    if (executionTime !== undefined) {
      result.executionTime = Math.max(0, executionTime); // Ensure non-negative
    }

    // Validate the structure
    const validation = ToolResultValidator.validateToolResult(result);

    if (!validation.isValid) {
      // If validation fails, create an error result
      const errorResult: ToolResult<T> = {
        success: false,
        message: 'Tool result validation failed',
        timestamp: new Date(),
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors.join('; '),
          details: { validationErrors: validation.errors },
          recoverable: false,
          suggestedAction: 'Check tool implementation for proper result structure',
        },
      };
      return errorResult;
    }

    // Add warnings to metadata if present
    if (validation.warnings.length > 0) {
      result.metadata = {
        toolName: 'unknown',
        inputParameters: {},
        warnings: validation.warnings,
      };
    }

    return result;
  }

  /**
   * Create error tool result with structured error information
   */
  static createErrorResult(
    message: string,
    error: ToolExecutionError,
    executionTime?: number
  ): ToolResult {
    return {
      success: false,
      message,
      timestamp: new Date(),
      status: 'failure',
      error,
      executionTime,
    };
  }
}
