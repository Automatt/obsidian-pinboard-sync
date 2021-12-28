import debug = require('debug');
let debugLog = debug('pbsdk');

import { RequestOptions, RequestOptionsQuery, SimpleHttpsRequest, HttpsRequest } from "./shr";

export class PinboardData {
    public static boolean(input: string | number): boolean {
        if (input === 'yes' || input === 'true' || input === 1) {
            return true;
        } else if (input === 'no' || input === 'false' || input === 0) {
            return false;
        } else {
            throw `Unable to parse '${input}'`
        }
    }
    public static dateFormatter(date: Date): string {
        return date.toISOString();
    }
}

export class PinboardTag {
    public count: number;
    constructor(public name: string, count?: number) {
        if (count) { this.count = count; }
    }
}

export class PinboardPost {
    constructor(
        public href: string,
        public description: string,
        public extended: string,
        public meta: string,
        public hash: string,
        public time: Date,
        public shared: boolean,
        public toread: boolean,
        public tags: PinboardTag[] = []
    ) {}
    static fromObj(opts: any): PinboardPost {
        let post = new PinboardPost(
            opts.href,
            opts.description,
            opts.extended,
            opts.meta,
            opts.hash,
            new Date(opts.time),
            PinboardData.boolean(opts.shared),
            PinboardData.boolean(opts.toread))
        opts.tags.split(' ').forEach((tagName: string) => post.tags.push(new PinboardTag(tagName)));
        return post;
    }

    public uiString(): string {
        let tagNames: string[] = [];
        this.tags.forEach(t => tagNames.push(t.name));

        let ret = "";
        ret += `----------------\n`
        ret += this.description ? `${this.description}\n` : "UNTITLED BOOKMARK\n";
        ret += `<${this.href}>\n`;
        ret += this.extended ? `${this.extended}\n` : "";
        ret += `bookmarked: ${PinboardData.dateFormatter(this.time)}\n`;
        ret += `public: ${this.shared}, toread: ${this.toread}\n`;
        ret += `tags: ${tagNames.join(' ')}\n`;
        ret += `----------------\n`

        return ret;
    }
}

export class PinboardPostCollection {
    constructor(
        public date: Date,
        public user: string,
        public posts: PinboardPost[] = []
    ) {}

    public uiString(): string {
        let ret = `PinboardPostCollection for user ${this.user} on ${PinboardData.dateFormatter(this.date)}\n`;
        ret += `================\n\n`
        this.posts.forEach(p => ret += `${p.uiString()}\n`);
        ret += `================\n`
        return ret;
    }

    public static fromHttpResponse(response: any): PinboardPostCollection {
        let collection = new PinboardPostCollection(new Date(response.date), response.user);
        response.posts.forEach((postObj: any) => collection.posts.push(PinboardPost.fromObj(postObj)));
        debugLog(`Got a PostCollection with ${collection.posts.length} posts`);
        return collection;
    }
}

export class PinboardNote {
    constructor(
        public id: string,
        public title: string,
        public createDate: Date,
        public updateDate: Date,
        public hash: string,
        public text?: string
    ) {}
    public static fromHttpResponse(
        response: any,
    ): PinboardNote {
        let note = new PinboardNote(
            response.id,
            response.title,
            new Date(response.created_at),
            new Date(response.updated_at),
            response.text ? response.text : "",
            response.hash,
        );
        return note;
    }
}

export class PinboardNotePost {
    constructor(
        public note: PinboardNote,
        public post: PinboardPost
    ) {}

    public uiString(): string {
        let tagNames: string[] = [];
        this.post.tags.forEach(t => tagNames.push(t.name));

        let ret = "";
        ret += `----------------\n`
        ret += `Note: ${this.note.title} (id ${this.note.id}\n`
        ret += `${this.note.text}\n`
        ret += `added: ${PinboardData.dateFormatter(this.note.createDate)} `;
        ret += `updated: ${PinboardData.dateFormatter(this.note.updateDate)}\n`;
        ret += `public: ${this.post.shared}`
        ret += `tags: ${tagNames.join(' ')}\n`;
        ret += `----------------\n`

        return ret;
    }
}

