'use client';

import type { ToolCall } from '@/types/chat';
import { Button } from '@/components/ui/button';

interface ApprovalCardProps {
  toolCall: ToolCall;
  onApprove: () => void;
  onDeny: () => void;
  isLoading?: boolean;
}

/**
 * ApprovalCard - Displays a confirmation dialog for delete operations requiring human approval.
 * Renders the tool call parameters and provides approve/deny buttons.
 */
export function ApprovalCard({ toolCall, onApprove, onDeny, isLoading = false }: ApprovalCardProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-red-800">本当に削除しますか？</h3>
        <p className="mt-1 text-sm text-red-600">この操作は取り消せません。</p>
      </div>

      <div className="mb-4 rounded-md bg-white p-3 border border-red-100">
        <p className="text-xs font-medium text-gray-500 mb-1">操作の詳細</p>
        <div className="space-y-1">
          {Object.entries(toolCall.parameters).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-sm">
              <span className="font-medium text-gray-600 min-w-24">{key}:</span>
              <span className="text-gray-800 break-all">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={onDeny}
          disabled={isLoading}
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          キャンセル
        </Button>
        <Button
          onClick={onApprove}
          disabled={isLoading}
          className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? '処理中...' : '削除する'}
        </Button>
      </div>
    </div>
  );
}
