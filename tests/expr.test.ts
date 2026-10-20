import { describe, expect, it } from 'vitest';
import { compile, evaluate, ExprError, type Env } from '../src/engine/expr';
import { rngFrom } from '../src/engine/rng';
import { fillText } from '../src/engine/text';

const env = (scope: Record<string, unknown> = {}): Env => ({ scope, rng: rngFrom({ rng: 42 }) });

describe('expression language', () => {
  it('respects operator precedence', () => {
    expect(evaluate('1 + 2 * 3', env())).toBe(7);
    expect(evaluate('(1 + 2) * 3', env())).toBe(9);
    expect(evaluate('-2 * 3', env())).toBe(-6);
    expect(evaluate('1 < 2 && 3 > 4 || true', env())).toBe(true);
    expect(evaluate('!false && 2 >= 2', env())).toBe(true);
  });

  it('reads nested scope values and treats missing ones as empty', () => {
    const e = env({ age: 20, stats: { smarts: 70 } });
    expect(evaluate('age >= 18 and stats.smarts > 60', e)).toBe(true);
    expect(evaluate('stats.missing + 1', e)).toBe(1);
    expect(evaluate('job.title', e)).toBeUndefined();
  });

  it('supports strings and comparison', () => {
    expect(evaluate("country == 'core:us'", env({ country: 'core:us' }))).toBe(true);
    expect(evaluate('"a" + 1', env())).toBe('a1');
  });

  it('has built-in functions, with lazy if()', () => {
    const e = env();
    const r = evaluate('rand(1, 6)', e) as number;
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(6);
    expect(evaluate('clamp(150, 0, 100)', e)).toBe(100);
    expect(evaluate('if(true, 1, undefinedFn())', e)).toBe(1);
    expect(evaluate('fmt(1234567)', e)).toBe('1,234,567');
    expect(evaluate("cap('she')", e)).toBe('She');
  });

  it('cannot reach globals or prototypes', () => {
    const e = env({ stats: {} });
    expect(evaluate('constructor', e)).toBeUndefined();
    expect(evaluate('stats.constructor', e)).toBeUndefined();
    expect(evaluate('stats.__proto__', e)).toBeUndefined();
    expect(() => evaluate('eval("1")', e)).toThrow(ExprError);
    expect(() => evaluate('globalThis', e)).not.toThrow();
    expect(evaluate('globalThis', e)).toBeUndefined();
  });

  it('reports syntax errors with the source', () => {
    expect(() => compile('1 +')).toThrow(/in expression: 1 \+/);
    expect(() => compile('a $ b')).toThrow(ExprError);
    expect(() => compile('(1')).toThrow(ExprError);
  });

  it('fills text templates', () => {
    const e = env({ first: 'Ana', amount: 1500, currency: '$' });
    expect(fillText('Hi {first}, you got {currency}{fmt(amount)}!', e)).toBe('Hi Ana, you got $1,500!');
    expect(fillText('Broken {1 +} stays', e)).toBe('Broken {1 +} stays');
  });
});
