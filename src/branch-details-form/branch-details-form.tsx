import "./branch-details-form.scss";

import { getClient } from "azure-devops-extension-api";
import * as SDK from "azure-devops-extension-sdk";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
import { Checkbox } from "azure-devops-ui/Checkbox";
import { TextField } from "azure-devops-ui/TextField";
import { BranchCreator } from "../branch-creator";
import { BranchSelect } from "../branch-select/branch-select";
import { PullRequestCreator } from "../pull-request-creator";
import { RepositorySelect } from "../repository-select/repository-select";
import { StorageService } from "../storage-service";

export interface ISelectBranchDetailsResult {
    repositoryId: string;
    sourceBranchName: string;
    // prefix + name for each work item
    branchNames: Record<string, [string, string]>;
    createPullRequests: boolean;
    createPullRequestsAsDrafts: boolean;
    // prefix + name for each work item
    pullRequestNames: Record<string, [string, string]>;
}

interface ISelectBranchDetailsState {
    projectName?: string;
    workItems: number[];
    selectedRepositoryId?: string;
    sourceBranchName?: string;
    ready: boolean;
    branchNames: Record<string, [string, string]>;
    createPullRequests?: boolean;
    createPullRequestsAsDrafts?: boolean;
    pullRequestNames: Record<string, [string, string]>;
    branchNameMaxLength?: number;
}

class BranchDetailsForm extends React.Component<{}, ISelectBranchDetailsState> {
    constructor(props: {}) {
        super(props);
        this.state = { workItems: [], branchNames: {}, ready: false, pullRequestNames: {} };
    }

    public componentDidMount() {
        SDK.init();

        SDK.ready().then(async () => {
            const config = SDK.getConfiguration();
            if (config.dialog) {
                SDK.resize(undefined, 350);
            }

            const storageService = new StorageService();
            const settingsDocument = await storageService.getSettings();

            this.setState({
                createPullRequests: settingsDocument.createPullRequestByDefault,
                createPullRequestsAsDrafts: settingsDocument.createPullRequestsAsDrafts,
                projectName: config.projectName,
                workItems: config.workItems,
                selectedRepositoryId: config.initialValue,
                ready: false,
                branchNameMaxLength: settingsDocument.branchNameMaxLength,
            });

            await this.setBranchNames();
            await this.setPullRequestNames();

            this.setState((prevState) => ({
                ...prevState,
                ready: true,
            }));
        });
    }

