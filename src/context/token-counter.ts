import type Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '../types/context-types';

/**
 * Token counting utility for context window management
 * Factor 3: Own Your Context Window
 */
export class TokenCounter {
  // Approximate token counting using character-based estimation
  // Note: This is a simplified approach. For production, consider using
  // tiktoken or the official OpenAI tokenizer for more accurate counting

  private static readonly CHARS_PER_TOKEN = 4; // Average for English text
  private static readonly TOKEN_BUFFER = 50; // Safety buffer for estimation errors

  /**
   * Estimate token count for a text string
   */
  static countTokens(text: string): number {
    if (!text) return 0;
    
    // Basic estimation: characters / 4 + buffer
    const estimatedTokens = Math.ceil(text.length / this.CHARS_PER_TOKEN);
    return estimatedTokens + this.TOKEN_BUFFER;
  }

  /**
   * Count tokens for a single message
   */
  static countMessageTokens(message: Anthropic.MessageParam): number {
    let totalTokens = 0;

    if (typeof message.content === 'string') {
      totalTokens += this.countTokens(message.content);
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          totalTokens += this.countTokens(content.text);
        }
        // Add handling for other content types (images, etc.) if needed
      }
    }

    // Add overhead for message structure (role, formatting, etc.)
    totalTokens += 10;

    return totalTokens;
  }

  /**
   * Count tokens for multiple messages
   */
  static countMessagesTokens(messages: Anthropic.MessageParam[]): number {
    return messages.reduce((total, message) => {
      return total + this.countMessageTokens(message);
    }, 0);
  }

  /**
   * Calculate token usage statistics
   */
  static calculateTokenUsage(
    messages: Anthropic.MessageParam[],
    systemPrompt?: string
  ): TokenUsage {
    const promptTokens = this.countMessagesTokens(messages) + 
                        (systemPrompt ? this.countTokens(systemPrompt) : 0);
    
    return {
      promptTokens,
      completionTokens: 0, // Will be updated after API response
      totalTokens: promptTokens,
    };
  }

  /**
   * Check if adding a message would exceed token limit
   */
  static wouldExceedLimit(
    currentMessages: Anthropic.MessageParam[],
    newMessage: Anthropic.MessageParam,
    maxTokens: number,
    systemPrompt?: string
  ): boolean {
    const currentTokens = this.calculateTokenUsage(currentMessages, systemPrompt).totalTokens;
    const newMessageTokens = this.countMessageTokens(newMessage);
    
    return (currentTokens + newMessageTokens) > maxTokens;
  }

  /**
   * Estimate available tokens for completion
   */
  static getAvailableTokens(
    messages: Anthropic.MessageParam[],
    maxTokens: number,
    systemPrompt?: string,
    reservedTokens: number = 500 // Reserve for completion
  ): number {
    const usedTokens = this.calculateTokenUsage(messages, systemPrompt).totalTokens;
    const available = maxTokens - usedTokens - reservedTokens;
    
    return Math.max(0, available);
  }
}