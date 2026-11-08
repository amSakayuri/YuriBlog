import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, lstat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { devNull } from 'node:os';
import { z } from 'zod';
import { db } from './db';
import type { PrismaClient } from '@prisma/client';
import { HttpError } from './auth';
import {
  captureSnapshot,
  digest,
  installSnapshot,
  readSnapshot,
  snapshotHash,
  summarizeSnapshot,
  writeSnapshot,
} from './repository-snapshot';

export const repositorySchema = z
  .object({
    enabled: z.boolean().default(false),
    remote: z
      .string()
      .regex(/^$|^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/)
      .default(''),
    branch: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_/-]*$/)
      .refine((v) => !v.includes('//') && !v.endsWith('/'))
      .default('main'),
    autoPush: z.boolean().default(false),
  })
  .refine((v) => !v.enabled || Boolean(v.remote), '启用前请填写SSH仓库地址');
export type RepositoryConfig = z.infer<typeof repositorySchema>;
export async function repositorySettings() {
  return repositorySchema.parse(
    (await db.siteSetting.findUnique({ where: { key: 'repository' } }))?.value ?? {},
  );
}

const execute = promisify(execFile);
export class GitWorkspace {
  constructor(
    readonly directory: string,
    readonly remote: string,
    readonly branch: string,
    readonly environment: NodeJS.ProcessEnv,
  ) {}
  async git(...args: string[]) {
    try {
      return (
        await execute(
          'git',
          ['-c', 'core.hooksPath=/dev/null', '-c', 'core.autocrlf=false', ...args],
          {
            cwd: this.directory,
            env: this.environment,
            timeout: 60_000,
            maxBuffer: 2_000_000,
            windowsHide: true,
          },
        )
      ).stdout.trim();
    } catch {
      throw new HttpError(
        502,
        'Git操作失败：请检查仓库地址、分支、Deploy Key读写权限及known_hosts配置；远端变化也可能导致推送被拒绝',
      );
    }
  }
  async checkout() {
    await mkdir(this.directory, { recursive: true });
    if ((await lstat(this.directory)).isSymbolicLink()) throw new Error('同步目录不能为符号链接');
    if (
      !(await access(path.join(/* turbopackIgnore: true */ this.directory, '.git')).then(
        () => true,
        () => false,
      ))
    ) {
      await this.git('init', `--initial-branch=${this.branch}`);
      await this.git('remote', 'add', 'origin', this.remote);
    } else await this.git('remote', 'set-url', 'origin', this.remote);
    const exists = await this.git('ls-remote', '--heads', 'origin', `refs/heads/${this.branch}`);
    if (!exists) return null;
    await this.git('fetch', '--no-tags', 'origin', `refs/heads/${this.branch}`);
    await this.git('reset', '--hard', 'FETCH_HEAD');
    await this.git('clean', '-fd', '--', 'yuri-content');
    await this.git('checkout', '-B', this.branch, 'FETCH_HEAD');
    return this.git('rev-parse', 'HEAD');
  }
  async push() {
    await this.git('add', '--', 'yuri-content');
    if (await this.git('diff', '--cached', '--name-only'))
      await this.git(
        '-c',
        'user.name=Yuri Blog',
        '-c',
        'user.email=sync@yuri.invalid',
        'commit',
        '-m',
        'Update Yuri Blog content',
      );
    await this.git('push', 'origin', `HEAD:refs/heads/${this.branch}`);
    return this.git('rev-parse', 'HEAD');
  }
}

