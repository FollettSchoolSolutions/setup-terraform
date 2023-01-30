#!/usr/bin/env node
/**
 * Copyright IBM Corp. 2020, 2026
 * SPDX-License-Identifier: MPL-2.0
 */

const io = require('@actions/io');
const core = require('@actions/core');
const { exec } = require('@actions/exec');

const OutputListener = require('./lib/output-listener');
const pathToCLI = require('./lib/terraform-bin');

async function checkTerraform () {
  // Setting check to `true` will cause `which` to throw if terraform isn't found
  const check = true;
  return io.which(pathToCLI, check);
}

(async () => {
  // This will fail if Terraform isn't found, which is what we want
  await checkTerraform();

  // Create listeners to receive output (in memory)
  const stdout = new OutputListener(process.stdout);
  const stderr = new OutputListener(process.stderr);
  const listeners = {
    stdout: stdout.listener,
    stderr: stderr.listener
  };

  // Execute terraform and capture output
  const args = process.argv.slice(2);
  const options = {
    listeners,
    ignoreReturnCode: true,
    silent: true // avoid printing command in stdout: https://github.com/actions/toolkit/issues/649
  };

  // INPUT_* vars are only set during the setup step; use the exported env var.
  const failOnDetectedDiff = process.env.FAIL_ON_DETECTED_DIFF === 'true';
  core.info(`setup-terraform: fail_on_detected_diff is set to ${failOnDetectedDiff}.`);

  // Only inject -detailed-exitcode for `terraform plan`; other subcommands don't support it.
  if (failOnDetectedDiff && args[0] === 'plan') {
    args.push('-detailed-exitcode');
  }

  // execute Terraform, with additional args and grab the output
  const exitCode = await exec(pathToCLI, args, options);

  // Set outputs, result, exitcode, and stderr
  core.setOutput('stdout', stdout.contents);
  core.setOutput('stderr', stderr.contents);
  core.setOutput('exitcode', exitCode.toString(10));

  // A exitCode of 0 is considered a success
  if (exitCode === 0) {
    core.info('Terraform completed successfully. (0)');
    return;
  }
  // An exitCode of 2 may be returned when the '-detailed-exitcode' option
  // is passed to plan. This denotes Success with non-empty diff (changes present).
  if (exitCode === 2) {
    if (!failOnDetectedDiff) {
      core.info('Terraform detected a difference (exit code 2). Ignoring per fail_on_detected_diff=false.');
      return;
    }
    core.setFailed('Terraform detected a difference (exit code 2).');
    return;
  }

  // A non-zero exitCode is considered an error
  core.setFailed(`Terraform exited with code ${exitCode}.`);
})();
