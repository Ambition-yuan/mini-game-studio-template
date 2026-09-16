import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tscCandidates = [
  process.env.COCOS_TSC,
  join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\resources\\app.asar.unpacked\\node_modules\\typescript\\bin\\tsc'
].filter((value) => typeof value === 'string' && value.length > 0);

const tsc = tscCandidates.find((candidate) => existsSync(candidate));

if (!tsc) {
  console.error('TypeScript compiler not found. Set COCOS_TSC or install a local typescript dependency.');
  process.exit(1);
}

const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.domain.json'], {
  cwd: projectRoot,
  stdio: 'inherit'
});

if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

const testEntry = join(projectRoot, '.domain-build', 'tests', 'DomainTests.js');
const tests = spawnSync(process.execPath, [testEntry], {
  cwd: projectRoot,
  stdio: 'inherit'
});

if (tests.status !== 0) {
  process.exit(tests.status ?? 1);
}

const ccDtsCandidates = [
  process.env.COCOS_CC_DTS,
  'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\resources\\resources\\3d\\engine\\bin\\.declarations\\cc.d.ts'
].filter((value) => typeof value === 'string' && value.length > 0);
const ccDts = ccDtsCandidates.find((candidate) => existsSync(candidate));

if (!ccDts) {
  console.warn('Cocos cc.d.ts not found. Skipping UI typecheck. Set COCOS_CC_DTS to enable it.');
  process.exit(0);
}

const buildRoot = join(projectRoot, '.domain-build');
mkdirSync(buildRoot, { recursive: true });
const uiTsconfigPath = join(buildRoot, 'tsconfig.ui.json');
writeFileSync(
  uiTsconfigPath,
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'Node',
        strict: true,
        noImplicitAny: true,
        experimentalDecorators: true,
        useDefineForClassFields: false,
        skipLibCheck: true,
        noEmit: true,
        lib: ['ES2020', 'DOM'],
        types: []
      },
      files: [
        ccDts,
        join(projectRoot, 'assets', 'scripts', 'game', 'ui', 'GameBootstrap.ts')
      ]
    },
    null,
    2
  )
);

const uiCompile = spawnSync(process.execPath, [tsc, '-p', uiTsconfigPath], {
  cwd: projectRoot,
  stdio: 'inherit'
});

process.exit(uiCompile.status ?? 1);
