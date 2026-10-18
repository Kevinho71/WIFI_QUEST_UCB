import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '@/lib/clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyText', () => {
  it('usa navigator.clipboard cuando está disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('ClaveSecreta')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('ClaveSecreta');
  });

  it('cae al textarea + execCommand si clipboard falla', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const textarea = {
      value: '',
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    };
    const execCommand = vi.fn().mockReturnValue(true);
    const appendChild = vi.fn();
    const removeChild = vi.fn();

    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild, removeChild },
      execCommand,
    });

    await expect(copyText('ClaveSecreta')).resolves.toBe(true);
    expect(textarea.value).toBe('ClaveSecreta');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(removeChild).toHaveBeenCalledWith(textarea);
  });

  it('devuelve false si el fallback también falla', async () => {
    vi.stubGlobal('navigator', {});

    const textarea = {
      value: '',
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    };

    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand: vi.fn().mockReturnValue(false),
    });

    await expect(copyText('ClaveSecreta')).resolves.toBe(false);
  });
});
