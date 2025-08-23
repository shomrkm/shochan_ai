import { isUserInputTool } from '../types/toolGuards';
import type { AgentTool, UserInputToolResult } from '../types/tools';
import { InputHelper } from '../utils/input-helper';

export class UserInputHandler {
  private inputHelper: InputHelper;

  constructor() {
    this.inputHelper = InputHelper.getInstance();
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
      let userResponse: string | null = null;

      // Keep asking until we get a valid response
      while (!userResponse) {
        userResponse = await this.inputHelper.getUserInput('\n💬 Your input: ');

        if (!userResponse) {
          console.log('❌ Empty input. Please provide a response.');
        }
      }

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
    }
  }
}
