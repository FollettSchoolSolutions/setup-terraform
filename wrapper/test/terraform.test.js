/**
 * Copyright IBM Corp. 2020, 2026
 * SPDX-License-Identifier: MPL-2.0
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const wrapper = path.join(__dirname, '..', 'terraform.js');

// The wrapper runs a `terraform-bin` stub; the stub shell script is POSIX only.
const describePosix = os.platform().startsWith('win') ? describe.skip : describe;

describePosix('wrapper exit code', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-wrapper-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function run (stubExitCode, failOnDetectedDiff) {
    const stub = path.join(dir, 'terraform-bin');
    fs.writeFileSync(stub, `#!/bin/sh\nexit ${stubExitCode}\n`, { mode: 0o755 });
    const outputFile = path.join(dir, 'github_output');
    fs.writeFileSync(outputFile, '');

    const result = spawnSync(process.execPath, [wrapper, 'plan'], {
      env: {
        ...process.env,
        TERRAFORM_CLI_PATH: dir,
        FAIL_ON_DETECTED_DIFF: failOnDetectedDiff,
        GITHUB_OUTPUT: outputFile
      },
      encoding: 'utf8'
    });
    return { status: result.status, outputs: fs.readFileSync(outputFile, 'utf8') };
  }

  it('exits 0 when terraform exits 0', () => {
    const { status, outputs } = run(0, 'true');
    expect(status).toBe(0);
    expect(outputs).toContain('0');
  });

  it('propagates exit code 2 when a diff is detected and fail_on_detected_diff is true', () => {
    const { status, outputs } = run(2, 'true');
    expect(status).toBe(2);
    expect(outputs).toMatch(/exitcode<<[^\n]*\n2\n/);
  });

  it('exits 0 for a diff when fail_on_detected_diff is false', () => {
    expect(run(2, 'false').status).toBe(0);
  });

  it('propagates exit code 1 on terraform error', () => {
    expect(run(1, 'true').status).toBe(1);
  });
});
