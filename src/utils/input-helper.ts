// src/utils/input-helper.ts

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

/**
 * Shared input helper to avoid readline interface conflicts
 */
export class InputHelper {
  private static instance: InputHelper;

  private constructor() {}

  static getInstance(): InputHelper {
    if (!InputHelper.instance) {
      InputHelper.instance = new InputHelper();
    }
    return InputHelper.instance;
  }

  /**
   * Get user input with a prompt
   */
  async getUserInput(prompt: string): Promise<string | null> {
    const rl = createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
    });

    try {
      // Set up Ctrl+C handler
      const onSigInt = () => {
        console.log('\n👋 Goodbye!');
        rl.close();
        process.exit(0);
      };

      rl.on('SIGINT', onSigInt);

      const answer = await rl.question(prompt);
      return answer.trim() || null;
    } catch (error) {
      // Handle any errors (like Ctrl+C)
      return null;
    } finally {
      rl.close();
    }
  }
}
