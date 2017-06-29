import { GitHubGraphQLClient } from './GitHubGraphQLClient';
import { Utility } from './Utility';
import { ErrorConst } from './ErrorConst';
import { Observable } from 'rxjs/Rx';
import * as _ from 'lodash';


/**
 * Class that does all the GitHub ranking logic
 */
export class GitHubRanker {
    private githubGraphQLClinet: GitHubGraphQLClient;
    private organisation: string;

    private repos: Object = {};
    private repoLastCursor: String;

    private contributions: any = {}; //typeing error with lodash...

    constructor(readonly GITHUB_ACCESS_KEY: string, organisation: string) {
        if(_.isEmpty(GITHUB_ACCESS_KEY) || _.isEmpty(organisation)){
            console.log("Please feed me a GitHub Token and Organisation name");
            return;
        } 
        this.githubGraphQLClinet = new GitHubGraphQLClient(GITHUB_ACCESS_KEY);
        this.organisation = organisation;

    }

    /**
     * Mother function to fetch/calculate contribution ranking
     */
    public getOrganisationContributionRank() {
        if(_.isEmpty(this.organisation)) return;
        this.getRepos()
            .flatMap(() => this.formatContributorObs())
            .subscribe(
            () => {
                //console.log("SUC");
            }, (err) => {
                console.log("ERR", err);
            }, () => {
                this.contributions = _.sortBy(this.contributions, [o => -o.count, o => o.name]);
                //console.log(this.repos);
                console.log(this.contributions);
                console.log("DONE: ", this.countCommits());
            }
            )
    }

    /**
     * Recursively fetch all github repos
     * @param cursor current pagnation location of GraphQL
     */
    private getRepos(cursor?): Observable<any> {
        if (typeof this.organisation === "undefined") throw ErrorConst.UNSET_ORGANISATION;

        let selector = (typeof cursor === "undefined") ? `first: 100` : `first: 100, after:"${cursor}"`;
        let query = `
        {
        organization(login: "${this.organisation}") {
  	        repositories(${selector}) {
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
                    return this.getRepos(endCursor);
                } else {
                    //Last Page
                    this.repoLastCursor = endCursor;
                    return Observable.of(true);
                }
            })
    }

    /**
     * 
     * @param repoKey id of the repo
     * @param cursor current pagnation location of GraphQL
     */
    private getContribution(repoKey: string, cursor?): Observable<any> {
        if (typeof this.organisation === "undefined") throw ErrorConst.UNSET_ORGANISATION;

        let repo = this.repos[repoKey].name;
        let selector = (typeof cursor === "undefined") ? `first: 100` : `first: 100, after:"${cursor}"`;
        let query = `
        {
        organization(login: "${this.organisation}") {
            repository(name: "${repo}") {
                ref(qualifiedName: "master"){
                    target {
                        ... on Commit {
                            id
                            message
                            history(${selector}) {
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

    /**
     * Iterate through repos object and contruct observable that fetches repo commits in parallel
     */
    private formatContributorObs(): Observable<any> {
        if (typeof this.organisation === "undefined") throw ErrorConst.UNSET_ORGANISATION;

        let obs$ = Observable.empty();

        for (let [key, value] of Utility.entries(this.repos)) {
            obs$ = ((typeof value.endCursor === "undefined")) ? obs$.merge(this.getContribution(key)) : obs$.merge(this.getContribution(key, value.endCursor));
        }
        return obs$;
    }

    /**
     * Helper function to calculate #commits
     */
    private countCommits(): number {

        let total = 0;
        for (let [key, value] of Utility.entries(this.contributions)) {
            total += value.count;
        }

        return total;
    }
}