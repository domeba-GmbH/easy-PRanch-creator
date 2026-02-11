import { CommonServiceIds, getClient, IGlobalMessagesService, IProjectInfo } from "azure-devops-extension-api";
import { GitPullRequest, GitRestClient } from "azure-devops-extension-api/Git";
import { JsonPatchOperation, Operation } from "azure-devops-extension-api/WebApi";
import {
    WorkItemExpand,
    WorkItemRelation,
    WorkItemTrackingRestClient,
} from "azure-devops-extension-api/WorkItemTracking";
import * as SDK from "azure-devops-extension-sdk";
import SettingsDocument from "./settingsDocument";
import { StorageService } from "./storage-service";
import { Tokenizer } from "./tokenizer";

export class PullRequestCreator {
    public async createPullRequest(
        workItemId: number,
        repositoryId: string,
        sourceBranchName: string,
        targetBranchName: string,
        project: IProjectInfo,
        createAsDraft: boolean,
        pullRequestTitle: string,
    ) {
        const globalMessagesSvc = await SDK.getService<IGlobalMessagesService>(CommonServiceIds.GlobalMessagesService);
        const gitRestClient = getClient(GitRestClient);
        const workItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
        const storageService = new StorageService();

        const repository = await gitRestClient.getRepository(repositoryId, project.name);

        const pullRequestTemplate = await this.getPRTemplate(gitRestClient, repositoryId, project.id);

        let pullRequest = {
            title: pullRequestTitle,
            sourceRefName: `refs/heads/${sourceBranchName}`,
            targetRefName: `refs/heads/${targetBranchName}`,
            isDraft: createAsDraft,
            description: pullRequestTemplate ?? "",
        } as GitPullRequest;

        pullRequest = await gitRestClient.createPullRequest(pullRequest, repositoryId, project.id);

        this.linkPullRequestToWorkItem(
            workItemTrackingRestClient,
            project.id,
            repositoryId,
            workItemId,
            pullRequest.pullRequestId,
        );

        console.log(`Pull Request ${pullRequestTitle} created in repository ${repository.name}`);

        globalMessagesSvc.addToast({
            duration: 3000,
            message: `Pull Request ${pullRequestTitle} created`,
        });
    }

    public async getPullRequestName(
        workItemTrackingRestClient: WorkItemTrackingRestClient,
        settingsDocument: SettingsDocument,
        workItemId: number,
        project: string,
    ): Promise<[string, string]> {
        const workItem = await workItemTrackingRestClient.getWorkItem(
            workItemId,
            project,
            undefined,
            undefined,
            WorkItemExpand.Fields,
        );

        let pullRequestNameTemplate = settingsDocument.defaultPullRequestNameTemplate;

        let splitTemplate = pullRequestNameTemplate.split("|", 2);
        let prefixTemplate = "";
        if (splitTemplate.length === 2) {
            prefixTemplate = splitTemplate[0];
            pullRequestNameTemplate = splitTemplate[1];
        } else {
            pullRequestNameTemplate = splitTemplate.join("");
        }

        const replaceTokens = (template: string): string => {
            const tokenizer = new Tokenizer();
            const tokens = tokenizer.getTokens(template);

            let result = template;
            tokens.forEach((token) => {
                let workItemFieldName = token.replace("${", "").replace("}", "");
                let workItemFieldValue = workItem.fields[workItemFieldName];

                result = result.replace(token, workItemFieldValue);
            });

            return result;
        };

        return [replaceTokens(prefixTemplate), replaceTokens(pullRequestNameTemplate)];
    }

    private async linkPullRequestToWorkItem(
        workItemTrackingRestClient: WorkItemTrackingRestClient,
        projectId: string,
        repositoryId: string,
        workItemId: number,
        pullRequestId: number,
    ) {
        const pullRequestRef = `${projectId}/${repositoryId}/${pullRequestId}`;
        const relation: WorkItemRelation = {
            rel: "ArtifactLink",
            url: `vstfs:///Git/PullRequestId/${encodeURIComponent(pullRequestRef)}`,
            attributes: {
                name: "Pull Request",
            },
        };

        const document: JsonPatchOperation[] = [
            {
                from: "",
                op: Operation.Add,
                path: "/relations/-",
                value: relation,
            },
        ];

        await workItemTrackingRestClient.updateWorkItem(document, workItemId);
    }

    private async getPRTemplate(
        gitRestClient: GitRestClient,
        repositoryId: string,
        projectId: string,
    ): Promise<string | undefined> {
        try {
            const response = await gitRestClient.getItem(
                repositoryId,
                "/.azuredevops/pull_request_template.md",
                projectId,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                true,
            );
            return response.content;
        } catch {
            return undefined;
        }
    }
}
