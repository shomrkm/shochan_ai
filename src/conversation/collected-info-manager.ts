import type { AgentTool } from '../types/tools';
import { isAskQuestionTool } from '../types/tools';

/**
 * Manages collected information from user interactions
 */
export class CollectedInfoManager {
  private collectedInfo: Record<string, string> = {};

  /**
   * Update collected information based on user's answer to questions
   * @param toolCall the tool call that asked the question
   * @param answer the answer from the user
   */
  updateCollectedInfo(toolCall: AgentTool, answer: string): void {
    if (!isAskQuestionTool(toolCall)) {
      throw new Error('Invalid tool type for askQuestion');
    }

    const question = toolCall.function.parameters.question;
    const q = question.toLowerCase();
    
    if (q.includes('feature') || q.includes('functionality') || q.includes('what')) {
      this.collectedInfo.feature = answer;
    } else if (q.includes('technology') || q.includes('tech stack') || q.includes('how')) {
      this.collectedInfo.techStack = answer;
    } else if (q.includes('deadline') || q.includes('when') || q.includes('timeline')) {
      this.collectedInfo.deadline = answer;
    } else if (q.includes('priority') || q.includes('importance') || q.includes('urgent')) {
      this.collectedInfo.priority = answer;
    } else if (q.includes('name') || q.includes('title') || q.includes('call')) {
      this.collectedInfo.title = answer;
    } else if (q.includes('description') || q.includes('detail') || q.includes('about')) {
      this.collectedInfo.description = answer;
    } else if (q.includes('confirm') || q.includes('proceed') || q.includes('correct')) {
      this.collectedInfo.confirmation = answer;
    } else {
      const key = `question_${Object.keys(this.collectedInfo).length + 1}`;
      this.collectedInfo[key] = answer;
    }
  }

  /**
   * Get all collected information
   */
  getCollectedInfo(): Record<string, string> {
    return { ...this.collectedInfo };
  }

  /**
   * Display currently collected information
   */
  displayCollectedInfo(): void {
    console.log('\n📝 Collected information so far:');
    console.log(JSON.stringify(this.collectedInfo, null, 2));
    console.log('\n');
  }

  /**
   * Check if basic information has been collected
   */
  hasBasicInfo(): boolean {
    return !!(this.collectedInfo.feature || this.collectedInfo.title);
  }

  /**
   * Check if detailed information has been collected
   */
  hasDetails(): boolean {
    return !!(this.collectedInfo.description || this.collectedInfo.feature);
  }

  /**
   * Clear all collected information
   */
  clearCollectedInfo(): void {
    this.collectedInfo = {};
  }

  /**
   * Get collected information count
   */
  getInfoCount(): number {
    return Object.keys(this.collectedInfo).length;
  }

  /**
   * Check if specific information exists
   */
  hasInfo(key: string): boolean {
    return key in this.collectedInfo;
  }

  /**
   * Get specific collected information
   */
  getInfo(key: string): string | undefined {
    return this.collectedInfo[key];
  }
}