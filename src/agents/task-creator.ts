import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from '../clients/claude';
import { ContextManager } from '../context/context-manager';
import { PromptManager } from '../prompts/prompt-manager';
import { EnhancedToolExecutor } from '../tools/enhanced-tool-executor';
import type { PromptContext } from '../types/prompt-types';
import {
  isAskQuestionTool,
  isCreateProjectTool,
  isCreateTaskTool,
  isEnrichedQuestionToolResult,
} from '../types/toolGuards';
import { type AgentTool } from '../types/tools';
import type { EnrichedToolResult } from '../tools/tool-execution-context';

type ProcessMessageResult =
  | {
      toolCall: AgentTool;
      toolResult: EnrichedToolResult;
    }
  | {
      response: string;
    };

/**
 * Main AI agent for creating tasks and projects through interactive conversation.
 * Implements Factor 3 (context management) and Factor 4 (structured tool outputs).
 */
export class TaskCreatorAgent {
  private claude: ClaudeClient;
  private toolExecutor: EnhancedToolExecutor;
  private promptManager: PromptManager;
  private contextManager: ContextManager;
  private collectedInfo: Record<string, string> = {};
  private questionCount: number = 0;
  private conversationStage: PromptContext['conversationStage'] = 'initial';
  private currentTraceId: string | null = null;

  /**
   * Initialize the TaskCreatorAgent with all necessary components
   */
  constructor() {
    this.claude = new ClaudeClient();
    this.toolExecutor = new EnhancedToolExecutor();
    this.promptManager = new PromptManager();
    
    this.contextManager = new ContextManager({
      enableSummarization: true,
      summaryThreshold: 8,
      priorityThreshold: 'medium',
      maxHistoryMessages: 15,
      tokenBudgetRatio: 0.7,
    });
  }

  /**
   * Start an interactive conversation to create tasks or projects
   * @param userMessage the initial message from the user
   */
  async startConversation(userMessage: string): Promise<void> {
    this.initializeConversation();
    
    let currentMessage = userMessage;
    const MAX_ITERATION = 8;
    let iterations = 0;

    while (iterations < MAX_ITERATION) {
      iterations++;
      this.logIteration(iterations, MAX_ITERATION);

      const result = await this.processMessage(currentMessage);
      
      const shouldContinue = this.handleConversationResult(result);
      if (!shouldContinue.continue) {
        break;
      }
      
      if (shouldContinue.nextMessage) {
        currentMessage = shouldContinue.nextMessage;
      }
    }

    this.finalizeConversation(iterations, MAX_ITERATION);
  }

