import { clipboard } from 'electron';

export function buildResumeCommand(sessionId: string): string {
  return `claude --resume ${sessionId}`;
}

export function copyResumeCommand(sessionId: string): string {
  const cmd = buildResumeCommand(sessionId);
  clipboard.writeText(cmd);
  return cmd;
}
