import SettingsDocument from "./settingsDocument";

export class Constants {
    public static DefaultBranchNameTemplate: string = "feature/${System.Id}-${System.Title}";
    public static DefaultPullRequestNameTemplate: string = "[${System.WorkItemType} ${System.Id}] ${System.Title}";

    public static DefaultSettingsDocument: SettingsDocument = {
        defaultBranchNameTemplate: Constants.DefaultBranchNameTemplate,
        branchNameTemplates: {},
        nonAlphanumericCharactersReplacement: "_",
        lowercaseBranchName: false,
        id: "",
        updateWorkItemState: false,
        workItemState: {},
        defaultPullRequestNameTemplate: Constants.DefaultPullRequestNameTemplate,
        createPullRequestByDefault: false,
        createPullRequestsAsDrafts: false,
        defaultRepositoryName: "",
    };

    public static NonAlphanumericCharactersReplacementSelectionOptions = [
        { id: "_", text: "_" },
        { id: "-", text: "-" },
    ];
}