  /**
   * Initialize conversation state and setup
   */
  private initializeConversation(): void {
    console.log('🎯 Starting interactive conversation...\n');
    this.clearHistory();
    
    this.currentTraceId = `conversation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    console.log(`🔍 Starting trace: ${this.currentTraceId}`);
  }

  /**
   * Log current iteration progress
   */
  private logIteration(current: number, max: number): void {
    console.log(`\n🔄 Conversation iteration ${current}/${max}`);
  }

  /**
   * Handle the result of processing a message and determine next action
   */
  private handleConversationResult(result: ProcessMessageResult): { continue: boolean; nextMessage?: string } {
    if (!this.hasCalledTool(result)) {
      console.log('💬 Agent provided a response without tools.');
      return { continue: false };
    }

    if (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall)) {
      console.log('✅ Task/Project created successfully!');
      this.displayEnrichedResultSummary(result.toolResult);
      return { continue: false };
    }

    if (isAskQuestionTool(result.toolCall)) {
      return this.handleQuestionResult(result);
    }

    return { continue: true };
  }

  /**
   * Handle question tool result and update conversation state
   */
  private handleQuestionResult(result: ProcessMessageResult): { continue: boolean; nextMessage?: string } {
    if (!this.hasCalledTool(result)) {
      return { continue: false };
    }

    this.questionCount++;
    this.conversationStage = this.determineNextStage();

    if (this.isResultSuccessful(result) && this.getResultData(result)?.answer) {
      const answer = this.getResultData(result).answer;
      
      this.updateCollectedInfo(result.toolCall, answer);
      this.displayCollectedInfo();
      this.displayQuestionProcessingInfo(result);
      
      return { continue: true, nextMessage: answer };
    } else {
      console.log('❌ Failed to get user answer, ending conversation.');
      this.displayQuestionErrorInfo(result);
      return { continue: false };
    }
  }

  /**
   * Display currently collected information
   */
  private displayCollectedInfo(): void {
    console.log('\n📝 Collected information so far:');
    console.log(JSON.stringify(this.collectedInfo, null, 2));
    console.log('\n');
  }

  /**
   * Finalize conversation and display statistics
   */
  private finalizeConversation(iterations: number, maxIterations: number): void {
    if (iterations >= maxIterations) {
      console.log('⚠️  Maximum iterations reached. Conversation ended.');
    }

    console.log('🏁 Conversation completed!\n');
    
    this.displayContextStats();
    this.displayExecutionStats();
  }

  /**
   * Display context manager statistics
   */
  private displayContextStats(): void {
    const stats = this.contextManager.getContextStats();
    console.log('\n📊 Context Window Statistics:');
    console.log(`📏 Tokens: ${stats.currentTokens}/${stats.maxTokens} (${stats.utilizationPercentage.toFixed(1)}% utilized)`);
    console.log(`💬 Messages: ${stats.messageCount}`);
    console.log(`🔄 Has Summary: ${stats.hasSummary ? 'Yes' : 'No'}`);
    console.log(`⚡ Available: ${stats.availableTokens} tokens`);
    console.log('');
  }

  /**
   * Process a single message and generate tool calls or responses
   * @param userMessage the message from the user
   * @returns the result of processing the message
   */
  async processMessage(userMessage: string): Promise<ProcessMessageResult> {
    console.log(`\n👤 User: ${userMessage}`);

    try {
      const userMessageContext = {
        isRecent: true,
        containsDecision: /decide|choose|select|yes|no|confirm/i.test(userMessage),
        hasUserPreference: /prefer|like|want|need/i.test(userMessage),
        toolCallResult: false,
      };
      
      const userOptimizationResult = this.contextManager.addMessage(
        { role: 'user', content: userMessage },
        userMessageContext
      );

      const optimizedHistory = this.contextManager.getOptimizedMessages();
      
      if (userOptimizationResult.tokensSaved > 0) {
        console.log(`🔧 Context optimized: saved ${userOptimizationResult.tokensSaved} tokens (${userOptimizationResult.savingsPercentage.toFixed(1)}%)`);
      }

      const promptContext: PromptContext = {
        userMessage,
        conversationStage: this.conversationStage,
        collectedInfo: this.collectedInfo,
        questionCount: this.questionCount,
      };

      const systemPrompt = this.promptManager.buildSystemPrompt(promptContext);

      const toolCall = await this.claude.generateToolCall(
        systemPrompt,
        userMessage,
        optimizedHistory
      );

      if (!toolCall) {
        const response = await this.claude.generateResponse(
          systemPrompt,
          userMessage,
          optimizedHistory
        );

        console.log(`🤖 Claude: ${response}`);

        this.contextManager.addMessage(
          { role: 'assistant', content: response },
          { isRecent: true, containsDecision: false, hasUserPreference: false, toolCallResult: false }
        );

        return { response };
      }

      console.log(`🤖 Claude generated tool call: ${toolCall.function.name}`);
      console.log(`📋 Using prompt stage: ${this.conversationStage}`);

      const enrichedResult = await this.toolExecutor.executeWithContext(toolCall, {
        traceId: this.currentTraceId || undefined,
        enableDebugMode: false,
        validateInput: true,
        validateOutput: true,
        timeout: 30000,
        maxRetries: 2,
      });

      this.contextManager.addMessage(
        { role: 'assistant', content: `Used tool: ${toolCall.function.name}` },
        { isRecent: true, containsDecision: false, hasUserPreference: false, toolCallResult: true }
      );

      return { toolCall, toolResult: enrichedResult };
    } catch (error) {
      console.error('❌ Agent processing failed:', error);
      return {
        response: `申し訳ございません。処理中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Update collected information based on user's answer to questions
   * @param toolCall the tool call that asked the question
   * @param answer the answer from the user
   */
  private updateCollectedInfo(toolCall: AgentTool, answer: string): void {
    if (!isAskQuestionTool(toolCall)) {
      throw new Error('Invalid tool type for askQuestion');
    }

    const question = toolCall.function.parameters.question;

    const q = question.toLowerCase();
    if (q.includes('feature') || q.includes('functionality') || q.includes('what')) {
      this.collectedInfo.feature = answer;
    } else if (q.includes('technology') || q.includes('tech stack') || q.includes('how')) {
      this.collectedInfo.techStack = answer;
    } else if (q.includes('deadline') || q.includes('when') || q.includes('timeline')) {
      this.collectedInfo.deadline = answer;
    } else if (q.includes('priority') || q.includes('importance') || q.includes('urgent')) {
      this.collectedInfo.priority = answer;
    } else if (q.includes('name') || q.includes('title') || q.includes('call')) {
      this.collectedInfo.title = answer;
    } else if (q.includes('description') || q.includes('detail') || q.includes('about')) {
      this.collectedInfo.description = answer;
    } else if (q.includes('confirm') || q.includes('proceed') || q.includes('correct')) {
      this.collectedInfo.confirmation = answer;
    } else {
      const key = `question_${Object.keys(this.collectedInfo).length + 1}`;
      this.collectedInfo[key] = answer;
    }
  }

  /**
   * Determine the next stage of the conversation based on collected information
   * @returns the next stage of the conversation
   */
  private determineNextStage(): PromptContext['conversationStage'] {
    const hasBasicInfo = this.collectedInfo.feature || this.collectedInfo.title;
    const hasDetails = this.collectedInfo.description || this.collectedInfo.feature;

    if (hasBasicInfo && hasDetails && this.questionCount >= 2) {
      return 'confirming';
    } else if (this.questionCount >= 1) {
      return 'gathering_info';
    } else {
      return 'initial';
    }
  }

  /**
   * Check if the result contains a tool call
   */
  private hasCalledTool(
    result: ProcessMessageResult
  ): result is { toolCall: AgentTool; toolResult: EnrichedToolResult } {
    return 'toolCall' in result && 'toolResult' in result;
  }

  /**
   * Clear conversation history and reset agent state
   */
  private clearHistory(): void {
    this.collectedInfo = {};
    this.questionCount = 0;
    this.conversationStage = 'initial';
    this.currentTraceId = null;
    
    this.contextManager = new ContextManager({
      enableSummarization: true,
      summaryThreshold: 8,
      priorityThreshold: 'medium',
      maxHistoryMessages: 15,
      tokenBudgetRatio: 0.7,
    });
    
    console.log('🧹 Conversation history and collected info cleared');
  }

  /**
   * Display summary of enriched tool execution result
   */
  private displayEnrichedResultSummary(enrichedResult: EnrichedToolResult): void {
    console.log('\n🔍 Tool Execution Summary:');
    console.log(`⚡ Execution Time: ${enrichedResult.executionTimeMs}ms`);
    console.log(`🔄 Retry Count: ${enrichedResult.metadata.retryCount}`);
    console.log(`📊 Status: ${enrichedResult.status}`);
    
    if (enrichedResult.inputValidation) {
      console.log(`✅ Input Validation: ${enrichedResult.inputValidation.isValid ? 'Passed' : 'Failed'}`);
    }
    
    if (enrichedResult.outputValidation) {
      console.log(`✅ Output Validation: ${enrichedResult.outputValidation.isValid ? 'Passed' : 'Failed'}`);
    }
    
    if (enrichedResult.error) {
      console.log(`❌ Error: ${enrichedResult.error.code} - ${enrichedResult.error.message}`);
      if (enrichedResult.error.suggestedAction) {
        console.log(`💡 Suggestion: ${enrichedResult.error.suggestedAction}`);
      }
    }
    
    console.log('');
  }

  /**
   * Display tool execution statistics
   */
  private displayExecutionStats(): void {
    const stats = this.toolExecutor.getExecutionStats();
    
    console.log('\n📊 Tool Execution Statistics:');
    console.log(`🎯 Active Contexts: ${stats.activeContexts}`);
    console.log(`📈 Total Executions: ${stats.totalExecutions}`);
    console.log(`🔄 Average Retry Rate: ${stats.averageRetryRate.toFixed(2)}`);
    
    if (stats.topExecutedTools.length > 0) {
      console.log('🏆 Top Executed Tools:');
      stats.topExecutedTools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.toolName}: ${tool.count} times`);
      });
    }
    
    if (this.currentTraceId) {
      const traceContexts = this.toolExecutor.getContextsByTrace(this.currentTraceId);
      console.log(`🔍 Trace "${this.currentTraceId}": ${traceContexts.length} executions`);
    }
    
    console.log('');
  }

  /**
   * Safely access result data from ProcessMessageResult
   */
  private getResultData(result: ProcessMessageResult): any {
    if (!this.hasCalledTool(result)) return null;
    
    return result.toolResult.data;
  }

  /**
   * Check if the result was successful
   */
  private isResultSuccessful(result: ProcessMessageResult): boolean {
    if (!this.hasCalledTool(result)) return false;
    
    return result.toolResult.success;
  }

  /**
   * Display enhanced information about question processing
   */
  private displayQuestionProcessingInfo(result: ProcessMessageResult): void {
    if (!this.hasCalledTool(result)) return;
    
    if (isEnrichedQuestionToolResult(result.toolResult)) {
      console.log(`⚡ Question processing took ${result.toolResult.executionTimeMs}ms`);
      
      if (result.toolResult.inputValidation?.warnings.length) {
        console.log(`⚠️ Input warnings: ${result.toolResult.inputValidation.warnings.join(', ')}`);
      }
      
      if (result.toolResult.outputValidation?.warnings.length) {
        console.log(`⚠️ Output warnings: ${result.toolResult.outputValidation.warnings.join(', ')}`);
      }
      
      if (result.toolResult.metadata.retryCount && result.toolResult.metadata.retryCount > 0) {
        console.log(`🔄 Required ${result.toolResult.metadata.retryCount} retries`);
      }
    }
  }

  /**
   * Display enhanced error information for question processing
   */
  private displayQuestionErrorInfo(result: ProcessMessageResult): void {
    if (!this.hasCalledTool(result)) return;
    
    if (result.toolResult.error) {
      console.log(`🔍 Error details: ${result.toolResult.error.code} - ${result.toolResult.error.message}`);
      if (result.toolResult.error.suggestedAction) {
        console.log(`💡 Suggestion: ${result.toolResult.error.suggestedAction}`);
      }
    } else {
      console.log(`🔍 Basic error: ${result.toolResult.message}`);
    }
  }

  /**
   * Test connections to external services
   */
  async testConnections(): Promise<boolean> {
    console.log('🔍 Testing connections...');

    try {
      const connected = await this.toolExecutor.testConnection();
      
      if (!connected) {
        console.log('❌ Connection test failed');
        return false;
      }

      console.log('✅ Tool executor connection successful');
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }
}
