
import { AbstractGraphQLClient } from './AbstractGraphQLClient';

export class GitHubGraphQLClient extends AbstractGraphQLClient {
    static readonly GITHUB_API_URL = "https://api.github.com/graphql";
    protected authToken: string;


    constructor(authToken: string) {
        super(GitHubGraphQLClient.GITHUB_API_URL);
        this.headerInit(authToken);
    }

    /**
     * Sets auth token to the http request header
     * @param authToken GitHub authToken
     */
    protected headerInit(authToken: string) {
        this.authToken = `bearer ${authToken}`;
        this.request.defaults.headers.common['Authorization'] = this.authToken;
    }

}