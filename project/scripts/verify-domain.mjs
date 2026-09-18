import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactsRoot = resolve(projectRoot, '..', 'artifacts');
const reportPath = join(artifactsRoot, 'phase4-domain-regression.json');
const startedAt = new Date().toISOString();

function writeReport(report) {
  mkdirSync(artifactsRoot, { recursive: true });
  writeFileSync(
    reportPath,
    `${JSON.stringify({ phase: 'P4-05', startedAt, ...report }, null, 2)}\n`,
    'utf8'
  );
}

const tscCandidates = [
  process.env.COCOS_TSC,
  join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\resources\\app.asar.unpacked\\node_modules\\typescript\\bin\\tsc'
].filter((value) => typeof value === 'string' && value.length > 0);

const tsc = tscCandidates.find((candidate) => existsSync(candidate));

if (!tsc) {
  writeReport({
    status: 'FAIL',
    reason: 'TypeScript compiler not found.'
  });
  console.error('TypeScript compiler not found. Set COCOS_TSC or install a local typescript dependency.');
  process.exit(1);
}

const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.domain.json'], {
  cwd: projectRoot,
  stdio: 'inherit'
});

if (compile.status !== 0) {
  writeReport({
    status: 'FAIL',
    stage: 'domain-compile',
    exitCode: compile.status
  });
  process.exit(compile.status ?? 1);
}

const testEntry = join(projectRoot, '.domain-build', 'tests', 'DomainTests.js');
const tests = spawnSync(process.execPath, [testEntry], {
  cwd: projectRoot,
  encoding: 'utf8'
});

process.stdout.write(tests.stdout ?? '');
process.stderr.write(tests.stderr ?? '');

if (tests.status !== 0) {
  writeReport({
    status: 'FAIL',
    stage: 'domain-tests',
    exitCode: tests.status,
    output: `${tests.stdout ?? ''}${tests.stderr ?? ''}`.trim()
  });
  process.exit(tests.status ?? 1);
}

const testSummary = /Domain tests passed: (\d+)\/(\d+)\./.exec(
  tests.stdout ?? ''
);

const ccDtsCandidates = [
  process.env.COCOS_CC_DTS,
  'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\resources\\resources\\3d\\engine\\bin\\.declarations\\cc.d.ts'
].filter((value) => typeof value === 'string' && value.length > 0);
const ccDts = ccDtsCandidates.find((candidate) => existsSync(candidate));

if (!ccDts) {
  writeReport({
    status: 'PASS',
    domainTests: testSummary
      ? `${testSummary[1]}/${testSummary[2]}`
      : 'unknown',
    uiTypecheck: 'SKIPPED',
    reason: 'Cocos cc.d.ts not found.'
  });
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

writeReport({
  status: uiCompile.status === 0 ? 'PASS' : 'FAIL',
  domainTests: testSummary
    ? `${testSummary[1]}/${testSummary[2]}`
    : 'unknown',
  uiTypecheck: uiCompile.status === 0 ? 'PASS' : 'FAIL',
  exitCode: uiCompile.status
});

process.exit(uiCompile.status ?? 1);
