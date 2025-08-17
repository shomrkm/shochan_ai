import type Anthropic from '@anthropic-ai/sdk';
import type {
  ContextOptimizationResult,
  ContextOptimizationStrategy,
  ContextWindow,
  ConversationSummary,
  EnhancedMessage,
} from '../types/context-types';
import { MessagePrioritizer } from './message-prioritizer';
import { TokenCounter } from './token-counter';

/**
 * Main context window manager implementing Factor 3: Own Your Context Window
 * Provides strategic context management with summarization and prioritization
 */
export class ContextManager {
  private strategy: ContextOptimizationStrategy;
  private contextWindow: ContextWindow;

  constructor(strategy: Partial<ContextOptimizationStrategy> = {}) {
    this.strategy = {
      enableSummarization: true,
      summaryThreshold: 10,
      priorityThreshold: 'medium',
      maxHistoryMessages: 20,
      tokenBudgetRatio: 0.7,
      ...strategy,
    };

    this.contextWindow = {
      maxTokens: 8000, // Conservative default for Claude
      currentTokens: 0,
      messages: [],
      summary: null,
      reservedTokens: 1000, // Reserve for system prompt and completion
    };
  }

  /**
   * Add a new message to the context window
   */
  addMessage(
    message: Anthropic.MessageParam,
    conversationContext?: {
      isRecent: boolean;
      containsDecision: boolean;
      hasUserPreference: boolean;
      toolCallResult: boolean;
    }
  ): ContextOptimizationResult {
    // Create enhanced message with metadata
    const enhancedMessage = MessagePrioritizer.createEnhancedMessage(message, conversationContext);

    // Add to context window
    this.contextWindow.messages.push(enhancedMessage);
    this.updateCurrentTokens();

    // Optimize if necessary
    return this.optimizeContext();
  }

  /**
   * Optimize the context window based on current strategy
   */
  optimizeContext(): ContextOptimizationResult {
    // Check if optimization is needed
    const availableTokens = this.getAvailableTokens();
    const needsOptimization =
      availableTokens < 500 || // Low on available tokens
      this.contextWindow.messages.length > this.strategy.maxHistoryMessages ||
      (this.strategy.enableSummarization &&
        this.contextWindow.messages.length >= this.strategy.summaryThreshold);

    const originalTokens = this.contextWindow.currentTokens;
    const originalMessageCount = this.contextWindow.messages.length;
    if (!needsOptimization) {
      return this.createOptimizationResult(originalTokens, originalMessageCount, false);
    }

    // Strategy 1: Summarize old messages
    let summaryGenerated = false;
    if (
      this.strategy.enableSummarization &&
      this.contextWindow.messages.length >= this.strategy.summaryThreshold
    ) {
      summaryGenerated = this.summarizeOldMessages();
    }

    // Strategy 2: Remove low-priority messages
    this.removeLowPriorityMessages();

    // Strategy 3: Limit message count
    this.limitMessageCount();

    // Update token count
    this.updateCurrentTokens();

    return this.createOptimizationResult(originalTokens, originalMessageCount, summaryGenerated);
  }

