import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  markdownContent: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdownContent }) => {
  return (
    <div className="prose prose-custom max-w-none prose-lg leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};