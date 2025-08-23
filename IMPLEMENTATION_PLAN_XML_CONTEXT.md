# XML-Based Context Management Implementation Plan
## 12-Factor Agents Factor 3: Own Your Context Window

---

## 📋 Project Overview

### Goal
Implement XML-based context management following 12-factor agents principles to dramatically improve LLM understanding, debugging capabilities, and system maintainability.

### Current Status
- ✅ Traditional `Anthropic.MessageParam[]` based context management
- ✅ Basic tool execution tracking in ContextManager  
- ⚠️ Limited context visibility and structure
- ⚠️ Complex tool execution extraction from message history

### Target Architecture
- 🎯 Event-based Thread model with YAML-in-XML serialization following 12-factor agents standards
- 🎯 Type-safe event data structures with proper YAML formatting
- 🎯 Structured context presentation to LLM using standard YAML syntax
- 🎯 Backward compatibility with existing system

---

## 🔍 Current System Analysis

### Strengths
- Well-structured tool system (create_task, create_project, user_input)
- Clear separation of concerns (ContextManager, DisplayManager, EnhancedToolExecutor)
- Type-safe tool definitions with accurate Notion DB schema
- Robust error handling and validation

### Pain Points
- **Context Extraction**: `extractToolExecutions()` attempts to parse MessageParam for tool results
- **Limited Visibility**: Conversation history is opaque to developers
- **LLM Understanding**: Context information is fragmented and hard to parse
- **Debugging**: No clear view of conversation state and flow

### Key Files Requiring Changes
```
src/
├── types/prompt-types.ts           # Extend PromptContext
├── conversation/
│   ├── context-manager.ts          # Current implementation
│   └── enhanced-context-manager.ts # New XML-based implementation
├── prompts/system-prompt.ts        # Update context building
└── agents/task-creator.ts          # Gradual integration
```

---

## 🏗️ XML-Based Context Architecture

### Core Components

#### 1. Event System
```typescript
// src/events/types.ts
export type EventType =
  | 'user_message'
  | 'create_task' | 'create_project' | 'user_input'
  | 'create_task_result' | 'create_project_result' | 'user_input_result'
  | 'agent_response' | 'error';

// Accurate event data matching current project types
export interface CreateTaskData {
  title: string;
  description: string;
  task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
  scheduled_date?: string;
  project_id?: string;
}

export interface CreateProjectData {
  name: string;
  description: string;
  importance: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐'; // Actual star format
  action_plan?: string;
}
```

#### 2. Thread Model
```typescript
// src/events/thread.ts
import * as yaml from 'js-yaml';

export class Event<T extends EventData = EventData> {
  toXML(): string {
    const yamlContent = this.stringifyToYaml(this.data);
    return `<${this.type}>\n${yamlContent}\n</${this.type}>`;
  }

  private stringifyToYaml(data: EventData): string {
    if (typeof data === 'string') {
      return data;
    }
    
    // Proper YAML formatting following 12-factor agents standard
    return yaml.dump(data, {
      indent: 2,
      lineWidth: 80,
      noRefs: true,
      sortKeys: false,
      defaultFlowStyle: false
    }).trim();
  }
}

export class Thread {
  toPrompt(): string {
    const sessionInfo = yaml.dump({
      thread_id: this.id,
      start_time: this.startTime.toISOString(),
      event_count: this.events.length
    }, { indent: 2 }).trim();

    return `<conversation_context>
<session_info>
${sessionInfo}
</session_info>

${this.events.map(e => e.toXML()).join('\n\n')}
</conversation_context>`;
  }
}
```

