import { ClaudeClient } from '../clients/claude';
import { ContextManager } from '../context/context-manager';
import { CollectedInfoManager } from '../conversation/collected-info-manager';
import { DisplayManager } from '../conversation/display-manager';
import { buildSystemPrompt } from '../prompts/system-prompt';
import { EnhancedToolExecutor } from '../tools/enhanced-tool-executor';
import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { ProcessMessageResult } from '../types/conversation-types';
import type { PromptContext } from '../types/prompt-types';
import { isCreateProjectTool, isCreateTaskTool, isUserInputTool } from '../types/toolGuards';
import type { AgentTool } from '../types/tools';

/**
 * Main AI agent for creating tasks and projects through interactive conversation.
 * Implements Factor 3 (context management) and Factor 4 (structured tool outputs).
 * Refactored to use specialized components for different responsibilities.
 */
export class TaskCreatorAgent {
  private claude: ClaudeClient;
  private toolExecutor: EnhancedToolExecutor;
  private contextManager: ContextManager;
  private currentTraceId: string | null = null;
  private questionCount: number = 0;
  private collectedInfoManager: CollectedInfoManager;
  private displayManager: DisplayManager;

  /**
   * Initialize the TaskCreatorAgent with all necessary components
   */
  constructor() {
    this.claude = new ClaudeClient();
    this.toolExecutor = new EnhancedToolExecutor();
    this.collectedInfoManager = new CollectedInfoManager();
    this.displayManager = new DisplayManager();

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
      this.displayManager.logIteration(iterations, MAX_ITERATION);

      const result = await this.processMessage(currentMessage);

      if (!this.shouldContinueConversation(result)) {
        if (
          this.hasCalledTool(result) &&
          (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall))
        ) {
          this.displayManager.displayEnrichedResultSummary(result.toolResult);
        }
        break;
      }

