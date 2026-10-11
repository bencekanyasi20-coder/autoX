import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Windows DPAPI binds persisted secrets to the current Windows user.
function dpapi(value, decrypt = false) {
  const operation = decrypt
    ? "$bytes=[Convert]::FromBase64String($inputText); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))"
    : "$bytes=[Text.Encoding]::UTF8.GetBytes($inputText); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))";
  const script = "$ErrorActionPreference='Stop'; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Security; $inputText=[Console]::In.ReadToEnd(); " + operation;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    let output = '';
    child.stdout.on('data', b => { output += b; });
    child.stderr.resume();
    const timer = setTimeout(() => child.kill(), 15000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('A Windows kulcstároló nem indítható.')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output.trim()) : reject(new Error('A Windows kulcstároló művelete sikertelen.')); });
    child.stdin.on('error', () => {});
    child.stdin.end(value);
  });
}

export function createVault(directory) {
  const path = join(directory, 'credentials.dpapi');
  let cached;
  let pending = Promise.resolve();
  async function get() {
    if (cached) return { ...cached };
    try {
      const encrypted = await readFile(path, 'utf8');
      if (process.platform !== 'win32') throw new Error('A mentett kulcsok Windows alatt olvashatók.');
      cached = JSON.parse(await dpapi(encrypted, true));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      cached = {};
    }
    return { ...cached };
  }
  async function save(value) {
    const serialized = JSON.stringify(value);
    const work = pending.then(async () => {
      if (process.platform !== 'win32') throw new Error('Tartós kulcsmentéshez Windows szükséges.');
      const encrypted = await dpapi(serialized);
      await mkdir(directory, { recursive: true });
      await writeFile(path + '.tmp', encrypted, { mode: 0o600 });
      await rename(path + '.tmp', path);
      cached = JSON.parse(serialized);
    });
    pending = work.catch(() => {});
    return work;
  }
  return { get, save };
}
