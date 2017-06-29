import {GitHubRanker} from './lib/GitHubRanker';

const token = "9628af7d1698d1f887d40727e57447103e61d57b";
const org = "mishguruorg";

let gitRanker = new GitHubRanker(token, org);
gitRanker.getOrganisationContributionRank();