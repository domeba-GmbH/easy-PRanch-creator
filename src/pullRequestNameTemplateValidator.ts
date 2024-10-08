import { Tokenizer } from "./tokenizer";

interface IValidatePullRequestNameTemplateResult {
    isValid: boolean;
    errorMessages: string[];
}

export class PullRequestNameTemplateValidator {
    public validatePullRequestNameTemplate(
        pullRequestNameTemplate: string,
        workItemFieldNames: string[]
    ): IValidatePullRequestNameTemplateResult {
        const tokenizer = new Tokenizer();

        if (!tokenizer.isValid(pullRequestNameTemplate)) {
            return {
                isValid: false,
                errorMessages: ["The template is invalid."],
            };
        }

        const tokens = tokenizer.getTokens(pullRequestNameTemplate);
        const numberOfStartTokens = (pullRequestNameTemplate.match(/\${/g) || []).length;
        const numberOfEndTokens = (pullRequestNameTemplate.match(/\}/g) || []).length;
        if (tokens.length !== numberOfStartTokens || numberOfStartTokens !== numberOfEndTokens) {
            return {
                isValid: false,
                errorMessages: ["The number of opening '${' and closing '}' tokens should be equal."],
            };
        }

        const unknownFields = this.getUnknownFields(tokens, workItemFieldNames);
        if (unknownFields.length > 0) {
            return {
                isValid: false,
                errorMessages: unknownFields.map((x) => `WorkItem field '${x}' does not exists.`),
            };
        }

        return { isValid: true, errorMessages: [] };
    }

    private getUnknownFields(tokens: string[], workItemFieldNames: string[]): string[] {
        const allFieldNames = Object.assign([], workItemFieldNames);
        const fieldNames = tokens.map((token) => token.replace("${", "").replace("}", ""));
        return fieldNames.filter((x) => allFieldNames.indexOf(x) === -1);
    }
}
