import { describe, expect, it } from 'vitest';
import {
  CHROME,
  COMPACT_CEILING_PX,
  isToolRailCompact,
  resolveShellClass,
  resolveShellComposition,
} from './shellComposition';

describe('shell composition', () => {
  it('derives its wide budget from the console and the instrument, not retired chrome', () => {
    expect(CHROME.consoleWide).toBe(52);
    expect(CHROME.instrumentWide).toBe(24);
    expect('topBarWide' in CHROME).toBe(false);
    expect('footerWide' in CHROME).toBe(false);
  });

  it('keeps the compact bridge exact at the CSS boundary', () => {
    expect(resolveShellClass({ width: COMPACT_CEILING_PX, height: 900 })).toBe('K0');
    expect(resolveShellClass({ width: COMPACT_CEILING_PX + 1, height: 900 })).not.toBe('K0');
  });

  it('publishes phone as a Compact sub-state only', () => {
    expect(resolveShellComposition({ width: 390, height: 844 })).toEqual({ shellClass: 'K0', phone: true });
    expect(resolveShellComposition({ width: 900, height: 844 })).toEqual({ shellClass: 'K0', phone: false });
    expect(resolveShellComposition({ width: 1440, height: 900 }).phone).toBe(false);
  });

  it('keeps tool labels exclusive to the expanded composition', () => {
    expect(isToolRailCompact('X2')).toBe(false);
    expect(isToolRailCompact('M1')).toBe(true);
    expect(isToolRailCompact('K0')).toBe(true);
  });
});
