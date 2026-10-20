// A tiny, safe expression language for mod content.
//
//   age >= 18 && stats.smarts > 60
//   if(stats.health < 30, -rand(1, 4), rand(-2, 2))
//
// Strings are tokenised and parsed into an AST (never passed to eval), and the
// evaluator can only read own properties of the scope object it is given and
// call functions from an explicit table.

import type { Rng } from './rng';

export type Node =
  | { t: 'lit'; v: unknown }
  | { t: 'id'; n: string }
  | { t: 'mem'; o: Node; p: string }
  | { t: 'call'; n: string; a: Node[] }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node };

export class ExprError extends Error {}

export type Fn = (env: Env, ...args: unknown[]) => unknown;

export interface Env {
  scope: Record<string, unknown>;
  rng: Rng;
  /** Extra functions (life-aware helpers like has(), count()). */
  fns?: Record<string, Fn>;
}

// ------------------------------------------------------------ tokenizer ----

type Tok =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: 'eof'; v: '' };

const OPS2 = ['&&', '||', '==', '!=', '<=', '>='];
const OPS1 = ['+', '-', '*', '/', '%', '<', '>', '!', '(', ')', ',', '.'];
const WORD_OPS: Record<string, string> = { and: '&&', or: '||', not: '!' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = Number(src.slice(i, j));
      if (Number.isNaN(v)) throw new ExprError(`Bad number "${src.slice(i, j)}"`);
      out.push({ k: 'num', v });
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) {
          s += src[j + 1];
          j += 2;
        } else {
          s += src[j++];
        }
      }
      if (j >= src.length) throw new ExprError('Unterminated string');
      out.push({ k: 'str', v: s });
      i = j + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out.push(Object.hasOwn(WORD_OPS, word) ? { k: 'op', v: WORD_OPS[word] } : { k: 'id', v: word });
      i = j;
    } else if (OPS2.includes(src.slice(i, i + 2))) {
      out.push({ k: 'op', v: src.slice(i, i + 2) });
      i += 2;
    } else if (OPS1.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
    } else {
      throw new ExprError(`Unexpected character "${c}"`);
    }
  }
  out.push({ k: 'eof', v: '' });
  return out;
}

// --------------------------------------------------------------- parser ----

const BP: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};
const UNARY_BP = 7;

function parse(src: string): Node {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expectOp = (v: string) => {
    const t = next();
    if (t.k !== 'op' || t.v !== v) throw new ExprError(`Expected "${v}"`);
  };

  function postfix(node: Node): Node {
    for (;;) {
      const t = peek();
      if (t.k === 'op' && t.v === '.') {
        next();
        const p = next();
        if (p.k !== 'id' && p.k !== 'num') throw new ExprError('Expected property name after "."');
        node = { t: 'mem', o: node, p: String(p.v) };
      } else {
        return node;
      }
    }
  }

  function primary(): Node {
    const t = next();
    switch (t.k) {
      case 'num':
      case 'str':
        return postfix({ t: 'lit', v: t.v });
      case 'id': {
        if (t.v === 'true') return { t: 'lit', v: true };
        if (t.v === 'false') return { t: 'lit', v: false };
        if (t.v === 'null') return { t: 'lit', v: null };
        const p = peek();
        if (p.k === 'op' && p.v === '(') {
          next();
          const args: Node[] = [];
          if (!(peek().k === 'op' && peek().v === ')')) {
            for (;;) {
              args.push(expr(0));
              const sep = peek();
              if (sep.k === 'op' && sep.v === ',') next();
              else break;
            }
          }
          expectOp(')');
          return postfix({ t: 'call', n: t.v, a: args });
        }
        return postfix({ t: 'id', n: t.v });
      }
      case 'op':
        if (t.v === '(') {
          const inner = expr(0);
          expectOp(')');
          return postfix(inner);
        }
        if (t.v === '!' || t.v === '-' || t.v === '+') {
          return { t: 'un', op: t.v, a: expr(UNARY_BP) };
        }
        throw new ExprError(`Unexpected "${t.v}"`);
      default:
        throw new ExprError('Unexpected end of expression');
    }
  }

  function expr(rbp: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      if (t.k !== 'op') break;
      const bp = BP[t.v];
      if (bp === undefined || bp <= rbp) break;
      next();
      left = { t: 'bin', op: t.v, a: left, b: expr(bp) };
    }
    return left;
  }

  const root = expr(0);
  if (peek().k !== 'eof') throw new ExprError(`Unexpected "${String(peek().v)}"`);
  return root;
}

const cache = new Map<string, Node>();

