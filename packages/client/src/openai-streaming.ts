/**
 * Type guards for OpenAI Responses API streaming events
 *
 * Runtime type checking functions to safely narrow types for events
 * that are not included in the official OpenAI SDK type definitions.
 */

import type { Responses } from 'openai/resources/responses';

/**
 * Streaming event for function call detection (re-exported from .d.ts)
 */
export interface ResponseFunctionCallEvent {
  name: string;
  arguments: string;
  sequence_number: number;
  type: 'response.function_call';
}

/**
 * Type guard to check if an event is a ResponseFunctionCallEvent
 *
 * @param event - The streaming event to check
 * @returns true if the event is a function call event
 */
export function isResponseFunctionCallEvent(
  event: unknown
): event is ResponseFunctionCallEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    (event as { type: unknown }).type === 'response.function_call' &&
    'name' in event &&
    'arguments' in event
  );
}

/**
 * Type guard to check if an event is a ResponseTextDeltaEvent
 *
 * @param event - The streaming event to check
 * @returns true if the event is a text delta event
 */
export function isResponseTextDeltaEvent(
  event: unknown
): event is Responses.ResponseTextDeltaEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    (event as { type: unknown }).type === 'response.output_text.delta'
  );
}
