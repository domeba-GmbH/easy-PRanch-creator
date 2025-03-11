import "./branch-details-form.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";

import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { BranchCreator } from "../branch-creator";
import { StorageService } from "../storage-service";
import { RepositorySelect } from "../repository-select/repository-select";
import { BranchSelect } from "../branch-select/branch-select";
import { PullRequestCreator } from "../pull-request-creator";
import { Checkbox } from "azure-devops-ui/Checkbox";

export interface ISelectBranchDetailsResult {
    repositoryId: string;
    sourceBranchName: string;
    createPullRequests: boolean;
    createPullRequestsAsDrafts: boolean;
}

interface ISelectBranchDetailsState {
    projectName?: string;
    workItems: number[];
    selectedRepositoryId?: string;
    sourceBranchName?: string;
    ready: boolean;
    branchNames: string[];
    createPullRequests?: boolean;
    createPullRequestsAsDrafts?: boolean;
    pullRequestNames: string[];
}

class BranchDetailsForm extends React.Component<{}, ISelectBranchDetailsState> {
    constructor(props: {}) {
        super(props);
        this.state = { workItems: [], branchNames: [], ready: false, pullRequestNames: [] };
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
                branchNames: [],
            });

            await this.setBranchNames();
            await this.setPullRequestNames()

            this.setState(prevState => ({
                ...prevState,
                ready: true
            }));
        });
    }

    public render(): JSX.Element {
        return (
            <div className="branch-details-form flex-column flex-grow rhythm-vertical-16">
                <div className="branch-details-form-body flex-grow">
                    <RepositorySelect
                        projectName={this.state.projectName}
                        onRepositoryChange={(newRepositoryId) => this.onRepositoryChange(newRepositoryId)} />
                    <BranchSelect
                        projectName={this.state.projectName}
                        repositoryId={this.state.selectedRepositoryId}
                        onBranchChange={(newBranchName) => this.onSourceBranchNameChange(newBranchName)} />
                    <p>Branch Name</p>
                    <div className="branchNames flex-column scroll-auto">
                        <div>
                            <ul>
                                {this.state.branchNames.map((b) => (
                                    <li key={b}>{b}</li>
                                ))}
                            </ul>
                        </div>
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
                            <div>
                                <ul>
                                    {this.state.pullRequestNames.map((b) => (
                                        <li key={b}>{b}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
                <ButtonGroup className="branch-details-form-button-bar ">
                    <Button
                        disabled={!this.state.selectedRepositoryId}
                        primary={true}
                        text="Create Branch"
                        onClick={() =>
                            this.close(
                                this.state.selectedRepositoryId && this.state.sourceBranchName
                                    ? {
                                          repositoryId: this.state.selectedRepositoryId,
                                          sourceBranchName: this.state.sourceBranchName,
                                          createPullRequests: this.state.createPullRequests ?? false,
                                          createPullRequestsAsDrafts: this.state.createPullRequestsAsDrafts ?? false,
                                      }
                                    : undefined
                            )
                        }
                    />
                    <Button
                        text="Cancel"
                        onClick={() => this.close(undefined)}
                    />
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
        this.setState(prevState => ({
            ...prevState,
            selectedRepositoryId: newRepositoryId
        }));
    }

    private onSourceBranchNameChange(newBranchName?: string | undefined): void {
        this.setState(prevState => ({
            ...prevState,
            sourceBranchName: newBranchName
        }));
    }

    private async setBranchNames() {
        if (this.state.projectName) {
            const workItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
            const storageService = new StorageService();
            const settingsDocument = await storageService.getSettings();

            const branchCreator = new BranchCreator();
            let branchNames: string[] = [];
            for await (const workItemId of this.state.workItems) {
                const branchName = await branchCreator.getBranchName(workItemTrackingRestClient, settingsDocument, workItemId, this.state.projectName!, this.state.sourceBranchName!);
                branchNames.push(branchName);
            }

            this.setState(prevState => ({
                ...prevState,
                branchNames: branchNames
            }));
        }
    }

    private async setPullRequestNames() {
        if (this.state.projectName) {
            const workItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
            const storageService = new StorageService();
            const settingsDocument = await storageService.getSettings();

            const pullRequestCreator = new PullRequestCreator();
            let pullRequestNames: string[] = [];
            for await (const workItemId of this.state.workItems) {
                const branchName = await pullRequestCreator.getPullRequestName(workItemTrackingRestClient, settingsDocument, workItemId, this.state.projectName!);
                pullRequestNames.push(branchName);
            }

            this.setState(prevState => ({
                ...prevState,
                pullRequestNames: pullRequestNames
            }));
        }
    }
}

ReactDOM.render(<BranchDetailsForm />, document.getElementById("root"));