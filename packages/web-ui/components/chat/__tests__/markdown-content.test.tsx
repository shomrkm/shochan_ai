import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownContent } from '../markdown-content';

describe('MarkdownContent', () => {
  it('renders bold text', () => {
    render(<MarkdownContent content="This is **bold** text" />);
    const bold = screen.getByText('bold');
    expect(bold.tagName).toBe('STRONG');
  });

  it('renders italic text', () => {
    render(<MarkdownContent content="This is *italic* text" />);
    const italic = screen.getByText('italic');
    expect(italic.tagName).toBe('EM');
  });

  it('renders unordered lists', () => {
    render(<MarkdownContent content={'- Item 1\n- Item 2\n- Item 3'} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders ordered lists', () => {
    render(<MarkdownContent content={'1. First\n2. Second\n3. Third'} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('renders links with target="_blank" and rel="noopener noreferrer"', () => {
    render(<MarkdownContent content="Visit [React](https://react.dev/)" />);
    const link = screen.getByRole('link', { name: 'React' });
    expect(link).toHaveAttribute('href', 'https://react.dev/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders inline code', () => {
    render(<MarkdownContent content="Use `useState` hook" />);
    const code = screen.getByText('useState');
    expect(code.tagName).toBe('CODE');
  });

  it('renders code blocks', () => {
    render(
      <MarkdownContent content={'```typescript\nconst x = 1;\n```'} />,
    );
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders headings', () => {
    render(<MarkdownContent content={'# Heading 1\n## Heading 2'} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Heading 2' })).toBeInTheDocument();
  });

  it('renders blockquotes', () => {
    render(<MarkdownContent content="> This is a quote" />);
    expect(screen.getByText('This is a quote')).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toBeInTheDocument();
  });

  it('renders tables (GFM)', () => {
    const tableContent = '| Name | Value |\n|------|-------|\n| A | 1 |\n| B | 2 |';
    render(<MarkdownContent content={tableContent} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders strikethrough (GFM)', () => {
    render(<MarkdownContent content="~~deleted~~" />);
    const del = screen.getByText('deleted');
    expect(del.tagName).toBe('DEL');
  });
});
