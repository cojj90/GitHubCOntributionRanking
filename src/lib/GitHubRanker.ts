import { GitHubGraphQLClient } from './GitHubGraphQLClient';
import { Utility } from './Utility';
import { ErrorConst } from './ErrorConst';
import { Observable } from 'rxjs/Rx';


/**
 * Class that does all the GitHub ranking logic
 */
export class GitHubRanker {
    private githubGraphQLClinet: GitHubGraphQLClient;
    private organisation: string;

    private repos: Object = {};
    private repoLastCursor: String;

    private contributions: Object = {};

    constructor(readonly GITHUB_ACCESS_KEY: string, organisation: string) {

        this.githubGraphQLClinet = new GitHubGraphQLClient(GITHUB_ACCESS_KEY);
        this.organisation = organisation;

    }

    getOrganisationContributionRank() {
        this.getRepos(this.organisation)
            .flatMap(() => this.formatContributorObs())
            .subscribe(
            () => {
                console.log("SUC");
            }, (err) => {
                console.log("ERR", err);
            }, () => {
                console.log(this.repos);
                console.log(this.contributions);
                console.log("DONE");
            }
            )
    }
    /**
     * Recursively fetch all github repos
     * @param organisation name of gitub organisation
     * @param cursor current pagnation location of GraphQL
     */
    private getRepos(organisation: string, cursor?): Observable<any> {
        let q = (typeof cursor === "undefined") ? `first: 100` : `first: 100, after:"${cursor}"`;
        let query = `
        {
        organization(login: "${organisation}") {
  	        repositories(${q}) {
                pageInfo{
                    hasNextPage
                    endCursor
                }
  	            edges {
                    cursor
  	                node {
                        name
  	                    id
  	                }
  	            }
  	        }
        }
        }`;

        return this.githubGraphQLClinet.query(query).flatMap(
            (suc) => {

                let { edges, pageInfo: { hasNextPage, endCursor } } = suc.data.data.organization.repositories;

                for (let edge of edges) {
                    //if something new
                    if (!this.repos[edge.node.id]) this.repos[edge.node.id] = { name: edge.node.name };
                }

                if (hasNextPage) {
                    return this.getRepos(organisation, endCursor);
                } else {
                    //Last Page
                    this.repoLastCursor = endCursor;
                    return Observable.of(true);
                }
            })
    }

    private getContribution(repoKey: string, cursor?): Observable<any> {
        let repo = this.repos[repoKey].name;
        let q = (typeof cursor === "undefined") ? `first: 100` : `first: 100, after:"${cursor}"`;
        let query = `
        {
        organization(login: "${this.organisation}") {
            repository(name: "${repo}") {
                ref(qualifiedName: "master"){
                    target {
                        ... on Commit {
                            id
                            message
                            history(${q}) {
                                pageInfo {
                                    endCursor
                                    hasNextPage
                                }
                                edges {
                                    cursor
                                    node {
                                        id
                                        oid
                                        author {
                                            name
                                            email
                                            date
                                            user {
                                                id
                                                name
                                                login
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        }`;

        return this.githubGraphQLClinet.query(query).retryWhen(
            (a) => {
                //TO DO: make conditional retries
                return a.delay(5000);
            }).flatMap(
            (suc) => {

                try {
                    let { edges, pageInfo: { hasNextPage, endCursor } } = suc.data.data.organization.repository.ref.target.history;

                    // if there's no update, don't do anything
                    if (endCursor === null) return Observable.of("no update");

                    for (let edge of edges) {
                        let { user, name } = edge.node.author;

                        //if user does not exist in the node, just track them with author.name
                        if (!user) {
                            user = { name: "NO USER", login: name };
                        }

                        //if new, make new obj with user and counter = 1, else inrement counter
                        if (!this.contributions[user.login]) {
                            this.contributions[user.login] = { ...user, count: 1 };
                        } else {
                            this.contributions[user.login].count++;
                        }
                    }

                    if (hasNextPage) {
                        return this.getContribution(repoKey, endCursor);
                    } else {
                        this.repos[repoKey].endCursor = endCursor;
                        return Observable.of(true);
                    }
                } catch (e) {
                    //malformed reponse?
                    throw ErrorConst.COMMIT_FETCH_MALFORMED;
                }
            })

    }

    private formatContributorObs(): Observable<any> {
        if (typeof this.organisation === "undefined") throw ErrorConst.UNSET_ORGANISATION;

        let obs$ = Observable.empty();

        for (let [key, value] of Utility.entries(this.repos)) {
            obs$ = ((typeof value.endCursor === "undefined")) ? obs$.merge(this.getContribution(key)) : obs$.merge(this.getContribution(key, value.endCursor));
        }
        return obs$;
    }
}