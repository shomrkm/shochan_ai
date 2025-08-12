import { AskQuestionTool, QuestionToolResult } from '../types/tools';
import * as readline from 'readline';

export class QuestionHandler {
  private rl: readline.Interface | null = null;

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
      // ユーザーからの入力を待機
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
      this.cleanup();
    }
  }

  private getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // readlineインターフェースを作成
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      this.rl.question(prompt, (answer) => {
        const trimmedAnswer = answer.trim();
        if (trimmedAnswer === '') {
          console.log('❌ Empty answer. Please provide a response.');
          // 再帰的に再質問
          this.getUserInput(prompt).then(resolve).catch(reject);
        } else {
          resolve(trimmedAnswer);
        }
      });

      // Ctrl+C の処理
      this.rl.on('SIGINT', () => {
        console.log('\n\n👋 User cancelled the question.');
        reject(new Error('User cancelled input'));
      });
    });
  }

  private cleanup(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}