/**
 * Type guards for OpenAI Responses API streaming events
 *
 * Runtime type checking functions to safely narrow types for events
 * that are not included in the official OpenAI SDK type definitions.
 */

import type { Responses } from 'openai/resources/responses';

/**
 * Streaming event for completed function call items.
 * The actual event type from OpenAI is 'response.output_item.done'
 * with item.type === 'function_call'.
 */
export interface ResponseFunctionCallEvent {
  type: 'response.output_item.done';
  item: {
    type: 'function_call';
    name: string;
    arguments: string;
    call_id: string;
    id: string;
    status: string;
  };
}

/**
 * Type guard to check if an event is a completed function call output item.
 * Detects 'response.output_item.done' events where item.type === 'function_call'.
 *
 * @param event - The streaming event to check
 * @returns true if the event is a function call output item done event
 */
export function isResponseFunctionCallEvent(
  event: unknown
): event is ResponseFunctionCallEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    (event as { type: unknown }).type === 'response.output_item.done' &&
    'item' in event &&
    typeof (event as { item: unknown }).item === 'object' &&
    (event as { item: { type: unknown } }).item !== null &&
    (event as { item: { type: unknown } }).item.type === 'function_call' &&
    'name' in (event as { item: Record<string, unknown> }).item &&
    'arguments' in (event as { item: Record<string, unknown> }).item
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
