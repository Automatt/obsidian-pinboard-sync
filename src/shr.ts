// Simple HTTPS Request library
// Convenience functions for dealing with Node's HTTPS requests

import http = require('http');
import https = require('https');

import debug = require('debug');
let debugLog = debug('shr');

export type RequestOptionsQueryParameters = {
    name: string,
    value: string,
    noEncodeName?: boolean,
    noEncodeValue?: boolean
}
export class RequestOptionsQuery {
    public value: string;
    public name: string;
    constructor(params: RequestOptionsQueryParameters) {
        this.name  = params.noEncodeName  ? params.name  : encodeURIComponent(params.name);
        this.value = params.noEncodeValue ? params.value : encodeURIComponent(params.value);
    }
    public clone(): RequestOptionsQuery {
        return new RequestOptionsQuery({
            name: this.name,
            value: this.value,
            noEncodeName: true,
            noEncodeValue: true
        });
    }
}

export type RequestOptionsParameters = {
    host: string,
    basePath: string[],
    queryParams?: RequestOptionsQuery[],
    protocol?: string,
    port?: number,
    parseJson?: boolean,
    method?: string,
    postData?: string
}

type RequestOptionsCloneParameters = {
    subPath?: string[],
    appendQueryParams?: RequestOptionsQuery[]
}

/* A class that can be passed to httpRequest()
 * Note that it is also passable directly to node's https.request()
 */
export class RequestOptions {
    // The following properties are assembled into the .path computed property
    public host: string;
    public basePath: string[];
    public protocol: string;
    public port: number;
    public queryParams: RequestOptionsQuery[];

    // Remaining properties are not included in the .path computed property
    public parseJson: boolean;
    public method: string;
    public postData?: string;

    constructor(params: RequestOptionsParameters) {
        this.host        = params.host;
        this.basePath    = params.basePath;
        this.protocol    = typeof params.protocol    !== 'undefined' ? params.protocol    : "https:";
        this.port        = typeof params.port        !== 'undefined' ? params.port        : 443;
        this.parseJson   = typeof params.parseJson   !== 'undefined' ? params.parseJson   : false;
        this.queryParams = typeof params.queryParams !== 'undefined' ? params.queryParams : [];
        this.method      = typeof params.method      !== 'undefined' ? params.method      : 'GET';
        this.postData    = typeof params.postData    !== 'undefined' ? params.postData    : '';
    }

    public get path(): string {
        return `/${this.basePath.join('/')}${this.urlParametersString}`;
    }

    public get urlParametersString(): string {
        let uas = "";
        this.queryParams.forEach((parameter) => {
            if (uas.length === 0) { uas += '?'; } else { uas += '&'; }
            uas += `${parameter.name}=${parameter.value}`;
        });
        return uas;
    }

    public get fullUrl(): string {
        return `${this.protocol}//${this.host}:${this.port}${this.path}`;
    }

    public clone(cloneParams?: RequestOptionsCloneParameters): RequestOptions {
        let ro = new RequestOptions({
            host: this.host,
            basePath: [],
            protocol: this.protocol,
            port: this.port,
            parseJson: this.parseJson,
            queryParams: [],
            method: this.method,
            postData: this.postData
        })
        this.basePath.forEach(bp => ro.basePath.push(bp));
        this.queryParams.forEach(qp => ro.queryParams.push(qp.clone()));
        if (cloneParams && cloneParams.subPath) {
            cloneParams.subPath.forEach(sp => ro.basePath.push(sp));
        }
        if (cloneParams && cloneParams.appendQueryParams) {
            cloneParams.appendQueryParams.forEach(aqp => ro.queryParams.push(aqp.clone()));
        }
        return ro;
    }

    public equals(opts: RequestOptions): boolean {
        return this.path   === opts.path &&
            this.parseJson === opts.parseJson &&
            this.method    === opts.method &&
            this.postData  === opts.postData;
    }

    // Turns out, having path be a computed property in TypeScript doesn't work for https.request()
    public get nodeRequestOpts(): object {
        return {
            host: this.host,
            path: this.path,
            protocol: this.protocol,
            port: this.port,
            method: this.method
        }
    }
}

export interface SimpleHttpsRequest {
    req(options: RequestOptions): Promise<any>;
}

export class HttpsRequest implements SimpleHttpsRequest {
    public req(options: RequestOptions): Promise<any> {
        debugLog(`${options.method} ${options.fullUrl}`);
        return new Promise<any>((resolve, reject) => {
            let rejecting = false;
            let ro = options.nodeRequestOpts;
            let body: Buffer[] = [];

            let req: http.ClientRequest;

            if (options.protocol === "https:") {
                req = https.request(ro);
            } else if (options.protocol === "http:") {
                req = http.request(ro);
            } else {
                throw new Error(`Unknown protocol ${options.protocol}`);
            }

            req.on('response', (response: http.IncomingMessage) => {
                if (response.statusCode) {
                    if (response.statusCode < 200 || response.statusCode >= 300) { rejecting = true; }
                } else {
                    debugLog("Got a response from the webserver that has no .statusCode property");
                }

                response.on('data', (chunk: Buffer) => body.push(chunk));

                response.on('end', () => {
                    let entireBody = Buffer.concat(body).toString();
                    let error: Error | undefined;
                    let resolution: any;
                    resolution = entireBody;

                    if (rejecting) {
                        error = new Error(`ERROR ${response.statusCode} when attempting to ${options.method} '${options.fullUrl}'\r\n${entireBody}`);
                    }
                    else if (options.parseJson) {
                        try {
                            resolution = JSON.parse(entireBody);
                        } catch (exception) {
                            error = new Error(`JSON Parse error: ${exception} when receiving code ${response.statusCode} after performing ${options.method} on '${options.fullUrl}' and attempting to parse body:\r\n${entireBody}`)
                        }
                    }

                    if (error) {
                        reject(error);
                    } else {
                        resolve(resolution);
                    }
                });
            });

            req.on('error', (err) => reject(err));

            if (options.postData) { req.write(options.postData); }

            req.end();
        });
    }
}
