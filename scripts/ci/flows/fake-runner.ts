// Test double for Runner: answers from a responder and records every call. An
// unanswered call throws, so a flow that runs something unexpected fails its test.
import type { CommandResult, Runner, Tool } from './runner.ts';

export interface Call {
  tool: Tool;
  args: string[];
}

export function fakeRunner(
  respond: (call: Call) => CommandResult | undefined,
): Runner & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async run(tool, args) {
      const call = { tool, args };
      calls.push(call);
      const reply = respond(call);
      if (!reply) throw new Error(`unexpected call: ${tool} ${args.join(' ')}`);
      return reply;
    },
  };
}

export const ok = (stdout = ''): CommandResult => ({ code: 0, stdout, stderr: '' });
export const json = (value: unknown): CommandResult => ok(JSON.stringify(value));
export const fail = (code = 1, stderr = 'failed'): CommandResult => ({ code, stdout: '', stderr });

/** Whether `<tool> <subcommand>` ran; `eas update` does not match `eas update:list`. */
export function ran(calls: Call[], tool: Tool, subcommand: string): boolean {
  return calls.some((call) => call.tool === tool && call.args[0] === subcommand);
}

/** Position of the first matching call, -1 if none: for ordering assertions. */
export function indexOf(calls: Call[], tool: Tool, subcommand: string, detail?: string): number {
  return calls.findIndex(
    (call) =>
      call.tool === tool &&
      call.args[0] === subcommand &&
      (detail === undefined || call.args.includes(detail)),
  );
}
