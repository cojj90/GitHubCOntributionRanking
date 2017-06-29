import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { GraphQLSchema } from 'graphql'; 
import { Observable, Subscriber } from 'rxjs/Rx';

/**
 * BaseClass for GraphQL Client
 */
export abstract class AbstractGraphQLClient {
  
  protected request: AxiosInstance;
  protected schema: GraphQLSchema;
  protected ast: any;

  constructor(
    serverURL: string
  ) {
    this.request = axios.create({ baseURL: serverURL });
  }

  /**
   * Sends query to GraphQL
   * 
   * @param query GraphQL query
   * @return Observable of the call
   */
  query(query: string): Observable<AxiosResponse> {

    return Observable.create((observer: Subscriber<any>) => {
      this.request.post(undefined, { "query": query }).then(
        (resp) => {
          observer.next(resp);
          observer.complete();
        }, (err) => {
          observer.error(err);
        }
      )
    });
  }

  mutation() {
    //TO DO: Add Common Mutation call
  }

}
