import { AskQuestionTool, QuestionToolResult } from '../types/tools';
import { createInterface, Interface as ReadlineInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export class QuestionHandler {
  private rl: ReadlineInterface | null = null;

  constructor() {
    // 必要な時だけreadlineインターフェースを作成
  }

  async execute(tool: AskQuestionTool): Promise<QuestionToolResult> {
    const { question, context, question_type } = tool.function.parameters;

    console.log('\n' + '='.repeat(60));
    console.log('🤔 AI Agent has a question for you');
    console.log('='.repeat(60));
    console.log(`📋 Context: ${context}`);
    console.log(`❓ Question: ${question}`);
    console.log(`🏷️  Type: ${question_type}`);
    console.log('='.repeat(60));

    try {
      // Wait for the user's answer.
      const userAnswer = await this.getUserInput('\n💬 Your answer: ');
      
      console.log(`✅ Thank you! You answered: "${userAnswer}"`);
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        message: `Question answered: ${userAnswer}`,
        data: {
          question,
          context,
          asked_at: new Date(),
          answer: userAnswer,
          question_type,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ Error getting user input:', error);
      return {
        success: false,
        message: 'Failed to get user input',
        data: {
          question,
          context,
          asked_at: new Date(),
        },
        timestamp: new Date(),
      };
    } finally {
      await this.cleanup();
    }
  }

  private async getUserInput(prompt: string): Promise<string> {
    // readline/promises インターフェースを作成
    this.rl = createInterface({ input, output });

    // When Ctrl+C is pressed, the question is cancelled.
    const onSigInt = () => {
      console.log('\n\n👋 User cancelled the question.');
      this.rl?.close();
    };
    this.rl.on('SIGINT', onSigInt);

    try {
      while (true) {
        const answer = await this.rl.question(prompt);
        const trimmedAnswer = answer.trim();
        if (trimmedAnswer.length === 0) {
          console.log('❌ Empty answer. Please provide a response.');
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