#### 3. YAML-in-XML Context Example (Following 12-Factor Agents Standard)
```xml
<conversation_context>
<session_info>
thread_id: thread_1724398500_abc123
start_time: '2025-08-23T10:35:00Z'
event_count: 5
</session_info>

<user_message>
message: 新しいプロジェクトを作成したい
timestamp: '2025-08-23T10:35:00Z'
</user_message>

<user_input>
message: プロジェクトの詳細を教えてください
context: project_creation
</user_input>

<user_input_result>
success: true
user_response: AIに関する研究プロジェクトです
execution_time: 245
error: null
</user_input_result>

<create_project>
name: AI研究プロジェクト
description: 機械学習の研究を行うプロジェクト
importance: ⭐⭐⭐⭐
action_plan: null
</create_project>

<create_project_result>
success: true
project_id: proj_456
name: AI研究プロジェクト
description: 機械学習の研究を行うプロジェクト
importance: ⭐⭐⭐⭐
created_at: '2025-08-23T10:35:00Z'
notion_url: https://notion.so/proj_456
action_plan: null
execution_time: 1200
error: null
</create_project_result>
</conversation_context>
```

---

## 📅 Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal**: Implement core Event/Thread system

#### 1.1 Create Event Type System
- `src/events/types.ts`
  - Define all EventType variants
  - Create type-safe EventData interfaces matching current project schema
  - Export EventData union type

#### 1.2 Implement Event/Thread Classes  
- `src/events/thread.ts`
  - Event class with YAML-in-XML serialization using js-yaml
  - Thread class with event management
  - toPrompt() method for structured XML context generation

#### 1.3 Create YAML Utilities
- `src/events/yaml-utils.ts`
  - Proper YAML formatting using js-yaml library
  - Custom YAML serialization options for consistency
  - XML tag generation with YAML content

**Deliverables**:
- [ ] **Unit Tests First**: Complete test suites for Event/Thread classes (100% coverage)
- [ ] Event/Thread implementation with proper YAML formatting (TDD approach)
- [ ] YAML utilities with comprehensive edge case testing
- [ ] Example XML context outputs following 12-factor agents standard
- [ ] js-yaml integration and configuration
- [ ] **Test Validation**: All tests passing before moving to Phase 2

### Phase 2: Enhanced Context Manager (Week 2) 
**Goal**: Create XML-based context management

#### 2.1 Extend PromptContext Type
- `src/types/prompt-types.ts`
```typescript
export interface PromptContext {
  userMessage: string;
  conversationHistory: Anthropic.MessageParam[]; // Legacy compatibility
  xmlContext?: string; // New XML-based context
  thread?: Thread; // Access to full thread
}
```

#### 2.2 Implement EnhancedContextManager
- `src/conversation/enhanced-context-manager.ts`
  - Event-based context tracking
  - XML context generation
  - Legacy compatibility methods
  - Backward compatibility with existing ContextManager

#### 2.3 Update System Prompt Builder
- `src/prompts/system-prompt.ts`
  - Support XML context in buildSystemPrompt()
  - Remove complex extractToolExecutions() logic
  - Simplify context presentation

**Deliverables**:
- [ ] **Unit Tests First**: EnhancedContextManager test suite (100% coverage)
- [ ] EnhancedContextManager implementation (TDD approach)
- [ ] **Integration Tests**: Context generation end-to-end testing
- [ ] Updated system prompt with XML support
- [ ] **Backward Compatibility Tests**: Legacy ContextManager integration
- [ ] **Performance Benchmarks**: Baseline measurements established

### Phase 3: TaskCreatorAgent Integration (Week 3)
**Goal**: Gradual migration to XML context

#### 3.1 Add XML Context Support
- `src/agents/task-creator.ts`
  - Optional EnhancedContextManager usage
  - Feature flag for XML vs traditional context
  - Dual-mode operation during transition

#### 3.2 Event Recording Integration
- Update tool execution methods:
  - `executeCreateTask()` → Record create_task + create_task_result events
  - `executeCreateProject()` → Record create_project + create_project_result events  
  - `executeUserInput()` → Record user_input + user_input_result events

#### 3.3 XML Prompt Generation
- Modify `determineNextStep()` to use XML context
- Update `handleNoToolCall()` with structured context
- Maintain backward compatibility

**Deliverables**:
- [ ] **Unit Tests First**: TaskCreatorAgent modifications test suite
- [ ] **Integration Tests**: End-to-end conversation flow testing
- [ ] Dual-mode TaskCreatorAgent implementation (TDD approach)
- [ ] Complete event recording for all tools with validation tests
- [ ] **A/B Testing Framework**: Comprehensive comparison testing
- [ ] **Regression Tests**: Ensure no functionality loss

