/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, Messages, SfError } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { RequestStatus } from '@salesforce/source-deploy-retrieve';
import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
  Ux,
} from '@salesforce/sf-plugins-core';
import { Interfaces } from '@oclif/core';
import { DeployCommand } from '../../../../deployCommand';
import {
  DeployCancelCommandResult,
  DeployCancelResultFormatter,
} from '../../../../formatters/deployCancelResultFormatter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-source', 'md.cancel');

const replacement = 'project deploy cancel';

export class Cancel extends DeployCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'deprecated';
  public static readonly deprecationOptions = {
    to: replacement,
    message: messages.getMessage('deprecation', [replacement]),
  };
  public static readonly flags = {
    'api-version': orgApiVersionFlagWithDeprecations,
    loglevel,
    'target-org': requiredOrgFlagWithDeprecations,
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      default: Duration.minutes(DeployCommand.DEFAULT_WAIT_MINUTES),
      min: 1,
      description: messages.getMessage('flags.wait.description'),
      summary: messages.getMessage('flags.wait.summary'),
    }),
    jobid: Flags.salesforceId({
      char: 'i',
      length: 'both',
      startsWith: '0Af',
      summary: messages.getMessage('flags.jobid.summary'),
    }),
  };
  private flags: Interfaces.InferredFlags<typeof Cancel.flags>;
  private conn: Connection;

  public async run(): Promise<DeployCancelCommandResult> {
    this.flags = (await this.parse(Cancel)).flags;
    this.conn = this.flags['target-org'].getConnection(this.flags['api-version']);
    await this.cancel();
    this.resolveSuccess();
    return this.formatResult();
  }

  protected async cancel(): Promise<void> {
    const deployId = this.resolveDeployId(this.flags.jobid);
    try {
      const deploy = this.createDeploy(this.conn, deployId);
      await deploy.cancel();

      this.deployResult = await this.poll(this.conn, deployId);
    } catch (e) {
      const err = e as Error;
      throw new SfError(messages.getMessage('CancelFailed', [err.message]), 'CancelFailed');
    }
  }

  protected resolveSuccess(): void {
    const status = this.deployResult.response.status;
    if (status !== RequestStatus.Canceled) {
      this.setExitCode(1);
    }
  }

  protected formatResult(): DeployCancelCommandResult {
    const formatter = new DeployCancelResultFormatter(new Ux({ jsonEnabled: this.jsonEnabled() }), this.deployResult);
    if (!this.jsonEnabled()) {
      formatter.display();
    }
    return formatter.getJson();
  }
}