  /**
   * Get optimized messages for API call
   */
  getOptimizedMessages(): Anthropic.MessageParam[] {
    return this.contextWindow.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Get current context statistics
   */
  getContextStats() {
    return {
      currentTokens: this.contextWindow.currentTokens,
      maxTokens: this.contextWindow.maxTokens,
      availableTokens: this.getAvailableTokens(),
      messageCount: this.contextWindow.messages.length,
      hasSummary: !!this.contextWindow.summary,
      utilizationPercentage:
        (this.contextWindow.currentTokens / this.contextWindow.maxTokens) * 100,
    };
  }

  /**
   * Update strategy configuration
   */
  updateStrategy(newStrategy: Partial<ContextOptimizationStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  private summarizeOldMessages(): boolean {
    const messagesToSummarize = Math.floor(this.contextWindow.messages.length * 0.4);

    if (messagesToSummarize < 3) return false; // Not worth summarizing

    // Take oldest messages for summarization
    const oldMessages = this.contextWindow.messages.splice(0, messagesToSummarize);

    // Generate summary
    const summary = this.generateConversationSummary(oldMessages);

    // Update or create summary
    if (this.contextWindow.summary) {
      this.contextWindow.summary = this.mergeSummaries(this.contextWindow.summary, summary);
    } else {
      this.contextWindow.summary = summary;
    }

    return true;
  }

  private removeLowPriorityMessages(): void {
    this.contextWindow.messages = MessagePrioritizer.filterByPriority(
      this.contextWindow.messages,
      this.strategy.priorityThreshold
    );
  }

  private limitMessageCount(): void {
    if (this.contextWindow.messages.length > this.strategy.maxHistoryMessages) {
      // Sort by priority and keep the most important ones
      const sortedMessages = MessagePrioritizer.sortByPriority(this.contextWindow.messages);
      this.contextWindow.messages = sortedMessages.slice(0, this.strategy.maxHistoryMessages);
    }
  }

  private generateConversationSummary(messages: EnhancedMessage[]): ConversationSummary {
    const keyPoints: string[] = [];
    const importantDecisions: string[] = [];
    const userPreferences: Record<string, string> = {};

    // Extract key information from messages
    for (const message of messages) {
      if (
        message.metadata.priority.level === 'critical' ||
        message.metadata.priority.level === 'high'
      ) {
        keyPoints.push(message.metadata.summary || 'Important message');
      }

      // Extract decisions and preferences (simplified)
      const content = this.extractTextContent(message);
      if (content.includes('decide') || content.includes('choose')) {
        importantDecisions.push(content.substring(0, 100) + '...');
      }
    }

    // Generate overall summary
    const summary = `Conversation covered ${messages.length} messages with ${keyPoints.length} key points and ${importantDecisions.length} decisions.`;

    return {
      summary,
      keyPoints,
      importantDecisions,
      userPreferences,
      lastSummaryTimestamp: new Date(),
      originalMessageCount: messages.length,
      summarizedTokens: messages.reduce((total, msg) => total + msg.metadata.tokenCount, 0),
    };
  }

  private mergeSummaries(
    existing: ConversationSummary,
    newSummary: ConversationSummary
  ): ConversationSummary {
    return {
      summary: `${existing.summary} ${newSummary.summary}`,
      keyPoints: [...existing.keyPoints, ...newSummary.keyPoints],
      importantDecisions: [...existing.importantDecisions, ...newSummary.importantDecisions],
      userPreferences: { ...existing.userPreferences, ...newSummary.userPreferences },
      lastSummaryTimestamp: new Date(),
      originalMessageCount: existing.originalMessageCount + newSummary.originalMessageCount,
      summarizedTokens: existing.summarizedTokens + newSummary.summarizedTokens,
    };
  }

  private updateCurrentTokens(): void {
    const messages = this.getOptimizedMessages();
    this.contextWindow.currentTokens = TokenCounter.countMessagesTokens(messages);

    // Add summary tokens if exists
    if (this.contextWindow.summary) {
      this.contextWindow.currentTokens += TokenCounter.countTokens(
        this.contextWindow.summary.summary
      );
    }
  }

  private getAvailableTokens(): number {
    return Math.max(
      0,
      this.contextWindow.maxTokens -
        this.contextWindow.currentTokens -
        this.contextWindow.reservedTokens
    );
  }

  private createOptimizationResult(
    originalTokens: number,
    originalMessageCount: number,
    summaryGenerated: boolean
  ): ContextOptimizationResult {
    const currentTokens = this.contextWindow.currentTokens;
    const currentMessageCount = this.contextWindow.messages.length;

    return {
      originalTokens,
      optimizedTokens: currentTokens,
      tokensSaved: Math.max(0, originalTokens - currentTokens),
      savingsPercentage:
        originalTokens > 0 ? ((originalTokens - currentTokens) / originalTokens) * 100 : 0,
      messagesRemoved: Math.max(0, originalMessageCount - currentMessageCount),
      messagesKept: currentMessageCount,
      summaryGenerated,
    };
  }

  private extractTextContent(message: EnhancedMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    } else if (Array.isArray(message.content)) {
      return message.content
        .filter((content) => content.type === 'text')
        .map((content) => (content as any).text)
        .join(' ');
    }
    return '';
  }
}
