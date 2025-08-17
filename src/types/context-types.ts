import type Anthropic from '@anthropic-ai/sdk';

// Context window management types

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface MessagePriority {
  level: 'critical' | 'high' | 'medium' | 'low';
  score: number; // 0-100
  reason: string;
}

export interface MessageMetadata {
  timestamp: Date;
  priority: MessagePriority;
  tokenCount: number;
  messageType: 'user' | 'assistant' | 'system';
  summary?: string;
}

export interface EnhancedMessage extends Anthropic.MessageParam {
  metadata: MessageMetadata;
}

export interface ConversationSummary {
  summary: string;
  keyPoints: string[];
  importantDecisions: string[];
  userPreferences: Record<string, string>;
  lastSummaryTimestamp: Date;
  originalMessageCount: number;
  summarizedTokens: number;
}

export interface ContextWindow {
  maxTokens: number;
  currentTokens: number;
  messages: EnhancedMessage[];
  summary: ConversationSummary | null;
  reservedTokens: number; // for system prompt, etc.
}

export interface ContextOptimizationStrategy {
  enableSummarization: boolean;
  summaryThreshold: number; // number of messages before summarizing
  priorityThreshold: MessagePriority['level']; // minimum priority to keep
  maxHistoryMessages: number;
  tokenBudgetRatio: number; // percentage of tokens to use for history
}

export interface ContextOptimizationResult {
  originalTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  savingsPercentage: number;
  messagesRemoved: number;
  messagesKept: number;
  summaryGenerated: boolean;
}
