import type Anthropic from '@anthropic-ai/sdk';
import type { MessagePriority, EnhancedMessage } from '../types/context-types';
import { TokenCounter } from './token-counter';

/**
 * Message prioritization for context window optimization
 * Factor 3: Own Your Context Window
 */
export class MessagePrioritizer {
  /**
   * Analyze message priority based on content and context
   */
  static analyzePriority(
    message: Anthropic.MessageParam,
    conversationContext?: {
      isRecent: boolean;
      containsDecision: boolean;
      hasUserPreference: boolean;
      toolCallResult: boolean;
    }
  ): MessagePriority {
    let score = 50; // Base score
    let reasons: string[] = [];

    // Content-based analysis
    const content = this.extractTextContent(message);
    
    // Critical patterns
    if (this.containsCriticalPatterns(content)) {
      score += 30;
      reasons.push('contains critical information');
    }

    // Tool calls and results are generally important
    if (conversationContext?.toolCallResult) {
      score += 25;
      reasons.push('tool execution result');
    }

    // User preferences and decisions
    if (conversationContext?.containsDecision) {
      score += 20;
      reasons.push('contains user decision');
    }

    if (conversationContext?.hasUserPreference) {
      score += 15;
      reasons.push('contains user preference');
    }

    // Recency bonus
    if (conversationContext?.isRecent) {
      score += 10;
      reasons.push('recent message');
    }

    // Content quality analysis
    const contentScore = this.analyzeContentQuality(content);
    score += contentScore;
    if (contentScore > 0) {
      reasons.push('high-quality content');
    }

    // Message role consideration
    if (message.role === 'user') {
      score += 5; // User messages are slightly more important
      reasons.push('user message');
    }

    // Normalize score to 0-100 range
    score = Math.max(0, Math.min(100, score));

    // Determine priority level
    let level: MessagePriority['level'];
    if (score >= 80) level = 'critical';
    else if (score >= 65) level = 'high';
    else if (score >= 40) level = 'medium';
    else level = 'low';

    return {
      level,
      score,
      reason: reasons.join(', '),
    };
  }

  /**
   * Create enhanced message with metadata
   */
  static createEnhancedMessage(
    message: Anthropic.MessageParam,
    conversationContext?: {
      isRecent: boolean;
      containsDecision: boolean;
      hasUserPreference: boolean;
      toolCallResult: boolean;
    }
  ): EnhancedMessage {
    const priority = this.analyzePriority(message, conversationContext);
    const tokenCount = TokenCounter.countMessageTokens(message);

    return {
      ...message,
      metadata: {
        timestamp: new Date(),
        priority,
        tokenCount,
        messageType: message.role,
        summary: this.generateSummary(message),
      },
    };
  }

  /**
   * Sort messages by priority (highest first)
   */
  static sortByPriority(messages: EnhancedMessage[]): EnhancedMessage[] {
    return [...messages].sort((a, b) => {
      // First sort by priority level
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const levelDiff = priorityOrder[b.metadata.priority.level] - priorityOrder[a.metadata.priority.level];
      
      if (levelDiff !== 0) return levelDiff;
      
      // Then by score
      const scoreDiff = b.metadata.priority.score - a.metadata.priority.score;
      
      if (scoreDiff !== 0) return scoreDiff;
      
      // Finally by recency (newer first)
      return b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime();
    });
  }

  /**
   * Filter messages by minimum priority level
   */
  static filterByPriority(
    messages: EnhancedMessage[],
    minLevel: MessagePriority['level']
  ): EnhancedMessage[] {
    const levelOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const minLevelValue = levelOrder[minLevel];

    return messages.filter(message => {
      const messageLevelValue = levelOrder[message.metadata.priority.level];
      return messageLevelValue >= minLevelValue;
    });
  }

  private static extractTextContent(message: Anthropic.MessageParam): string {
    if (typeof message.content === 'string') {
      return message.content;
    } else if (Array.isArray(message.content)) {
      return message.content
        .filter(content => content.type === 'text')
        .map(content => (content as any).text)
        .join(' ');
    }
    return '';
  }

  private static containsCriticalPatterns(content: string): boolean {
    const criticalPatterns = [
      /create[\s_-]*(task|project)/i,
      /confirm|confirmation/i,
      /error|failed|problem/i,
      /important|critical|urgent/i,
      /decision|choose|select/i,
      /preference|setting|config/i,
    ];

    return criticalPatterns.some(pattern => pattern.test(content));
  }

  private static analyzeContentQuality(content: string): number {
    let score = 0;

    // Length consideration (not too short, not too long)
    if (content.length >= 20 && content.length <= 500) {
      score += 5;
    }

    // Contains specific details
    if (/\b(specific|detail|exactly|precisely)\b/i.test(content)) {
      score += 5;
    }

    // Contains questions
    if (content.includes('?')) {
      score += 3;
    }

    // Contains structured information
    if (/\b(title|description|type|priority|deadline)\b/i.test(content)) {
      score += 5;
    }

    return score;
  }

  private static generateSummary(message: Anthropic.MessageParam): string {
    const content = this.extractTextContent(message);
    
    if (content.length <= 100) {
      return content;
    }

    // Simple summarization: take first 80 characters + "..."
    return content.substring(0, 80) + '...';
  }
}