### Phase 4: Testing & Optimization (Week 4)
**Goal**: Validate and optimize implementation

#### 4.1 Performance Testing
- Context generation performance
- Memory usage comparison
- LLM response time measurement

#### 4.2 Quality Assessment
- LLM response accuracy comparison
- Conversation flow analysis
- Error handling validation

#### 4.3 Developer Experience
- Debug output improvements
- Logging enhancements
- Context inspection tools

**Deliverables**:
- [ ] Performance benchmarks
- [ ] Quality metrics comparison
- [ ] Developer tools for context inspection

### Phase 5: Production Migration (Week 5)
**Goal**: Complete migration and cleanup

#### 5.1 Default Migration
- Switch default context manager to Enhanced
- Feature flag removal
- Legacy code cleanup

#### 5.2 Documentation Updates
- Update README with XML context examples
- Add debugging guides
- Create context management best practices

#### 5.3 Monitoring & Maintenance
- Performance monitoring setup
- Error tracking improvements
- User experience metrics

**Deliverables**:
- [ ] Complete migration to XML context
- [ ] Updated documentation
- [ ] Production monitoring setup

---

## ⚠️ Risks & Mitigation Strategies

### Technical Risks

#### 1. Performance Impact
**Risk**: XML generation and string manipulation overhead
**Mitigation**:
- Benchmark against current implementation
- Implement lazy XML generation
- Cache context when possible
- Monitor memory usage

#### 2. API Compatibility
**Risk**: Changes to Anthropic API or LLM behavior
**Mitigation**: 
- Maintain dual-mode operation
- Abstract LLM interface
- Test with multiple context formats

#### 3. Context Window Limits
**Risk**: XML format may increase token usage
**Mitigation**:
- Implement context truncation strategies  
- Monitor token usage
- Optimize XML format for brevity

### Business Risks

#### 4. Development Timeline
**Risk**: Complex migration affecting delivery
**Mitigation**:
- Incremental implementation approach
- Feature flags for safe rollback
- Parallel development paths

#### 5. User Experience
**Risk**: Changes affecting conversation quality
**Mitigation**:
- A/B testing implementation
- Gradual rollout with monitoring
- Quick rollback capability

---

## 📊 Success Metrics

### Primary Metrics
- **Context Clarity**: Improved LLM understanding of conversation state
- **Debug Efficiency**: Reduced time to identify conversation issues
- **Development Velocity**: Faster feature development with clear context

### Technical Metrics
- **Context Generation Time**: <50ms for typical conversations
- **Memory Usage**: <20% increase from current implementation  
- **Token Efficiency**: Comparable or better context/token ratio
- **Error Reduction**: 30%+ reduction in context-related errors

### Quality Metrics
- **Conversation Success Rate**: Maintained or improved task creation success
- **LLM Response Relevance**: Improved contextual awareness
- **Developer Satisfaction**: Improved debugging and development experience

---

## 🔧 Development Environment Setup

### Required Dependencies
```json
// package.json additions - REQUIRED for proper YAML formatting
{
  "dependencies": {
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.5"
  }
}
```

### Testing Strategy (Test-Driven Development)

#### Unit Testing with Vitest
**Requirement**: All classes MUST have comprehensive unit tests before implementation

##### Event System Tests (`src/events/types.test.ts`)
```typescript
describe('Event Types', () => {
  test('should create valid EventData interfaces')
  test('should enforce type safety for each EventType')
  test('should handle optional fields correctly')
})
```

##### Event Class Tests (`src/events/thread.test.ts`)
```typescript
describe('Event Class', () => {
  test('should create event with correct timestamp and ID')
  test('should serialize simple data to YAML format')
  test('should handle complex nested data structures')
  test('should format XML tags correctly')
  test('should handle null/undefined values properly')
})

describe('Thread Class', () => {
  test('should initialize with correct thread ID and timestamp')
  test('should add events and maintain order')
  test('should generate valid XML context')
  test('should handle empty thread gracefully')
  test('should provide accurate execution statistics')
  test('should filter events by type correctly')
})
```

