export const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;
export type MarkdownExtension = (typeof MARKDOWN_EXTENSIONS)[number];
