import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Event } from '@/types/chat';
import { ChatInterface } from '../chat-interface';

// Mock TanStack Query - partially to keep QueryClient/QueryClientProvider
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

// Capture onEvent callback to simulate SSE events in tests
let capturedOnEvent: ((event: Event) => void) | null = null;

vi.mock('@/hooks/use-sse', () => ({
  useSSE: vi.fn((_conversationId: string | null, onEvent: (event: Event) => void) => {
    capturedOnEvent = onEvent;
  }),
}));

vi.mock('@/hooks/use-auto-scroll', () => ({
  useAutoScroll: vi.fn(() => ({
    scrollRef: { current: null },
    handleScroll: vi.fn(),
  })),
}));

// Provide QueryClient wrapper required by useMutation
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ChatInterface', () => {
  beforeEach(() => {
    capturedOnEvent = null;
  });

  describe('thinking_chunk event handling', () => {
    it('creates a system message for the first thinking_chunk', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'thinking_chunk',
          timestamp: 1000,
          data: { content: 'ユーザーのリクエストを確認しています', messageId: 'msg-1' },
        });
      });

      expect(screen.getByText('ユーザーのリクエストを確認しています')).toBeInTheDocument();
    });

    it('appends subsequent thinking_chunks with the same messageId', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'thinking_chunk',
          timestamp: 1000,
          data: { content: 'タスク一覧を', messageId: 'msg-1' },
        });
      });

      await act(async () => {
        capturedOnEvent?.({
          type: 'thinking_chunk',
          timestamp: 1001,
          data: { content: '取得します', messageId: 'msg-1' },
        });
      });

      // Both chunks should be accumulated into a single message
      expect(screen.getByText('タスク一覧を取得します')).toBeInTheDocument();
    });

    it('creates separate messages for thinking_chunks with different messageIds', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'thinking_chunk',
          timestamp: 1000,
          data: { content: '最初の思考', messageId: 'msg-1' },
        });
      });

      await act(async () => {
        capturedOnEvent?.({
          type: 'thinking_chunk',
          timestamp: 2000,
          data: { content: '次の思考', messageId: 'msg-2' },
        });
      });

      expect(screen.getByText('最初の思考')).toBeInTheDocument();
      expect(screen.getByText('次の思考')).toBeInTheDocument();
    });
  });

  describe('tool_call event handling with Japanese labels', () => {
    it('shows Japanese label for get_tasks intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: { intent: 'get_tasks', parameters: {} },
        });
      });

      expect(screen.getByText('🔍 タスク一覧を取得しています...')).toBeInTheDocument();
    });

    it('shows Japanese label for create_task intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: { intent: 'create_task', parameters: { title: 'New Task', task_type: 'Today' } },
        });
      });

      expect(screen.getByText('✍️ タスクを作成しています...')).toBeInTheDocument();
    });

    it('shows Japanese label for update_task intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: { intent: 'update_task', parameters: { task_id: 'task-1', title: 'Updated' } },
        });
      });

      expect(screen.getByText('✏️ タスクを更新しています...')).toBeInTheDocument();
    });

    it('shows Japanese label for delete_task intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: { intent: 'delete_task', parameters: { task_id: 'task-1' } },
        });
      });

      expect(screen.getByText('🗑️ タスクの削除を確認しています...')).toBeInTheDocument();
    });

    it('shows Japanese label for create_project intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: {
            intent: 'create_project',
            parameters: { name: 'Project A', description: '', importance: '⭐⭐⭐' },
          },
        });
      });

      expect(screen.getByText('📁 プロジェクトを作成しています...')).toBeInTheDocument();
    });

    it('shows Japanese label for done_for_now intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: { intent: 'done_for_now', parameters: {} },
        });
      });

      expect(screen.getByText('✅ 処理完了')).toBeInTheDocument();
    });

    it('shows Japanese label for request_more_information intent', async () => {
      renderWithQueryClient(<ChatInterface />);

      await act(async () => {
        capturedOnEvent?.({
          type: 'tool_call',
          timestamp: 1000,
          data: { intent: 'request_more_information', parameters: {} },
        });
      });

      expect(screen.getByText('❓ 追加情報を確認中...')).toBeInTheDocument();
    });
  });
});
