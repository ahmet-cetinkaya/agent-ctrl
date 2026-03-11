import { describe, it, expect } from 'bun:test';
import { WorkflowCommandRenderer } from '@/infrastructure/features/apply/adapters/WorkflowCommandRenderer';

describe('WorkflowCommandRenderer', () => {
  const renderer = new WorkflowCommandRenderer();

  describe('fileExtension', () => {
    it('should return .md extension', () => {
      expect(renderer.fileExtension).toBe('.md');
    });
  });

  describe('renderCommand', () => {
    it('should pass through source unchanged', () => {
      const source = '# My Workflow\n\nSteps here';
      const result = renderer.renderCommand(source, 'workflow/test');

      expect(result).toBe(source);
    });

    it('should trim trailing whitespace', () => {
      const source = 'Content here   \n  \n';
      const result = renderer.renderCommand(source, 'test/workflow');

      expect(result).toBe('Content here');
    });

    it('should not trim leading whitespace', () => {
      const source = '  \n  Indented content';
      const result = renderer.renderCommand(source, 'ac/test');

      expect(result).toBe('  \n  Indented content');
    });

    it('should handle empty source', () => {
      const result = renderer.renderCommand('', 'empty');

      expect(result).toBe('');
    });

    it('should handle single character source', () => {
      const result = renderer.renderCommand('x', 'test');

      expect(result).toBe('x');
    });

    it('should ignore id parameter', () => {
      const source = 'Source content';
      const result1 = renderer.renderCommand(source, 'id1');
      const result2 = renderer.renderCommand(source, 'id2');

      expect(result1).toBe(result2);
    });
  });
});
