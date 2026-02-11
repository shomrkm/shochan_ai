'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownContentProps {
  content: string;
}

const components: Components = {
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 underline hover:text-blue-700"
      {...props}
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
      );
    }
    return (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md p-3 mb-2 last:mb-0 overflow-x-auto text-sm font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-3 mb-2 last:mb-0 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="min-w-full border-collapse border border-muted">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-muted px-3 py-1.5 bg-muted font-bold text-left">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-muted px-3 py-1.5">{children}</td>
  ),
  hr: () => <hr className="border-muted my-3" />,
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="wrap-break-word">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
