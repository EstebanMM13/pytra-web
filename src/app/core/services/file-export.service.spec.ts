import { MAX_FILENAME_LENGTH, filenameFromContentDisposition, sanitizeFilename } from './file-export.service';

describe('filenameFromContentDisposition', () => {
  it('reads quoted and bare filenames', () => {
    expect(filenameFromContentDisposition('attachment; filename="pytra-export.csv"', 'x')).toBe('pytra-export.csv');
    expect(filenameFromContentDisposition('attachment; filename=pytra.md', 'x')).toBe('pytra.md');
  });

  it('prefers the RFC 5987 extended filename', () => {
    expect(
      filenameFromContentDisposition(
        `attachment; filename="fallback.csv"; filename*=UTF-8''pytra-export-esteban%C3%B1.csv`,
        'x',
      ),
    ).toBe('pytra-export-estebanñ.csv');
  });

  it('falls back when the header is missing or unusable, and strips path separators', () => {
    expect(filenameFromContentDisposition(null, 'pytra.csv')).toBe('pytra.csv');
    expect(filenameFromContentDisposition('attachment', 'pytra.csv')).toBe('pytra.csv');
    expect(filenameFromContentDisposition('attachment; filename="../etc/x.csv"', 'p')).toBe('.._etc_x.csv');
    expect(filenameFromContentDisposition('attachment; filename=".."', 'pytra.csv')).toBe('pytra.csv');
    expect(filenameFromContentDisposition(`attachment; filename*=UTF-8''%00%01`, 'pytra.csv')).toBe('pytra.csv');
  });
});

describe('sanitizeFilename', () => {
  it('rejects dot-only and unusable names', () => {
    expect(sanitizeFilename('.')).toBeNull();
    expect(sanitizeFilename('..')).toBeNull();
    expect(sanitizeFilename('  ')).toBeNull();
    expect(sanitizeFilename('_-_')).toBeNull();
    expect(sanitizeFilename(null)).toBeNull();
  });

  it('removes control characters and path separators', () => {
    expect(sanitizeFilename('\x00x')).toBe('x');
    expect(sanitizeFilename('a\nb\x1f.csv')).toBe('ab.csv');
    expect(sanitizeFilename('a/b')).toBe('a_b');
    expect(sanitizeFilename('a\\b')).toBe('a_b');
  });

  it('truncates very long names, keeping the extension', () => {
    const long = `${'a'.repeat(300)}.csv`;
    const safe = sanitizeFilename(long)!;
    expect(safe).toHaveLength(MAX_FILENAME_LENGTH);
    expect(safe.endsWith('.csv')).toBe(true);
    expect(sanitizeFilename('b'.repeat(250))).toHaveLength(MAX_FILENAME_LENGTH);
  });
});