      const nextMessage = this.extractUserResponse(result);
      if (nextMessage) {
        currentMessage = nextMessage;
      }
    }

    this.finalizeConversation(iterations, MAX_ITERATION);
  }

  /**
   * Initialize conversation state and setup
   */
  private initializeConversation(): void {
    this.displayManager.displayInitialization();
    this.clearHistory();
    this.questionCount = 0;
    this.currentTraceId = `conversation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    console.log(`🔍 Starting trace: ${this.currentTraceId}`);
  }

  /**
   * Finalize conversation and display statistics
   */
  private finalizeConversation(iterations: number, maxIterations: number): void {
    this.displayManager.displayConversationCompleted(iterations, maxIterations);
    this.displayManager.displayContextStats(this.contextManager);
    this.displayManager.displayExecutionStats(
      this.toolExecutor,
      this.currentTraceId
    );
  }

  /**
   * Process a single message and generate tool calls or responses
   * @param userMessage the message from the user
   * @returns the result of processing the message
   */
  async processMessage(userMessage: string): Promise<ProcessMessageResult> {
    this.displayManager.displayUserMessage(userMessage);

    try {
      const optimizedHistory = await this.processUserMessageContext(userMessage);
      const promptContext = this.buildPromptContext(userMessage);

      const toolCall = await this.generateToolCall(promptContext, userMessage, optimizedHistory);

      if (!toolCall) {
        return await this.handleNoToolCall(promptContext, userMessage, optimizedHistory);
      }

      return await this.executeToolCall(toolCall);
    } catch (error) {
      return this.handleProcessingError(error);
    }
  }

  /**
   * Process user message context and optimize conversation history
   */
  private async processUserMessageContext(userMessage: string) {
    const userMessageContext = this.createUserMessageContext(userMessage);

    const userOptimizationResult = this.contextManager.addMessage(
      { role: 'user', content: userMessage },
      userMessageContext
    );

    const optimizedHistory = this.contextManager.getOptimizedMessages();

    if (userOptimizationResult.tokensSaved > 0) {
      this.displayManager.displayContextOptimization(
        userOptimizationResult.tokensSaved,
        userOptimizationResult.savingsPercentage
      );
    }

    return optimizedHistory;
  }

  /**
   * Create user message context for optimization
   */
  private createUserMessageContext(userMessage: string) {
    return {
      isRecent: true,
      containsDecision: /decide|choose|select|yes|no|confirm/i.test(userMessage),
      hasUserPreference: /prefer|like|want|need/i.test(userMessage),
      toolCallResult: false,
    };
  }

  /**
   * Build prompt context from current conversation state
   */
  private buildPromptContext(userMessage: string): PromptContext {
    return {
      userMessage,
      collectedInfo: this.collectedInfoManager.getCollectedInfo(),
      questionCount: this.questionCount,
    };
  }

  /**
   * Generate tool call using Claude API
   */
  private async generateToolCall(
    promptContext: PromptContext,
    userMessage: string,
    optimizedHistory: any[]
  ) {
    const systemPrompt = buildSystemPrompt(promptContext);

    return await this.claude.generateToolCall(systemPrompt, userMessage, optimizedHistory);
  }

  /**
   * Handle case when no tool call is generated (direct response)
   */
  private async handleNoToolCall(
    promptContext: PromptContext,
    userMessage: string,
    optimizedHistory: any[]
  ): Promise<ProcessMessageResult> {
    const systemPrompt = buildSystemPrompt(promptContext);

    const response = await this.claude.generateResponse(
      systemPrompt,
      userMessage,
      optimizedHistory
    );

    this.displayManager.displayAgentResponse(response);

    this.contextManager.addMessage(
      { role: 'assistant', content: response },
      { isRecent: true, containsDecision: false, hasUserPreference: false, toolCallResult: false }
    );

    return { response };
  }

  /**
   * Execute tool call and handle results
   */
  private async executeToolCall(toolCall: any): Promise<ProcessMessageResult> {
    this.displayToolCallInfo(toolCall);

    const enrichedResult = await this.executeToolWithContext(toolCall);

    this.handleQuestionToolResult(toolCall, enrichedResult);

    this.addToolResultToContext(toolCall);

    return { toolCall, toolResult: enrichedResult };
  }

  /**
   * Display tool call information
   */
  private displayToolCallInfo(toolCall: any): void {
    this.displayManager.displayToolCall(toolCall.function.name);

    if (toolCall.function.name === 'ask_question') {
      this.displayManager.displayQuestionTimeout();
    }
  }

  /**
   * Execute tool with enhanced context
   */
  private async executeToolWithContext(toolCall: any) {
    return await this.toolExecutor.executeWithContext(toolCall, {
      traceId: this.currentTraceId || undefined,
      enableDebugMode: false,
      validateInput: true,
      validateOutput: true,
      maxRetries: 2,
    });
  }

  /**
   * Handle question tool specific result processing
   */
  private handleQuestionToolResult(toolCall: any, enrichedResult: any): void {
    if (
      isUserInputTool(toolCall) &&
      this.isResultSuccessful({ toolCall, toolResult: enrichedResult })
    ) {
      const answer = enrichedResult.data?.user_response;
      if (answer && typeof answer === 'string') {
        this.collectedInfoManager.updateCollectedInfo(toolCall, answer);
        this.collectedInfoManager.displayCollectedInfo();
        this.displayManager.displayQuestionProcessingInfo({ toolCall, toolResult: enrichedResult });
      } else {
        this.displayManager.displayQuestionErrorInfo({ toolCall, toolResult: enrichedResult });
      }
    }
  }

  /**
   * Add tool result to conversation context
   */
  private addToolResultToContext(toolCall: any): void {
    this.contextManager.addMessage(
      { role: 'assistant', content: `Used tool: ${toolCall.function.name}` },
      { isRecent: true, containsDecision: false, hasUserPreference: false, toolCallResult: true }
    );
  }

  /**
   * Handle processing errors
   */
  private handleProcessingError(error: unknown): ProcessMessageResult {
    console.error('❌ Agent processing failed:', error);
    return {
      response: `申し訳ございません。処理中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  /**
   * Determine whether the conversation should continue
   */
  private shouldContinueConversation(result: ProcessMessageResult): boolean {
    if (!this.hasCalledTool(result)) {
      console.log('💬 Agent provided a response without tools.');
      return false;
    }

    if (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall)) {
      console.log('✅ Task/Project created successfully!');
      return false;
    }

    return true;
  }

  /**
   * Extract user response from user_input tool result
   */
  private extractUserResponse(result: ProcessMessageResult): string | null {
    if (!this.hasCalledTool(result) || !isUserInputTool(result.toolCall)) {
      return null;
    }

    this.questionCount++;

    if (this.isResultSuccessful(result) && this.getResultData(result)?.user_response) {
      const answer = this.getResultData(result).user_response;
      console.log('📝 User provided input, continuing conversation...');
      return answer;
    } else {
      console.log('❌ Failed to get user input, ending conversation.');
      return null;
    }
  }


  /**
   * Reset conversation state
   */
  private clearState(): void {
    this.questionCount = 0;
    this.currentTraceId = null;
  }


  /**
   * Clear conversation history and reset agent state
   */
  private clearHistory(): void {
    this.collectedInfoManager.clearCollectedInfo();
    this.clearState();

    this.contextManager = new ContextManager({
      enableSummarization: true,
      summaryThreshold: 8,
      priorityThreshold: 'medium',
      maxHistoryMessages: 15,
      tokenBudgetRatio: 0.7,
    });

    this.displayManager.displayHistoryCleared();
  }

  /**
   * Check if the result was successful
   */
  private isResultSuccessful(result: ProcessMessageResult): boolean {
    if (!this.hasCalledTool(result)) return false;
    return result.toolResult.success;
  }

  /**
   * Get result data safely
   */
  private getResultData(result: ProcessMessageResult): any {
    if (!this.hasCalledTool(result)) return null;
    return result.toolResult.data;
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
