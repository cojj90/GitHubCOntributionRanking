import {GitHubRanker} from './lib/GitHubRanker';

const token = ""; // enter toekn here
const org = ""; // enter org here

let gitRanker = new GitHubRanker(token, org);
gitRanker.getOrganisationContributionRank();