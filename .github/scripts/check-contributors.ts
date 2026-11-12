import { spawnSync } from "node:child_process";

export type Finding = { commit: string; field: "author" | "committer" | "coauthor" };
const bot = /devin-ai-integration(?:\[bot\])?|(?:^|[<\s])bot@devin\.ai(?:>|$)/i;
const identity = (value: string): boolean => bot.test(value) || /^Devin AI\s*</i.test(value);

function git(cwd: string, args: string[], input?: string): Buffer {
  const r = spawnSync("git", args, { cwd, input, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || r.error) throw new Error(`git ${args[0]} failed: ${r.error?.message ?? r.stderr.toString().trim()}`);
  return r.stdout;
}

export function scan(cwd: string, base: string, head: string): Finding[] {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(sha)) throw new Error("Expected full commit SHA");
    git(cwd, ["cat-file", "-e", `${sha}^{commit}`]);
  }
  if (git(cwd, ["merge-base", base, head]).toString().trim() !== base) {
    throw new Error("Base must be the merge-base of the checked range");
  }
  const commits = git(cwd, ["rev-list", "--reverse", `${base}..${head}`]).toString().trim().split("\n").filter(Boolean);
  if (!commits.length) return [];
  const objects = git(cwd, ["cat-file", "--batch"], commits.join("\n") + "\n");
  let offset = 0;
  const findings: Finding[] = [];
  for (const commit of commits) {
    const end = objects.indexOf(10, offset);
    if (end < 0) throw new Error("Truncated object header");
    const header = objects.subarray(offset, end).toString();
    const match = /^([a-f0-9]+) commit ([0-9]+)$/.exec(header);
    if (!match || match[1] !== commit) throw new Error("Invalid commit object framing");
    const size = Number(match[2]);
    offset = end + 1;
    if (!Number.isSafeInteger(size) || offset + size >= objects.length || objects[offset + size] !== 10) {
      throw new Error("Truncated commit object");
    }
    const raw = objects.subarray(offset, offset + size).toString();
    offset += size + 1;
    if (raw.includes("\0")) throw new Error("NUL in commit metadata");
    const separator = raw.indexOf("\n\n");
    if (separator < 0) throw new Error("Malformed commit");
    const headers = raw.slice(0, separator).split("\n");
    for (const field of ["author", "committer"] as const) {
      const value = headers.find(line => line.startsWith(`${field} `));
      if (!value) throw new Error(`Missing ${field}`);
      if (identity(value.slice(field.length + 1))) findings.push({ commit, field });
    }
    const message = raw.slice(separator + 2);
    for (const line of message.split(/\r?\n/)) {
      const trailer = /^\s*co-authored-by\s*:\s*(.*)$/i.exec(line);
      if (trailer && (identity(trailer[1]!) || /^Devin\s*</i.test(trailer[1]!))) {
        findings.push({ commit, field: "coauthor" });
        break;
      }
    }
  }
  if (offset !== objects.length) throw new Error("Unexpected trailing commit data");
  return findings;
}

if (import.meta.main) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) throw new Error("Usage: bun check-contributors.ts BASE_SHA HEAD_SHA");
  const findings = scan(process.cwd(), base, head);
  console.log(JSON.stringify({ passed: findings.length === 0, findings }));
  process.exitCode = findings.length ? 1 : 0;
}