const quote = (value: string) => `'${value.replaceAll('\\', '/').replaceAll("'", `'"'"'`)}'`;
export async function configuredWorkspace(config: RepositoryConfig) {
  if (!config.enabled || !config.remote) throw new HttpError(400, '请先启用并配置内容仓库');
  const key = process.env.CONTENT_REPO_PRIVATE_KEY_FILE;
  const hosts = process.env.CONTENT_REPO_KNOWN_HOSTS_FILE;
  if (!key || !hosts) throw new HttpError(503, '服务器尚未配置Deploy Key私钥和known_hosts文件');
  await Promise.all([access(key), access(hosts)]).catch(() => {
    throw new HttpError(503, '服务器无法读取部署密钥或known_hosts文件');
  });
  const root = path.resolve(
    /* turbopackIgnore: true */
    process.env.CONTENT_REPO_DIR ??
      path.join(
        /* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? '.local/uploads',
        '..',
        'repository-sync',
      ),
  );
  const directory = path.join(
    /* turbopackIgnore: true */ root,
    digest(config.remote + '\n' + config.branch).slice(0, 24),
  );
  return new GitWorkspace(directory, config.remote, config.branch, {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: devNull,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: 'ssh',
    GIT_SSH_COMMAND: `ssh -i ${quote(path.resolve(/* turbopackIgnore: true */ key))} -o UserKnownHostsFile=${quote(path.resolve(/* turbopackIgnore: true */ hosts))} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes`,
  });
}

export type SyncExpectation = { localHash: string; remoteCommit: string };
export async function synchronizeRepository(
  action: 'push' | 'preview' | 'pull',
  actorId?: string,
  expected?: SyncExpectation,
  workspace?: GitWorkspace,
  store: PrismaClient = db,
) {
  const config = await repositorySettings();
  const git = workspace ?? (await configuredWorkspace(config));
  return store.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(19870518) AS locked`;
      if (!lock.locked) throw new HttpError(409, '另一个同步任务正在执行，请稍后重试');
      const local = await captureSnapshot(tx);
      const localHash = snapshotHash(local);
      const remoteCommit = await git.checkout();
      const root = path.join(/* turbopackIgnore: true */ git.directory, 'yuri-content');
      const present =
        remoteCommit &&
        (await access(path.join(/* turbopackIgnore: true */ root, 'manifest.json')).then(
          () => true,
          () => false,
        ));
      const remote = present ? await readSnapshot(root) : null;
      const remoteHash = remote ? snapshotHash(remote) : null;
      const state = await tx.repositoryState.findUnique({ where: { id: 'content' } });
      if (action === 'preview') {
        if (!remote || !remoteCommit) throw new HttpError(404, '远端分支尚无内容快照，请先推送');
        return {
          localHash,
          remoteCommit,
          changes: summarizeSnapshot(local, remote),
          media: { local: local.media.length, remote: remote.media.length },
          settingsChanged: JSON.stringify(local.settings) !== JSON.stringify(remote.settings),
        };
      }
      if (action === 'pull') {
        if (!remote || !remoteCommit || !expected) throw new HttpError(400, '请先预览远端变更');
        if (expected.localHash !== localHash || expected.remoteCommit !== remoteCommit)
          throw new HttpError(409, '本地或远端已变化，请重新预览');
        await installSnapshot(tx, remote, root);
        await tx.repositoryState.upsert({
          where: { id: 'content' },
          create: { id: 'content', localHash: remoteHash, remoteCommit },
          update: { localHash: remoteHash, remoteCommit },
        });
      } else {
        if (remoteHash && remoteHash !== localHash && remoteHash !== state?.localHash)
          throw new HttpError(409, '远端内容已修改，已停止推送。请先预览拉取，解决差异后再推送');
        if (remoteHash === localHash) return { unchanged: true, remoteCommit };
        await rm(root, { recursive: true, force: true });
        await writeSnapshot(root, local);
        const commit = await git.push();
        await tx.repositoryState.upsert({
          where: { id: 'content' },
          create: { id: 'content', localHash, remoteCommit: commit },
          update: { localHash, remoteCommit: commit },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: action === 'push' ? 'REPOSITORY_PUSH' : 'REPOSITORY_PULL',
          resource: 'repository',
          result: 'SUCCESS',
        },
      });
      return { ok: true, remoteCommit: await git.git('rev-parse', 'HEAD') };
    },
    { maxWait: 5000, timeout: 240_000, isolationLevel: 'RepeatableRead' },
  );
}