##### YAML Utils Tests (`src/events/yaml-utils.test.ts`)
```typescript
describe('YAML Utilities', () => {
  test('should format YAML with consistent indentation')
  test('should handle Japanese text correctly')
  test('should preserve data types (strings, numbers, booleans)')
  test('should format arrays and objects properly')
  test('should handle special characters in XML context')
})
```

##### Enhanced Context Manager Tests (`src/conversation/enhanced-context-manager.test.ts`)
```typescript
describe('EnhancedContextManager', () => {
  test('should maintain backward compatibility with legacy methods')
  test('should generate correct XML context')
  test('should handle dual-mode operation')
  test('should record events in correct sequence')
  test('should build prompt context with XML data')
})
```

#### Integration Testing
- Context generation end-to-end flows
- TaskCreatorAgent integration with XML context
- System prompt building with XML input
- LLM interaction with structured context

#### Performance Testing  
- YAML generation performance benchmarks
- Memory usage comparison (current vs XML)
- Context window size monitoring
- Token usage measurement

#### Test Coverage Requirements
- **Unit Tests**: 100% coverage for all Event/Thread classes
- **Integration Tests**: 95% coverage for context management flows
- **E2E Tests**: Critical user journey coverage
- **Performance Tests**: Baseline establishment and regression detection

### Code Quality Standards
- 100% TypeScript strict mode compliance
- **Test-First Development**: Write tests before implementation
- Comprehensive JSDoc documentation
- ESLint/Prettier configuration maintenance
- **Mandatory**: All PRs must include corresponding test updates

---

## 📝 Implementation Notes

### File Organization
```
src/
├── events/                    # New YAML-in-XML context system
│   ├── types.ts              # Event type definitions
│   ├── thread.ts             # Event/Thread classes with js-yaml integration
│   └── yaml-utils.ts         # YAML formatting utilities
├── conversation/
│   ├── context-manager.ts    # Legacy (maintain)
│   └── enhanced-context-manager.ts # YAML-in-XML based
└── types/
    └── prompt-types.ts       # Extended with XML support
```

### Migration Strategy
1. **Parallel Implementation**: New system alongside existing
2. **Feature Flags**: Easy switching between implementations  
3. **Gradual Rollout**: Start with development/testing environments
4. **Monitoring**: Comprehensive metrics during transition
5. **Rollback Plan**: Quick revert to traditional approach if needed

### Coding Standards
- **Test-Driven Development**: Write comprehensive unit tests before implementation
- Follow existing project conventions (Vitest, TypeScript strict mode)
- Maintain backward compatibility during transition
- Comprehensive error handling with test coverage
- Clear documentation and examples
- Type safety as first priority
- **Mandatory Code Review**: All implementations must pass tests before PR approval

---

## 🚀 Getting Started

### Phase 1 Kickoff Tasks (Test-Driven Development)
1. Add js-yaml dependency: `npm install js-yaml @types/js-yaml`
2. Create `src/events/` directory structure with test files
3. **Write Unit Tests First**:
   - `src/events/types.test.ts` - Event type validation tests
   - `src/events/thread.test.ts` - Event/Thread class tests  
   - `src/events/yaml-utils.test.ts` - YAML formatting tests
4. **Implement with TDD**:
   - Event class with proper YAML-in-XML serialization (tests first)
   - Thread class with YAML-based event management (tests first)
   - YAML utilities following test specifications
5. **Validation**:
   - Run `npm test` - ensure 100% test coverage
   - Generate example YAML-in-XML outputs
   - Verify outputs follow 12-factor agents standard

### Next Steps After Plan Approval
- Set up development branch: `feature/xml-context-management`
- Create GitHub issues for each phase milestone  
- Set up testing framework for context comparison
- Begin Phase 1 implementation

---

*This implementation plan follows 12-factor agents principles while maintaining compatibility with the existing shochan_ai project architecture. The phased approach ensures minimal risk while delivering significant improvements to context management and system maintainability.*