import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline/promises';
import type { 
  AgentTool,
  UserInputToolResult 
} from '../types/tools';
import { isUserInputTool } from '../types/toolGuards';

export class UserInputHandler {
  private rl: ReadlineInterface | null = null;

  constructor() {
    // Create the readline interface only when needed.
  }

  async execute(tool: AgentTool): Promise<UserInputToolResult> {
    if (!isUserInputTool(tool)) {
      throw new Error('Invalid tool type for user input');
    }

    const { message, context } = tool.function.parameters;

    console.log('\n' + '='.repeat(60));
    console.log('🤔 AI Agent needs your input');
    console.log('='.repeat(60));
    console.log(`📋 Context: ${context}`);
    console.log(`💬 ${message}`);
    console.log('='.repeat(60));

    try {
      // Wait for the user's answer.
      const userResponse = await this.getUserInput('\n💬 Your input: ');

      console.log(`✅ Thank you! You said: "${userResponse}"`);
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        message: `User input received: ${userResponse}`,
        data: {
          message,
          context,
          user_response: userResponse,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ Error getting user input:', error);
      return {
        success: false,
        message: 'Failed to get user input',
        data: {
          message,
          context,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };
    } finally {
      await this.cleanup();
    }
  }

  private async getUserInput(prompt: string): Promise<string> {
    this.rl = createInterface({ input, output });

    // When Ctrl+C is pressed, the input is cancelled.
    const onSigInt = () => {
      console.log('\n\n👋 User cancelled the input.');
      this.rl?.close();
    };
    this.rl.on('SIGINT', onSigInt);

    try {
      while (true) {
        const answer = await this.rl.question(prompt);
        const trimmedAnswer = answer.trim();
        if (trimmedAnswer.length === 0) {
          console.log('❌ Empty input. Please provide a response.');
          continue;
        }
        return trimmedAnswer;
      }
    } finally {
      this.rl.off('SIGINT', onSigInt);
      this.rl.close();
      this.rl = null;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}