import { AskQuestionTool, QuestionToolResult } from '../types/tools';

export class QuestionHandler {
  async execute(tool: AskQuestionTool): Promise<QuestionToolResult> {
    console.log('\n🤔 Agent has a question for you:');
    console.log(`Context: ${tool.function.parameters.context}`);
    console.log(`Question: ${tool.function.parameters.question}`);
    console.log(`Type: ${tool.function.parameters.question_type}\n`);

    // 今は質問を表示するだけ（後で入力待機を実装）
    return {
      success: true,
      message: 'Question presented to user',
      data: {
        question: tool.function.parameters.question,
        context: tool.function.parameters.context,
        asked_at: new Date(),
      },
      timestamp: new Date(),
    };
  }
}