export class PinboardPostsEndpoint {
    public noun = "posts";
    public urlOpts: RequestOptions;
    constructor(
        baseUrlOpts: RequestOptions,
        private request: SimpleHttpsRequest = new HttpsRequest()
    ) {
        this.urlOpts = baseUrlOpts.clone({subPath: [this.noun]});
    }

    public update(): Promise<Date> {
        let opts = this.urlOpts.clone({subPath: ['update']});
        return this.request.req(opts).then(result => {
            debugLog(`Last update time: ${result.update_time}`);
            return new Date(result.update_time);
        });
    }

    public get(tag: string[] = [], date?: Date, url?: string, meta: Boolean = false): Promise<PinboardPostCollection> {
        if (tag.length > 3) {
            throw "Only three tags are supported for this request";
        }
        let opts = this.urlOpts.clone({subPath: ['get']});
        tag.forEach((t) => { opts.queryParams.push(new RequestOptionsQuery({name: 'tag', value: t})); });
        if (date) { opts.queryParams.push(new RequestOptionsQuery({name: 'dt', value: PinboardData.dateFormatter(date)})); }
        if (url) { opts.queryParams.push(new RequestOptionsQuery({name: 'url', value: url})); }
        opts.queryParams.push(new RequestOptionsQuery({name: 'meta', value: meta ? "yes" : "no"}));

        return this.request.req(opts)
            .then(result => PinboardPostCollection.fromHttpResponse(result));
    }

    public recent(tag: string[] = [], count?: number): Promise<PinboardPostCollection> {
        if (tag.length > 3) {
            throw "Only three tags are supported for this request";
        }
        if (typeof count !== 'undefined' && (count > 100 || count < 0)) {
            throw `Invalid value for 'count': '${count}'. Must be between 0-100.`
        }
        let opts = this.urlOpts.clone({subPath: ['recent']});
        tag.forEach((t) => { opts.queryParams.push(new RequestOptionsQuery({name: 'tag', value: t})); });
        if (count) {
            opts.queryParams.push(new RequestOptionsQuery({name: 'count', value: String(count)}));
        }
        return this.request.req(opts)
            .then(result => PinboardPostCollection.fromHttpResponse(result));
    }
}

export class PinboardTagsEndpoint {
    public noun = "tags";
    public urlOpts: RequestOptions;
    constructor(baseUrlOpts: RequestOptions, private request: SimpleHttpsRequest = new HttpsRequest()) {
        this.urlOpts = baseUrlOpts.clone({subPath: [this.noun]});
    }

    public get(): Promise<PinboardTag[]> {
        let opts = this.urlOpts.clone({subPath: ['get']});
        return this.request.req(opts).then(tagObj => {
            let tags: PinboardTag[] = [];
            for (let tagName in tagObj) {
                tags.push(new PinboardTag(tagName, tagObj[tagName]));
            }
            debugLog(`Got ${tags.length} tags`);
            return tags;
        });
    }

    public rename(oldName: string, newName: string): Promise<any> {
        let opts = this.urlOpts.clone({subPath: ['rename']});
        opts.queryParams.push(new RequestOptionsQuery({name: 'old', value: oldName}));
        opts.queryParams.push(new RequestOptionsQuery({name: 'new', value: newName}));
        return this.request.req(opts).then(result => {
            debugLog(`Got result: ${result}`);
            return result;
        });
    }
}

export class PinboardNotesEndpoint {
    public noun = "notes";
    public urlOpts: RequestOptions;
    constructor(
        baseUrlOpts: RequestOptions,
        private request: SimpleHttpsRequest = new HttpsRequest()
    ) {
        this.urlOpts = baseUrlOpts.clone({subPath: [this.noun]});
    }

    // This endpoint does not return note text! Only metadata. However, PinboardNotePostsVirtualEndpoint.list() will make a new API call to get the whole note.
    public list(): Promise<PinboardNote[]> {
        let opts = this.urlOpts.clone({subPath: ['list']});
        return this.request.req(opts).then(response => {
            let notes: PinboardNote[] = [];
            response.notes.forEach((n: any) => notes.push(PinboardNote.fromHttpResponse(n)));
            return notes;
        });
    }

    public get(noteid: string): Promise<PinboardNote> {
        if (noteid.length < 1) {
            throw "An empty string is an invalid noteid."
        }
        let opts = this.urlOpts.clone({subPath: [noteid]});
        return this.request.req(opts).then(response => PinboardNote.fromHttpResponse(response));
    }
}