    public render(): JSX.Element {
        return (
            <div className="branch-details-form flex-column flex-grow rhythm-vertical-16">
                <div className="branch-details-form-body flex-grow">
                    <RepositorySelect
                        projectName={this.state.projectName}
                        onRepositoryChange={(newRepositoryId) => this.onRepositoryChange(newRepositoryId)}
                    />
                    <BranchSelect
                        projectName={this.state.projectName}
                        repositoryId={this.state.selectedRepositoryId}
                        onBranchChange={(newBranchName) => this.onSourceBranchNameChange(newBranchName)}
                    />
                    <p>Branch Name</p>
                    <div className="branchNames flex-column scroll-auto">
                        {Object.keys(this.state.branchNames).map((workItemId) => {
                            const [prefix, name] = this.state.branchNames[workItemId];

                            return (
                                <TextField
                                    key={workItemId}
                                    value={prefix + name}
                                    onChange={(_, newValue) => {
                                        const branchNames = this.state.branchNames;

                                        newValue = this.trimPrefix(newValue, prefix);

                                        if (this.state.branchNameMaxLength) {
                                            newValue = newValue.slice(0, this.state.branchNameMaxLength);
                                        }

                                        branchNames[workItemId] = [prefix, newValue];

                                        this.setState({ branchNames: branchNames });
                                    }}
                                />
                            );
                        })}
                    </div>
                    <hr></hr>
                    <div className="flex-row flex-center justify-space-between">
                        <p>Pull Request</p>
                        <div className="flex-row">
                            <Checkbox
                                label="Create Pull Request"
                                checked={this.state.createPullRequests}
                                disabled={!this.state.ready}
                                onChange={(event, checked) => {
                                    this.setState({ createPullRequests: checked });
                                }}
                            />
                            <Checkbox
                                label="Create as draft"
                                checked={this.state.createPullRequestsAsDrafts}
                                disabled={!this.state.ready || !this.state.createPullRequests}
                                onChange={(event, checked) => {
                                    this.setState({ createPullRequestsAsDrafts: checked });
                                }}
                            />
                        </div>
                    </div>
                    {this.state.createPullRequests && (
                        <div className="branchNames flex-column scroll-auto">
                            {Object.keys(this.state.pullRequestNames).map((workItemId) => {
                                const [prefix, name] = this.state.pullRequestNames[workItemId];

                                return (
                                    <TextField
                                        key={workItemId}
                                        value={prefix + name}
                                        onChange={(_, newValue) => {
                                            const pullRequestNames = this.state.pullRequestNames;

                                            pullRequestNames[workItemId] = [prefix, this.trimPrefix(newValue, prefix)];

                                            this.setState({ pullRequestNames: pullRequestNames });
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
                <ButtonGroup className="branch-details-form-button-bar ">
                    <Button
                        disabled={!this.state.selectedRepositoryId}
                        primary={true}
                        text="Create Branch"
                        onClick={() => {
                            return this.close(
                                this.state.selectedRepositoryId && this.state.sourceBranchName
                                    ? {
                                          repositoryId: this.state.selectedRepositoryId,
                                          sourceBranchName: this.state.sourceBranchName,
                                          branchNames: this.state.branchNames,
                                          pullRequestNames: this.state.pullRequestNames,
                                          createPullRequests: this.state.createPullRequests ?? false,
                                          createPullRequestsAsDrafts: this.state.createPullRequestsAsDrafts ?? false,
                                      }
                                    : undefined,
                            );
                        }}
                    />
                    <Button text="Cancel" onClick={() => this.close(undefined)} />
                </ButtonGroup>
            </div>
        );
    }

    private close(result: ISelectBranchDetailsResult | undefined) {
        const config = SDK.getConfiguration();
        if (config.dialog) {
            config.dialog.close(result);
        }
    }

    private onRepositoryChange(newRepositoryId?: string | undefined): void {
        this.setState((prevState) => ({
            ...prevState,
            selectedRepositoryId: newRepositoryId,
        }));
    }

    private onSourceBranchNameChange(newBranchName?: string | undefined): void {
        this.setState((prevState) => ({
            ...prevState,
            sourceBranchName: newBranchName,
        }));
    }

    private async setBranchNames() {
        if (this.state.projectName) {
            const workItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
            const storageService = new StorageService();
            const settingsDocument = await storageService.getSettings();

            const branchCreator = new BranchCreator();
            let branchNames: Record<string, [string, string]> = {};
            for await (const workItemId of this.state.workItems) {
                const branchName = await branchCreator.getBranchName(
                    workItemTrackingRestClient,
                    settingsDocument,
                    workItemId,
                    this.state.projectName!,
                    this.state.sourceBranchName!,
                );
                branchNames[workItemId] = branchName;
            }

            this.setState((prevState) => ({
                ...prevState,
                branchNames: branchNames,
            }));
        }
    }

    private async setPullRequestNames() {
        if (this.state.projectName) {
            const workItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
            const storageService = new StorageService();
            const settingsDocument = await storageService.getSettings();

            const pullRequestCreator = new PullRequestCreator();
            let pullRequestNames: Record<string, [string, string]> = {};
            for await (const workItemId of this.state.workItems) {
                const prName = await pullRequestCreator.getPullRequestName(
                    workItemTrackingRestClient,
                    settingsDocument,
                    workItemId,
                    this.state.projectName!,
                );
                pullRequestNames[workItemId] = prName;
            }

            this.setState((prevState) => ({
                ...prevState,
                pullRequestNames: pullRequestNames,
            }));
        }
    }

    private trimPrefix(value: string, prefix: string): string {
        let existingPrefixLength = 0;
        for (let i = 0; i < prefix.length; i++) {
            if (value[i] === prefix[i]) {
                existingPrefixLength++;
            }
        }

        return value.slice(existingPrefixLength);
    }
}

ReactDOM.render(<BranchDetailsForm />, document.getElementById("root"));
