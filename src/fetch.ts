import {
    PotionBase,
    PotionOptions,
    PotionResponse,
    RequestOptions
} from './core/potion';


export * from './core/index';


export class Potion extends PotionBase {
    constructor(options?: PotionOptions) {
        super({...options});
    }

    // Use window.fetch for making requests,
    // see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
    // Polyfill at https://github.com/github/fetch.
    // let {method, data, cache} = Object.assign({method: 'GET', cache: true}, options);
    // tslint:disable-next-line: prefer-function-over-method
    protected request(uri: string, options?: RequestOptions): Promise<PotionResponse> {
        const {method = 'GET', params, body, cache = true}: RequestOptions = {...options};
        const headers: Headers = new Headers();
        const init: any = {
            method,
            cache: cache ? 'default' : 'no-cache',
            // Make sure cookies are sent
            // https://github.com/github/fetch#sending-cookies
            credentials: 'include'
        };

        if (body) {
            // POST/PUT/PATCH needs headers and JSON body,
            // see https://github.com/github/fetch#post-json for more info.
            headers.set('Accept', 'application/json');
            headers.set('Content-Type', 'application/json');
            init.body = JSON.stringify(body);
        }

        Object.assign(init, {headers});

        // TODO: when URL will be supported we will switch to it
        if (params) {
            let count = 1;
            const entries = Object.entries(params);
            const size = entries.length;
            for (const [key, value] of entries) {
                if (count === 1) {
                    uri += '?';
                }
                uri += `${key}=${value}`;
                if (count < size) {
                    uri += '&';
                }
                count++;
            }
        }

        return fetch(new Request(uri, init), init).then(response => {
            if (response.ok) {
                const headers: {[key: string]: any} = {};
                if (response.headers) {
                    response.headers.forEach((value, key) => {
                        headers[key] = value;
                    });
                }

                return response.json()
                    .then(json => ({headers, body: json}), error => error) as Promise<PotionResponse>;
            } else {
                const error: any = new Error(response.statusText);
                Object.assign(error, {response});
                throw error;
            }
        });
    }
}
