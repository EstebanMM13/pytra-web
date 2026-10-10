import { filenameFromContentDisposition } from './file-export.service';

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
  });
});