/** Parse (with caching). Throws ExprError with the source in the message. */
export function compile(src: string): Node {
  let node = cache.get(src);
  if (!node) {
    try {
      node = parse(src);
    } catch (e) {
      throw new ExprError(`${(e as Error).message} in expression: ${src}`);
    }
    cache.set(src, node);
  }
  return node;
}

// ------------------------------------------------------------ evaluator ----

const BLOCKED = new Set(['__proto__', 'prototype', 'constructor']);

function getProp(obj: unknown, key: string): unknown {
  if (obj == null || typeof obj !== 'object' || BLOCKED.has(key)) return undefined;
  if (Array.isArray(obj) && key === 'length') return obj.length;
  return Object.hasOwn(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
}

export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const BUILTINS: Record<string, Fn> = {
  rand: (env, a, b) => env.rng.int(num(a), num(b)),
  random: (env) => env.rng.next(),
  chance: (env, p) => env.rng.chance(num(p)),
  min: (_e, ...xs) => Math.min(...xs.map(num)),
  max: (_e, ...xs) => Math.max(...xs.map(num)),
  clamp: (_e, x, lo, hi) => Math.min(num(hi), Math.max(num(lo), num(x))),
  abs: (_e, x) => Math.abs(num(x)),
  floor: (_e, x) => Math.floor(num(x)),
  ceil: (_e, x) => Math.ceil(num(x)),
  round: (_e, x) => Math.round(num(x)),
  pow: (_e, x, y) => Math.pow(num(x), num(y)),
  fmt: (_e, x) => Math.round(num(x)).toLocaleString('en-US'),
  pick: (env, ...xs) => env.rng.pick(xs),
  cap: (_e, s) => { const t = String(s ?? ''); return t.charAt(0).toUpperCase() + t.slice(1); },
};

function evalNode(n: Node, env: Env): unknown {
  switch (n.t) {
    case 'lit':
      return n.v;
    case 'id':
      return getProp(env.scope, n.n);
    case 'mem':
      return getProp(evalNode(n.o, env), n.p);
    case 'call': {
      if (n.n === 'if') {
        // Lazy, so only the taken branch rolls dice.
        if (n.a.length !== 3) throw new ExprError('if() takes 3 arguments');
        return evalNode(n.a[0], env) ? evalNode(n.a[1], env) : evalNode(n.a[2], env);
      }
      const fn = (env.fns && Object.hasOwn(env.fns, n.n) ? env.fns[n.n] : undefined) ??
        (Object.hasOwn(BUILTINS, n.n) ? BUILTINS[n.n] : undefined);
      if (!fn) throw new ExprError(`Unknown function ${n.n}()`);
      return fn(env, ...n.a.map((a) => evalNode(a, env)));
    }
    case 'un': {
      const v = evalNode(n.a, env);
      if (n.op === '!') return !v;
      if (n.op === '-') return -num(v);
      return num(v);
    }
    case 'bin': {
      if (n.op === '&&') return evalNode(n.a, env) && evalNode(n.b, env);
      if (n.op === '||') return evalNode(n.a, env) || evalNode(n.b, env);
      const a = evalNode(n.a, env);
      const b = evalNode(n.b, env);
      switch (n.op) {
        case '==':
          return a === b || (a == null && b == null);
        case '!=':
          return !(a === b || (a == null && b == null));
        case '<':
          return num(a) < num(b);
        case '<=':
          return num(a) <= num(b);
        case '>':
          return num(a) > num(b);
        case '>=':
          return num(a) >= num(b);
        case '+':
          return typeof a === 'string' || typeof b === 'string'
            ? `${a ?? ''}${b ?? ''}`
            : num(a) + num(b);
        case '-':
          return num(a) - num(b);
        case '*':
          return num(a) * num(b);
        case '/':
          return num(b) === 0 ? 0 : num(a) / num(b);
        case '%':
          return num(b) === 0 ? 0 : num(a) % num(b);
      }
    }
  }
  throw new ExprError('Bad expression node');
}

/** Evaluate an already-compiled AST. */
export function evalAst(node: Node, env: Env): unknown {
  return evalNode(node, env);
}

export function evaluate(src: string | number | boolean | undefined, env: Env): unknown {
  if (src === undefined) return undefined;
  if (typeof src !== 'string') return src;
  return evalNode(compile(src), env);
}

export function evalNum(src: string | number | undefined, env: Env, fallback = 0): number {
  if (src === undefined || src === '') return fallback;
  return num(evaluate(src, env));
}

/** Missing conditions count as true. */
export function evalBool(src: string | undefined, env: Env): boolean {
  if (src === undefined || src === '') return true;
  return !!evaluate(src, env);
}
