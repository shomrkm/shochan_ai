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
import type Anthropic from '@anthropic-ai/sdk';
import { InputHelper } from '../utils/input-helper';

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
        if (this.hasCalledTool(result)) {
          this.displayManager.displayEnrichedResultSummary(result.toolResult);
        }
        break;
      }

      const nextMessage = this.extractUserResponse(result);
      if (nextMessage) {
        currentMessage = nextMessage;
      } else if (this.hasCalledTool(result) && (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall))) {
        // Task/Project created successfully, ask for next input
        const newMessage = await this.promptForNextAction();
        if (newMessage) {
          currentMessage = newMessage;
        } else {
          // User chose to exit (Ctrl+C)
          break;
        }
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

      // Step 1: Determine next step using LLM
      const nextStep = await this.determineNextStep(promptContext, userMessage, optimizedHistory);

      if (!nextStep) {
        return await this.handleNoToolCall(promptContext, userMessage, optimizedHistory);
      }

      // Step 2: Execute the determined tool
      return await this.executeTool(nextStep);
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
    };
  }

  /**
   * Determine next step using LLM - converts natural language to structured tool call
   */
  private async determineNextStep(
    promptContext: PromptContext,
    userMessage: string,
    optimizedHistory: Anthropic.MessageParam[]
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
    optimizedHistory: Anthropic.MessageParam[]
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
   * Execute the determined tool - routing logic for tool execution
   */
  private async executeTool(toolCall: AgentTool): Promise<ProcessMessageResult> {
    this.displayToolCallInfo(toolCall);

    // Routing logic for different tool types
    if (isCreateTaskTool(toolCall)) {
      const result = await this.executeCreateTask(toolCall);
      return { toolCall, toolResult: result };
    } else if (isCreateProjectTool(toolCall)) {
      const result = await this.executeCreateProject(toolCall);
      return { toolCall, toolResult: result };
    } else if (isUserInputTool(toolCall)) {
      const result = await this.executeUserInput(toolCall);
      return { toolCall, toolResult: result };
    } else {
      // Handle unrecognized function calls
      throw new Error(`Unknown tool function: ${(toolCall as AgentTool).function.name}`);
    }
  }

  /**
   * Execute create_task tool
   */
  private async executeCreateTask(toolCall: AgentTool) {
    const enrichedResult = await this.executeToolWithContext(toolCall);
    this.addToolResultToContext(toolCall);
    return enrichedResult;
  }

  /**
   * Execute create_project tool
   */
  private async executeCreateProject(toolCall: AgentTool) {
    const enrichedResult = await this.executeToolWithContext(toolCall);
    this.addToolResultToContext(toolCall);
    return enrichedResult;
  }

  /**
   * Execute user_input tool
   */
  private async executeUserInput(toolCall: AgentTool) {
    const enrichedResult = await this.executeToolWithContext(toolCall);
    this.handleUserInputResult(toolCall, enrichedResult);
    this.addToolResultToContext(toolCall);
    return enrichedResult;
  }

  /**
   * Display tool call information
   */
  private displayToolCallInfo(toolCall: AgentTool): void {
    this.displayManager.displayToolCall(toolCall.function.name);

    if (toolCall.function.name === 'user_input') {
      this.displayManager.displayQuestionTimeout();
    }
  }

  /**
   * Execute tool with enhanced context
   */
  private async executeToolWithContext(toolCall: AgentTool) {
    return await this.toolExecutor.executeWithContext(toolCall, {
      traceId: this.currentTraceId || undefined,
      enableDebugMode: false,
      validateInput: true,
      validateOutput: true,
      maxRetries: 2,
    });
  }

  /**
   * Handle user input tool result processing
   */
  private handleUserInputResult(toolCall: AgentTool, enrichedResult: EnrichedToolResult): void {
    if (this.isResultSuccessful({ toolCall, toolResult: enrichedResult })) {
      const data = enrichedResult.data;
      const answer = data && typeof data === 'object' && 'user_response' in data 
        ? (data as { user_response: unknown }).user_response 
        : null;
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
  private addToolResultToContext(toolCall: AgentTool): void {
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
      console.log('💬 You can continue to create more tasks/projects or press Ctrl+C to exit.');
      return true; // Continue conversation instead of ending
    }

    return true;
  }

  /**
   * Prompt user for next action after task/project creation
   */
  private async promptForNextAction(): Promise<string | null> {
    const inputHelper = InputHelper.getInstance();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 What would you like to do next?');
    console.log('='.repeat(60));
    console.log('💡 You can:');
    console.log('  - Create another task or project');
    console.log('  - Ask me anything about task management');
    console.log('  - Press Ctrl+C to exit');
    console.log('='.repeat(60));
    
    return await inputHelper.getUserInput('\n💬 Your request: ');
  }

  /**
   * Extract user response from user_input tool result
   */
  private extractUserResponse(result: ProcessMessageResult): string | null {
    if (!this.hasCalledTool(result) || !isUserInputTool(result.toolCall)) {
      return null;
    }


    const resultData = this.getResultData(result);
    if (this.isResultSuccessful(result) && resultData && typeof resultData === 'object' && 'user_response' in resultData) {
      const answer = (resultData as { user_response: string }).user_response;
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
  private getResultData(result: ProcessMessageResult): unknown {
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
