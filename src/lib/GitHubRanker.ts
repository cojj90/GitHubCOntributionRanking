import {GitHubGraphQLClient} from './GitHubGraphQLClient';
import { Observable } from 'rxjs/Rx';

/**
 * Class that does all the GitHub ranking logic
 */
export class GitHubRanker {
    private githubGraphQLClinet: GitHubGraphQLClient; 
    
    private repos: Object = {};
    private repoLastCursor: String;

    constructor(readonly GITHUB_ACCESS_KEY: string) {

        this.githubGraphQLClinet = new GitHubGraphQLClient(GITHUB_ACCESS_KEY);
        this.getRepos("mishguruorg").subscribe(
            ()=>{
                console.log("SUC");
            },()=>{
                console.log("ERR");
            },()=>{
                console.log(this.repos);
                console.log("DONE");
            }
        )

    }

    /**
     * Recursively fetch all github repos
     * @param organisation name of gitub organisation
     * @param cursor current pagnation location of GraphQL
     */
    getRepos(organisation: string, cursor?): Observable<any> {
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
}