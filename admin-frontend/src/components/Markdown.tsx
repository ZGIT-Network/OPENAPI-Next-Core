import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

export function Markdown({ content, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:scroll-mt-20 prose-headings:font-semibold",
        "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
        "prose-pre:bg-muted prose-pre:border prose-pre:rounded-md prose-pre:p-3 prose-pre:overflow-x-auto",
        "prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:bg-muted/40 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-md",
        "prose-hr:border-border",
        "prose-table:block prose-table:overflow-x-auto",
        "prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2",
        "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
