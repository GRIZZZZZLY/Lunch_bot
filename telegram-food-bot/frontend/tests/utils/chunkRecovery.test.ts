import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '../../src/utils/chunkRecovery';

describe('chunk load recovery detection', () => {
  it('recognizes dynamic import and chunk loading errors', () => {
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module'))
    ).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 7 failed'))).toBe(true);
    expect(isChunkLoadError('ChunkLoadError: missing chunk')).toBe(true);
    expect(isChunkLoadError(new Error('Regular API error'))).toBe(false);
  });
});
