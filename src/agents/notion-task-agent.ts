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
  isDoneTool,
  isGetTasksTool,
  isTaskQueryResultData,
  isUserInputResultData,
  isUserInputTool,
} from '../types/toolGuards';
import type { AgentTool } from '../types/tools';

/**
 * Main AI agent for managing Notion tasks through interactive conversation.
 * Handles task creation, task queries, project management, and more.
 * Implements Factor 3 (context management) and Factor 4 (structured tool outputs).
 * Refactored to use specialized components for different responsibilities.
 */
export class NotionTaskAgent {
  private claude: ClaudeClient;
  private toolExecutor: EnhancedToolExecutor;
  private contextManager: ContextManager;
  private currentTraceId: string | null = null;
  private displayManager: DisplayManager;
  private debugMode: boolean;

  /**
   * Initialize the NotionTaskAgent with all necessary components
   */
  constructor(debugMode: boolean = false) {
    this.claude = new ClaudeClient();
    this.toolExecutor = new EnhancedToolExecutor(debugMode);
    this.contextManager = new ContextManager();
    this.displayManager = new DisplayManager();
    this.debugMode = debugMode;
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
      
      // If nextMessage is null, conversation should end
      if (nextMessage === null) {
        break;
      }
      
      currentMessage = nextMessage;
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
   * Execute the determined tool - unified routing logic for all tools
   */
  private async executeTool(toolCall: AgentTool): Promise<ProcessMessageResult> {
    this.displayToolCallInfo(toolCall);

    const result = await this.executeToolWithContext(toolCall);
    
    // Handle tool result with unified processing
    this.handleToolResult(toolCall, result);

    return { toolCall, toolResult: result };
  }

  /**
   * Display tool call information
   */
  private displayToolCallInfo(toolCall: AgentTool): void {
    // ToolExecutor側でデバッグログを出力するので、ここでは重複させない
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
   * Handle tool result with unified processing for all tool types
   */
  private handleToolResult(toolCall: AgentTool, enrichedResult: EnrichedToolResult): void {
    if (isUserInputTool(toolCall)) {
      this.handleUserInputResult(toolCall, enrichedResult);
    } else if (isDoneTool(toolCall)) {
      this.handleDoneResult(toolCall, enrichedResult);
    }
    // Other tool results (create_task, create_project, get_tasks) are displayed via display_result tool
    // following 12-factor agents Factor 7: Contact humans with tool calls
  }

  /**
   * Handle done tool result processing
   */
  private handleDoneResult(toolCall: AgentTool, enrichedResult: EnrichedToolResult): void {
    if (this.isResultSuccessful({ toolCall, toolResult: enrichedResult }) && enrichedResult.data) {
      const finalAnswer = (enrichedResult.data as any).final_answer;
      if (finalAnswer && typeof finalAnswer === 'string') {
        this.displayManager.displayAgentResponse(finalAnswer);
      }
    }
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
    // Check if conversation completed with done tool
    if (this.hasCalledTool(result) && isDoneTool(result.toolCall)) {
      console.log('✅ Conversation completed with done intent');
      return null; // End conversation
    }

    // For non-user_input tools (create_task, create_project, get_tasks, display_result),
    // continue conversation to let LLM process results and generate display_result
    if (!this.hasCalledTool(result) || !isUserInputTool(result.toolCall)) {
      return 'Please process the result and provide appropriate feedback to the user.';
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
   * Clear conversation history and reset agent state
   */
  private clearHistory(): void {
    this.currentTraceId = null;
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
   * Record tool execution event to the thread context for LLM XML context
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
    } else if (isGetTasksTool(toolCall)) {
      this.contextManager.addEvent('get_tasks', {
        task_type: toolCall.function.parameters.task_type,
        project_id: toolCall.function.parameters.project_id,
        limit: toolCall.function.parameters.limit,
        include_completed: toolCall.function.parameters.include_completed,
        sort_by: toolCall.function.parameters.sort_by,
        sort_order: toolCall.function.parameters.sort_order,
      });
    } else if (isDoneTool(toolCall)) {
      this.contextManager.addEvent('done', {
        final_answer: toolCall.function.parameters.final_answer,
      });
    }
  }

  /**
   * Record tool result event to the thread context for LLM XML context
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
    } else if (isGetTasksTool(toolCall)) {
      this.contextManager.addEvent('get_tasks_result', {
        success: result.success,
        query_parameters: toolCall.function.parameters,
        tasks: isTaskQueryResultData(result.data) ? result.data.tasks?.map(task => ({
          task_id: task.task_id,
          title: task.title,
          description: task.description,
          task_type: task.task_type,
          scheduled_date: task.scheduled_date,
          project_id: task.project_id,
          project_name: task.project_name,
          created_at: task.created_at instanceof Date ? task.created_at.toISOString() : task.created_at,
          updated_at: task.updated_at instanceof Date ? task.updated_at.toISOString() : task.updated_at,
          notion_url: task.notion_url,
          status: task.status,
        })) : [],
        total_count: isTaskQueryResultData(result.data) ? result.data.total_count : 0,
        has_more: isTaskQueryResultData(result.data) ? result.data.has_more : false,
        error: result.success ? undefined : result.error?.message,
        execution_time: result.executionTimeMs || 0,
      });
    } else if (isDoneTool(toolCall)) {
      this.contextManager.addEvent('done_result', {
        final_answer: result.data && typeof result.data === 'object' && 'final_answer' in result.data 
          ? result.data.final_answer as string 
          : '',
        conversation_complete: result.data && typeof result.data === 'object' && 'conversation_complete' in result.data 
          ? result.data.conversation_complete as boolean 
          : false,
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
