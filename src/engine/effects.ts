// Effect statements: one string = one change to the life.
//
//   stats.happiness += rand(2, 6)     money -= 500       counters.crimes += 1
//   npc.relationship += 5             flag has_dog       unflag has_dog
//   unlock old_town                   die "a shark attack"
//   log "You feel lucky."

import { envOf, qualify, type Ctx } from './context';
import { compile, evalAst, ExprError, num, type Node } from './expr';
import { kill } from './death';

export type Stmt =
  | { k: 'assign'; path: string[]; op: '=' | '+=' | '-=' | '*='; expr: Node }
  | { k: 'flag'; name: string; on: boolean }
  | { k: 'unlock'; id: string }
  | { k: 'die'; expr: Node }
  | { k: 'log'; expr: Node };

const cache = new Map<string, Stmt>();

export function parseStmt(src: string): Stmt {
  const hit = cache.get(src);
  if (hit) return hit;
  const s = src.trim();
  let stmt: Stmt;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(flag|unflag)\s+([\w.:-]+)$/))) {
    stmt = { k: 'flag', name: m[2], on: m[1] === 'flag' };
  } else if ((m = s.match(/^unlock\s+([\w.:-]+)$/))) {
    stmt = { k: 'unlock', id: m[1] };
  } else if ((m = s.match(/^(die|log)\s+(.+)$/))) {
    stmt = { k: m[1] as 'die' | 'log', expr: compile(m[2]) };
  } else if ((m = s.match(/^([A-Za-z_][\w.]*)\s*(\+=|-=|\*=|=)\s*(.+)$/))) {
    stmt = { k: 'assign', path: m[1].split('.'), op: m[2] as '=', expr: compile(m[3]) };
  } else {
    throw new ExprError(`Can't understand effect: ${src}`);
  }
  cache.set(src, stmt);
  return stmt;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function combine(op: string, old: number, v: number): number {
  switch (op) {
    case '+=':
      return old + v;
    case '-=':
      return old - v;
    case '*=':
      return old * v;
    default:
      return v;
  }
}

function assign(ctx: Ctx, path: string[], op: string, raw: unknown) {
  const { life, content } = ctx;
  const [root, key] = path;
  const v = num(raw);
  switch (root) {
    case 'money':
      life.money = Math.round(combine(op, life.money, v));
      return;
    case 'stats': {
      const def = content.stats.get(key);
      if (!def) throw new ExprError(`Unknown stat "${key}"`);
      const next = combine(op, life.stats[key] ?? 0, v);
      life.stats[key] = Math.round(clamp(next, def.min ?? 0, def.max ?? 100));
      return;
    }
    case 'counters':
      life.counters[key] = combine(op, life.counters[key] ?? 0, v);
      return;
    case 'flags':
      life.flags[key] = !!raw;
      return;
    case 'npc':
      if (!ctx.npc) throw new ExprError('No npc in this context');
      if (key !== 'relationship') throw new ExprError(`npc.${key} is read-only`);
      ctx.npc.relationship = Math.round(clamp(combine(op, ctx.npc.relationship, v), 0, 100));
      return;
    case 'job':
      if (!life.job) return;
      if (key !== 'performance') throw new ExprError(`job.${key} is read-only`);
      life.job.performance = Math.round(clamp(combine(op, life.job.performance, v), 0, 100));
      return;
    case 'education':
      if (!life.education.current) return;
      if (key !== 'grades') throw new ExprError(`education.${key} is read-only`);
      life.education.current.grades = Math.round(
        clamp(combine(op, life.education.current.grades, v), 0, 100),
      );
      return;
    case 'vars':
      ctx.vars = ctx.vars ?? {};
      ctx.vars[key] = combine(op, num(ctx.vars[key]), v);
      return;
  }
  throw new ExprError(`Can't assign to "${path.join('.')}"`);
}

/** Runs effects in order. Returns extra log lines produced by `log`. */
export function runEffects(effects: string[] | undefined, ctx: Ctx): string[] {
  const lines: string[] = [];
  for (const src of effects ?? []) {
    if (!ctx.life.alive) break;
    const stmt = parseStmt(src);
    const env = envOf(ctx);
    switch (stmt.k) {
      case 'assign':
        assign(ctx, stmt.path, stmt.op, evalAst(stmt.expr, env));
        break;
      case 'flag':
        if (stmt.on) ctx.life.flags[stmt.name] = true;
        else delete ctx.life.flags[stmt.name];
        break;
      case 'unlock': {
        const id = qualify(stmt.id, ctx.modId);
        if (!ctx.life.lore.includes(id)) {
          ctx.life.lore.push(id);
          const title = ctx.content.lore.get(id)?.title;
          if (title) lines.push(`📖 Lorebook unlocked: ${title}`);
        }
        break;
      }
      case 'log':
        lines.push(String(evalAst(stmt.expr, env) ?? ''));
        break;
      case 'die':
        kill(ctx.content, ctx.life, String(evalAst(stmt.expr, env) ?? 'unknown causes'));
        break;
    }
  }
  return lines;
}
