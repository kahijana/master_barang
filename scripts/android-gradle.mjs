import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const task = process.argv[2];
const allowedTasks = new Set(['assembleDebug', 'assembleRelease', 'bundleRelease']);

if (!allowedTasks.has(task)) {
  console.error(`Unsupported Android Gradle task: ${task ?? '(missing)'}`);
  process.exit(1);
}

const androidDirectory = resolve('android');
const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : './gradlew';
const args = isWindows ? ['/d', '/c', `gradlew.bat ${task}`] : [task];
const result = spawnSync(command, args, {
  cwd: androidDirectory,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
