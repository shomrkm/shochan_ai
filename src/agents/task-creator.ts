import { ClaudeClient } from '../clients/claude';
import { ContextManager } from '../context/context-manager';
import { ConversationManager } from '../conversation/conversation-manager';
import { CollectedInfoManager } from '../conversation/collected-info-manager';
import { DisplayManager } from '../conversation/display-manager';
import { PromptManager } from '../prompts/prompt-manager';
import { EnhancedToolExecutor } from '../tools/enhanced-tool-executor';
import { AgentThreadManager } from '../state/agent-thread';
import { FileSystemThreadStorage } from '../state/thread-storage';
import { ThreadRecoveryManager } from '../state/thread-recovery';
import type { PromptContext } from '../types/prompt-types';
import type { ProcessMessageResult } from '../types/conversation-types';
import {
  isAskQuestionTool,
  isCreateProjectTool,
  isCreateTaskTool,
} from '../types/tools';
import { type AgentTool } from '../types/tools';
import type { EnrichedToolResult } from '../tools/tool-execution-context';

/**
 * Main AI agent for creating tasks and projects through interactive conversation.
 * Implements Factor 3 (context management), Factor 4 (structured tool outputs),
 * and Factor 5 (unified execution state).
 * Refactored to use specialized components for different responsibilities.
 */
export class TaskCreatorAgent {
  private claude: ClaudeClient;
  private toolExecutor: EnhancedToolExecutor;
  private promptManager: PromptManager;
  private contextManager: ContextManager;
  private conversationManager: ConversationManager;
  private collectedInfoManager: CollectedInfoManager;
  private displayManager: DisplayManager;
  private threadManager: AgentThreadManager;
  private storage: FileSystemThreadStorage;
  private recoveryManager: ThreadRecoveryManager;

  /**
   * Initialize the TaskCreatorAgent with all necessary components
   */
  constructor(threadId?: string) {
    this.claude = new ClaudeClient();
    this.toolExecutor = new EnhancedToolExecutor();
    this.promptManager = new PromptManager();
    this.conversationManager = new ConversationManager();
    this.collectedInfoManager = new CollectedInfoManager();
    this.displayManager = new DisplayManager();
    
    this.contextManager = new ContextManager({
      enableSummarization: true,
      summaryThreshold: 8,
      priorityThreshold: 'medium',
      maxHistoryMessages: 15,
      tokenBudgetRatio: 0.7,
    });

    // Initialize Factor 5: Unified State Management
    this.storage = new FileSystemThreadStorage('./agent-threads');
    this.threadManager = new AgentThreadManager(threadId, this.storage, true);
    this.recoveryManager = new ThreadRecoveryManager(this.storage, 3);
  }