/* Virtual endpoint for PinboardNotePost objects
 * There is no single endpoint for this in the API - we have to make two API calls in order to get this information
 * N.B.: Pinboard has separate concepts for "note" and a "post", but the concepts are conflated in the UI
 * In the UI, it looks like you can create a new post with tags
 * What actually happens: you create a new note that has properties like title, ID, and text,
 * ... as well as a URL to https://notes.pinboard.in/u:USERNAME/NOTEID
 * And then it automatically creates a "post" (bookmark) to that URL with the tags attached
 * So retrieving the full text and metadata of a note, plus its tags, requires two HTTP requests:
 * 1) to the /notes/get?id=NOTEID or /notes/list endpoint, to retrieve the note metadata
 * 2) to the /posts/get?url=NOTEURL endpoint, to retrieve the post metadata like tags
 */
export class PinboardNotePostsVirtualEndpoint {
    constructor(
        private notesEndpoint: PinboardNotesEndpoint,
        private postsEndpoint: PinboardPostsEndpoint,
        private notesUrlOpts: RequestOptions
    ) {}

    private postFromNote(note: PinboardNote): Promise<PinboardNotePost> {
        let noteUrl = this.notesUrlOpts.clone({subPath: [note.id]}).fullUrl;
        return this.postsEndpoint.get(undefined, undefined, noteUrl).then(collection => {
            if (collection.posts.length != 1) {
                throw `Expected to find bookmark for URL ${noteUrl}, but found ${collection.posts.length} instead.`;
            }
            let notePost = new PinboardNotePost(note, collection.posts[0]);
            return notePost;
        });
    }

    public list(): Promise<PinboardNotePost[]> {
        return this.notesEndpoint.list().then(noteMetadataList => {
            let notePosts: Promise<PinboardNotePost>[] = [];
            // We do a .get(id) for each note, because this.notesEndpoint.list() returns note metadata without the .text property
            noteMetadataList.forEach(noteMetadata => notePosts.push(this.get(noteMetadata.id)));
            return Promise.all(notePosts);
        });
    }

    public get(noteid: string): Promise<PinboardNotePost> {
        return this.notesEndpoint.get(noteid).then(note => this.postFromNote(note));
    }
}

class PinboardApiToken {
    public static separator: string = ':';
    constructor(
        public user: string,
        public secret: string
    ) {
        if (user.length < 1 || secret.length < 1) {
            throw "Invalid API token string";
        }
    }
    public toString() {
        return `${this.user}${PinboardApiToken.separator}${this.secret}`
    }
    public static fromString(inputString: string): PinboardApiToken {
        const split = inputString.split(this.separator);
        let [user, secret] = split;
        if (split.length != 2) {
            throw "Invalid API token string";
        }
        return new PinboardApiToken(user, secret);
    }
}

export class Pinboard {
    public posts: PinboardPostsEndpoint;
    public tags: PinboardTagsEndpoint;
    public notePosts: PinboardNotePostsVirtualEndpoint;
    public notes: PinboardNotesEndpoint;
    public apiToken: PinboardApiToken;
    public tokenSecret: string;

    constructor(
        apiToken: string,
        public baseUrlOpts = new RequestOptions({host: 'api.pinboard.in', basePath: ['v1']}),
        public notesUrlOpts = new RequestOptions({host: 'notes.pinboard.in', basePath: []})
    ) {
        this.apiToken = PinboardApiToken.fromString(apiToken);

        this.baseUrlOpts.queryParams.push(
            new RequestOptionsQuery({name: 'auth_token', value: this.apiToken.toString(), noEncodeValue: true}),
            new RequestOptionsQuery({name: 'format', value: 'json'})
        );
        this.baseUrlOpts.parseJson = true;

        this.notesUrlOpts.basePath.push(`u:${this.apiToken.user}`)

        this.posts = new PinboardPostsEndpoint(this.baseUrlOpts);
        this.tags = new PinboardTagsEndpoint(this.baseUrlOpts);
        this.notes = new PinboardNotesEndpoint(this.baseUrlOpts);
        this.notePosts = new PinboardNotePostsVirtualEndpoint(this.notes, this.posts, this.notesUrlOpts);

        debugLog(`Pinboard object for user ${this.apiToken.user} set up`);
    }
}
