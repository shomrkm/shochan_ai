import { ClaudeClient } from '../clients/claude';
import { ContextManager } from '../conversation/context-manager';
import { DisplayManager } from '../conversation/display-manager';
import { buildSystemPrompt } from '../prompts/system-prompt';
import { EnhancedToolExecutor } from '../tools/enhanced-tool-executor';
import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { ProcessMessageResult } from '../types/conversation-types';
import type { PromptContext } from '../types/prompt-types';
import {
  isCreateProjectTool,
  isCreateTaskTool,
  isUserInputResultData,
  isUserInputTool,
} from '../types/toolGuards';
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
  private displayManager: DisplayManager;

  /**
   * Initialize the TaskCreatorAgent with all necessary components
   */
  constructor() {
    this.claude = new ClaudeClient();
    this.toolExecutor = new EnhancedToolExecutor();
    this.contextManager = new ContextManager();
    this.displayManager = new DisplayManager();
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

      const nextMessage = this.extractUserResponse(result);
      currentMessage = nextMessage ?? ''
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
    const eventCount = this.contextManager.getThread().getEventCount();
    console.log(`💬 Conversation: ${eventCount} events`);
    this.displayManager.displayExecutionStats(this.toolExecutor, this.currentTraceId);
  }

  /**
   * Process a single message and generate tool calls or responses
   * @param userMessage the message from the user
   * @returns the result of processing the message
   */
  async processMessage(userMessage: string): Promise<ProcessMessageResult> {
    this.displayManager.displayUserMessage(userMessage);

    try {
      this.contextManager.addUserMessage(userMessage);
      const promptContext = this.contextManager.buildPromptContext(userMessage);

      // Step 1: Determine next step using LLM
      const nextStep = await this.determineNextStep(promptContext, userMessage);

      if (!nextStep) {
        return await this.handleNoToolCall(promptContext, userMessage);
      }

      // Step 2: Execute the determined tool
      return await this.executeTool(nextStep);
    } catch (error) {
      return this.handleProcessingError(error);
    }
  }

  /**
   * Determine next step using LLM - converts natural language to structured tool call
   * Uses XML context in system prompt, no conversation history needed
   */
  private async determineNextStep(promptContext: PromptContext, userMessage: string) {
    const systemPrompt = buildSystemPrompt(promptContext);

    return await this.claude.generateToolCall(
      systemPrompt,
      userMessage,
      [] // Empty history - context is in system prompt via XML
    );
  }

  /**
   * Handle case when no tool call is generated (direct response)
   * Uses XML context in system prompt, no conversation history needed
   */
  private async handleNoToolCall(
    promptContext: PromptContext,
    userMessage: string
  ): Promise<ProcessMessageResult> {
    const systemPrompt = buildSystemPrompt(promptContext);

    const response = await this.claude.generateResponse(
      systemPrompt,
      userMessage,
      [] // Empty history - context is in system prompt via XML
    );

    this.displayManager.displayAgentResponse(response);

    this.contextManager.addAssistantResponse(response);

    return { response };
  }

  /**
   * Execute the determined tool - routing logic for tool execution
   */
  private async executeTool(toolCall: AgentTool): Promise<ProcessMessageResult> {
    this.displayToolCallInfo(toolCall);

    const result = await this.executeToolWithContext(toolCall);
    if (isUserInputTool(toolCall)) {
      this.handleUserInputResult(toolCall, result);
    }

    return { toolCall, toolResult: result };
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
   * Execute tool with enhanced context and event recording
   */
  private async executeToolWithContext(toolCall: AgentTool) {
    // Record the tool execution event before execution
    this.recordToolExecutionEvent(toolCall);

    const result = await this.toolExecutor.executeWithContext(toolCall, {
      traceId: this.currentTraceId || undefined,
      enableDebugMode: false,
      validateInput: true,
      validateOutput: true,
      maxRetries: 2,
    });

    // Record the tool result event after execution
    this.recordToolResultEvent(toolCall, result);

    return result;
  }

  /**
   * Handle user input tool result processing
   */
  private handleUserInputResult(toolCall: AgentTool, enrichedResult: EnrichedToolResult): void {
    if (this.isResultSuccessful({ toolCall, toolResult: enrichedResult })) {
      const data = enrichedResult.data;
      if (isUserInputResultData(data)) {
        console.log(`📝 User provided: ${data.user_response}`);
        this.displayManager.displayQuestionProcessingInfo({ toolCall, toolResult: enrichedResult });
      } else {
        this.displayManager.displayQuestionErrorInfo({ toolCall, toolResult: enrichedResult });
      }
    }
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
   * Extract user response from user_input tool result
   */
  private extractUserResponse(result: ProcessMessageResult): string | null {
    if (!this.hasCalledTool(result) || !isUserInputTool(result.toolCall)) {
      return 'What should I do next?'
    }

    const resultData = this.getResultData(result);
    if (this.isResultSuccessful(result) && isUserInputResultData(resultData)) {
      const answer = resultData.user_response;
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
    this.clearState();
    this.contextManager.clear();
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
   * Record tool execution event to the thread context
   */
  private recordToolExecutionEvent(toolCall: AgentTool): void {
    if (isCreateTaskTool(toolCall)) {
      this.contextManager.addEvent('create_task', {
        title: toolCall.function.parameters.title,
        description: toolCall.function.parameters.description,
        task_type: toolCall.function.parameters.task_type,
        scheduled_date: toolCall.function.parameters.scheduled_date,
        project_id: toolCall.function.parameters.project_id,
      });
    } else if (isCreateProjectTool(toolCall)) {
      this.contextManager.addEvent('create_project', {
        name: toolCall.function.parameters.name,
        description: toolCall.function.parameters.description,
        importance: toolCall.function.parameters.importance,
        action_plan: toolCall.function.parameters.action_plan,
      });
    } else if (isUserInputTool(toolCall)) {
      this.contextManager.addEvent('user_input', {
        message: toolCall.function.parameters.message,
        context: toolCall.function.parameters.context,
      });
    }
  }

  /**
   * Record tool result event to the thread context
   */
  private recordToolResultEvent(toolCall: AgentTool, result: EnrichedToolResult): void {
    if (isCreateTaskTool(toolCall)) {
      this.contextManager.addEvent('create_task_result', {
        success: result.success,
        task_id: this.extractTaskId(result),
        notion_url: this.extractNotionUrl(result),
        execution_time: result.executionTimeMs || 0,
      });
    } else if (isCreateProjectTool(toolCall)) {
      this.contextManager.addEvent('create_project_result', {
        success: result.success,
        project_id: this.extractProjectId(result),
        notion_url: this.extractNotionUrl(result),
        execution_time: result.executionTimeMs || 0,
      });
    } else if (isUserInputTool(toolCall)) {
      this.contextManager.addEvent('user_input_result', {
        success: result.success,
        user_response: this.extractUserResponseFromResult(result),
        execution_time: result.executionTimeMs || 0,
      });
    }
  }

  /**
   * Extract task ID from create_task result
   */
  private extractTaskId(result: EnrichedToolResult): string | undefined {
    if (result.success && result.data && typeof result.data === 'object' && 'task_id' in result.data) {
      return result.data.task_id as string;
    }
    return undefined;
  }

  /**
   * Extract project ID from create_project result
   */
  private extractProjectId(result: EnrichedToolResult): string | undefined {
    if (result.success && result.data && typeof result.data === 'object' && 'project_id' in result.data) {
      return result.data.project_id as string;
    }
    return undefined;
  }

  /**
   * Extract Notion URL from tool result
   */
  private extractNotionUrl(result: EnrichedToolResult): string | undefined {
    if (result.success && result.data && typeof result.data === 'object' && 'notion_url' in result.data) {
      return result.data.notion_url as string;
    }
    return undefined;
  }

  /**
   * Extract user response from user_input result for event recording
   */
  private extractUserResponseFromResult(result: EnrichedToolResult): string | undefined {
    if (result.success && isUserInputResultData(result.data)) {
      return result.data.user_response;
    }
    return undefined;
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
