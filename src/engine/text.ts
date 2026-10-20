// Text templates: every `{...}` is evaluated as an expression.
//   "You found {currency}{fmt(amount)} on the ground, {first}."

import { compile, evaluate, ExprError, type Env } from './expr';

const PLACEHOLDER = /\{([^{}]+)\}/g;

export function fillText(template: string | undefined, env: Env): string {
  if (!template) return '';
  return template.replace(PLACEHOLDER, (whole, src: string) => {
    try {
      const v = evaluate(src.trim(), env);
      return v === undefined || v === null ? '' : String(v);
    } catch {
      return whole;
    }
  });
}

/** Syntax-check all placeholders; returns error messages. */
export function checkText(template: string): string[] {
  const errors: string[] = [];
  for (const m of template.matchAll(PLACEHOLDER)) {
    try {
      compile(m[1].trim());
    } catch (e) {
      errors.push(e instanceof ExprError ? e.message : String(e));
    }
  }
  return errors;
}