  /**
   * Start an interactive conversation to create tasks or projects
   * @param userMessage the initial message from the user
   */
  async startConversation(userMessage: string): Promise<void> {
    // Factor 5: Record conversation start
    this.threadManager.startConversation();
    
    this.initializeConversation();
    
    // Factor 5: Record initial user message
    this.threadManager.addUserMessage(userMessage, {
      isRecent: true,
      containsDecision: false,
      hasUserPreference: false,
      toolCallResult: false
    });
    
    let currentMessage = userMessage;
    const MAX_ITERATION = 8;
    let iterations = 0;

    while (iterations < MAX_ITERATION) {
      iterations++;
      this.displayManager.logIteration(iterations, MAX_ITERATION);

      const result = await this.processMessage(currentMessage);
      
      const shouldContinue = this.conversationManager.handleConversationResult(
        result,
        this.collectedInfoManager.getCollectedInfo()
      );
      
      // Factor 5: Monitor stage changes
      this.monitorStageChange();
      
      if (!shouldContinue.continue) {
        if (this.hasCalledTool(result) && (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall))) {
          this.displayManager.displayEnrichedResultSummary(result.toolResult);
        }
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
    this.displayManager.displayInitialization();
    this.clearHistory();
    this.conversationManager.initializeConversation();
  }

  /**
   * Finalize conversation and display statistics
   */
  private finalizeConversation(iterations: number, maxIterations: number): void {
    // Factor 5: Record conversation completion
    this.threadManager.complete();
    
    this.displayManager.displayConversationCompleted(iterations, maxIterations);
    this.displayManager.displayContextStats(this.contextManager);
    this.displayManager.displayExecutionStats(this.toolExecutor, this.conversationManager.getCurrentTraceId());
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
      return await this.handleProcessingError(error);
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
      // Factor 5: Record context optimization
      this.threadManager.addContextOptimization(
        userOptimizationResult.tokensSaved,
        userOptimizationResult.savingsPercentage || 0
      );
      
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
      conversationStage: this.conversationManager.getConversationStage(),
      collectedInfo: this.collectedInfoManager.getCollectedInfo(),
      questionCount: this.conversationManager.getQuestionCount(),
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
    const systemPrompt = this.promptManager.buildSystemPrompt(promptContext);
    
    // Factor 5: Record prompt generation
    this.threadManager.addPromptGenerated(systemPrompt, promptContext.conversationStage);
    
    const toolCall = await this.claude.generateToolCall(
      systemPrompt,
      userMessage,
      optimizedHistory
    );
    
    // Factor 5: Record tool call generation if generated
    if (toolCall) {
      this.threadManager.addToolCallGenerated(toolCall, systemPrompt, promptContext.conversationStage);
    }
    
    return toolCall;
  }

  /**
   * Handle case when no tool call is generated (direct response)
   */
  private async handleNoToolCall(
    promptContext: PromptContext,
    userMessage: string,
    optimizedHistory: any[]
  ): Promise<ProcessMessageResult> {
    const systemPrompt = this.promptManager.buildSystemPrompt(promptContext);
    
    const response = await this.claude.generateResponse(
      systemPrompt,
      userMessage,
      optimizedHistory
    );

    this.displayManager.displayAgentResponse(response);

    // Factor 5: Record agent response
    this.threadManager.addAgentResponse(response, 'direct');

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
    this.displayManager.displayToolCall(
      toolCall.function.name,
      this.conversationManager.getConversationStage()
    );
    
    if (toolCall.function.name === 'ask_question') {
      this.displayManager.displayQuestionTimeout();
    }
  }

  /**
   * Execute tool with enhanced context
   */
  private async executeToolWithContext(toolCall: any) {
    const startTime = Date.now();
    
    const result = await this.toolExecutor.executeWithContext(toolCall, {
      traceId: this.conversationManager.getCurrentTraceId() || undefined,
      enableDebugMode: false,
      validateInput: true,
      validateOutput: true,
      maxRetries: 2,
    });
    
    const executionTime = Date.now() - startTime;
    const success = result && !result.error;
    
    // Factor 5: Record tool execution
    this.threadManager.addToolExecuted(toolCall, result, success, executionTime);
    
    return result;
  }

  /**
   * Handle question tool specific result processing
   */
  private handleQuestionToolResult(toolCall: any, enrichedResult: any): void {
    if (isAskQuestionTool(toolCall) && this.isResultSuccessful({ toolCall, toolResult: enrichedResult })) {
      const answer = enrichedResult.data?.answer;
      if (answer && typeof answer === 'string') {
        // Factor 5: Record information collection
        const question = toolCall.function?.parameters?.question || 'Unknown question';
        const category = 'general'; // Default category for collected info
        this.threadManager.addInfoCollected(question, answer, category);
        
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
   * Handle processing errors with potential recovery
   */
  private async handleProcessingError(error: unknown): Promise<ProcessMessageResult> {
    console.error('❌ Agent processing failed:', error);
    
    // Factor 5: Record error event
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    this.threadManager.addError(errorMessage, stack, 'Agent processing', true);
    
    // Try to get recovery recommendations
    try {
      const recommendations = await this.getRecoveryRecommendations();
      if (recommendations) {
        console.log(`💡 Recovery suggestions: ${recommendations.reasoning}`);
        console.log(`🔧 Primary strategy: ${recommendations.primary}`);
        console.log(`🔄 Alternatives: ${recommendations.alternatives.join(', ')}`);
      }
    } catch (recoveryError) {
      console.log('⚠️  Could not get recovery recommendations');
    }
    
    return {
      response: `申し訳ございません。処理中にエラーが発生しました: ${errorMessage}`,
    };
  }

  /**
   * Clear conversation history and reset agent state
   */
  private clearHistory(): void {
    this.collectedInfoManager.clearCollectedInfo();
    this.conversationManager.clearState();
    
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
   * Check if the result contains a tool call
   */
  private hasCalledTool(
    result: ProcessMessageResult
  ): result is { toolCall: AgentTool; toolResult: EnrichedToolResult } {
    return 'toolCall' in result && 'toolResult' in result;
  }

  /**
   * Get current thread ID
   */
  getThreadId(): string {
    return this.threadManager.getThreadId();
  }

  /**
   * Get current thread state
   */
  getThreadState() {
    return this.threadManager.getThread();
  }

  /**
   * Get thread statistics
   */
  getThreadStatistics() {
    return this.threadManager.getStatistics();
  }

  /**
   * Create checkpoint for thread recovery
   */
  async createCheckpoint(label?: string): Promise<string> {
    return await this.recoveryManager.createCheckpoint(this.threadManager, label);
  }

  /**
   * Recover from a failed thread
   */
  async recoverThread(threadId: string, strategy?: any): Promise<boolean> {
    try {
      const result = await this.recoveryManager.recoverThread(threadId, strategy);
      
      if (result.success && result.restoredThread) {
        // Replace current thread manager with recovered one
        this.threadManager = result.restoredThread;
        console.log(`✅ Thread recovered: ${result.message}`);
        return true;
      } else {
        console.error(`❌ Thread recovery failed: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Thread recovery error:', error);
      return false;
    }
  }

  /**
   * Resume a paused thread
   */
  async resumeThread(threadId: string, fromEventIndex?: number): Promise<boolean> {
    try {
      const result = await this.recoveryManager.resumeThread(threadId, fromEventIndex);
      
      if (result.success && result.restoredThread) {
        this.threadManager = result.restoredThread;
        console.log(`✅ Thread resumed: ${result.message}`);
        return true;
      } else {
        console.error(`❌ Thread resume failed: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Thread resume error:', error);
      return false;
    }
  }

  /**
   * Fork current thread for alternative execution
   */
  async forkThread(label?: string, fromEventIndex?: number): Promise<string | null> {
    try {
      const result = await this.recoveryManager.forkThread(
        this.threadManager.getThreadId(),
        fromEventIndex,
        label
      );
      
      if (result.success && result.newThreadId) {
        console.log(`✅ Thread forked: ${result.message}`);
        return result.newThreadId;
      } else {
        console.error(`❌ Thread fork failed: ${result.message}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Thread fork error:', error);
      return null;
    }
  }

  /**
   * Get recovery recommendations for the current thread
   */
  async getRecoveryRecommendations(): Promise<any> {
    try {
      return await this.recoveryManager.getRecoveryRecommendations(
        this.threadManager.getThreadId()
      );
    } catch (error) {
      console.error('❌ Failed to get recovery recommendations:', error);
      return null;
    }
  }

  /**
   * List all stored threads
   */
  async listStoredThreads(): Promise<string[]> {
    return await this.storage.list();
  }

  /**
   * Load an existing thread by ID
   */
  static async loadFromThread(threadId: string): Promise<TaskCreatorAgent> {
    const agent = new TaskCreatorAgent(threadId);
    
    try {
      // Try to load the existing thread
      const existingThread = await agent.storage.load(threadId);
      console.log(`✅ Loaded existing thread: ${threadId}`);
      console.log(`📊 Thread stats: ${existingThread.events.length} events, status: ${existingThread.status}`);
      
      return agent;
    } catch (error) {
      console.log(`⚠️  Thread ${threadId} not found, starting fresh`);
      return agent;
    }
  }

  /**
   * Monitor and record conversation stage changes
   */
  private monitorStageChange(): void {
    const currentStage = this.conversationManager.getConversationStage();
    const threadStage = this.threadManager.getCurrentConversationStage();
    
    if (currentStage !== threadStage) {
      this.threadManager.addStageChanged(threadStage, currentStage);
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