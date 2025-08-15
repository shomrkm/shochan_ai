export interface PromptContext {
    userMessage: string;
    conversationStage: 'initial' | 'gathering_info' | 'confirming' | 'executing';
    collectedInfo: Record<string, string>;
    questionCount: number;
}

export const PROMPT_KEYS = {
    INITIAL_CONVERSATION: 'initial_conversation',
    INFORMATION_GATHERING: 'information_gathering',
    CONFIRMATION: 'confirmation',
    EXECUTION: 'execution'
} as const;

export type PromptFunctionKey = typeof PROMPT_KEYS[keyof typeof PROMPT_KEYS];

export interface PromptFunction {
    name: PromptFunctionKey;
    description: string;
    build: (context: PromptContext) => string;
}

export type PromptFunctionRegistry = Record<PromptFunctionKey, PromptFunction>;