import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(projectRoot, 'config', 'wechatgame.json');
const generatedConfigPath = join(projectRoot, 'build', 'wechatgame', 'project.config.json');

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} read failed: ${path}: ${error.message}`);
  }
}

function normalizeAppId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/^(['"])(.*)\1$/, '$2');
}

const source = readJson(sourcePath, 'WeChat build config');
const generated = readJson(generatedConfigPath, 'Generated WeChat project config');
const appId = normalizeAppId(process.env.WECHAT_APP_ID || source.appId);

if (!/^wx[0-9a-f]{16}$/i.test(appId)) {
  throw new Error(`Invalid WeChat mini game AppID: "${appId}"`);
}

if (generated.compileType !== 'game') {
  throw new Error(`Expected compileType "game", got "${generated.compileType}"`);
}

generated.appid = appId;
if (typeof source.projectName === 'string' && source.projectName.trim()) {
  generated.projectname = source.projectName.trim();
}

writeFileSync(generatedConfigPath, `${JSON.stringify(generated)}\n`, 'utf8');
console.log(JSON.stringify({
  success: true,
  path: generatedConfigPath,
  appid: generated.appid,
  projectname: generated.projectname,
  compileType: generated.compileType
}, null, 2));
