
import { EntityOrderBy, FindOptions, getEntityRef, Remult, Repository, Sort } from '../../index';
import { v4 as uuid } from 'uuid';
import { RestEntityDataProvider } from '../data-providers/rest-data-provider';
import { Action } from '../server-action';


class LiveQueryOnFrontEnd<entityType> {
    id: string;
    async setAllItems(result: any[]) {
        this.items = await Promise.all(result.map(item => this.repo.fromJson(item)));
        this.send();
    }
    send() {
        for (const l of this.listeners) {
            l(this.items);
        }
    }

    async handle(message: liveQueryMessage) {


        const sortAndSend = () => {

            if (this.query.orderBy) {
                const o = Sort.translateOrderByToSort(this.repo.metadata, this.query.orderBy);
                this.items.sort((a: any, b: any) => o.compare(a, b));
            }
            this.send();
        }

        switch (message.type) {
            case "all":
                this.setAllItems(message.data);
                break;
            case "replace": {
                const item = await this.repo.fromJson(message.data.item);
                this.items = this.items.map(x => this.repo.getEntityRef(x).getId() === message.data.oldId ? item : x);
                sortAndSend();
                break;
            }
            case "add":
                {
                    const item = await this.repo.fromJson(message.data);
                    this.items.push(item);
                    sortAndSend();
                    break;
                }
            case "remove":
                this.items = this.items.filter(x => getEntityRef(x).getId() !== message.data.id);
                this.send();
                break;
        };
    }

    items: entityType[] = [];
    listeners: ((items: entityType[]) => void)[] = [];
    constructor(private repo: Repository<entityType>, private query: SubscribeToQueryArgs<entityType>) { }

}


export interface LiveQueryProvider {
    openStreamAndReturnCloseFunction(clientId: string, onMessage: MessageHandler): VoidFunction;

}




export type MessageHandler = (message: { data: string, event: string }) => void;

export class LiveQueryClient {

    clientId = uuid();
    private queries = new Map<string, LiveQueryOnFrontEnd<any>>();
    constructor(public lqp: LiveQueryProvider) { }

    subscribe<entityType>(
        repo: Repository<entityType>,
        options: FindOptions<entityType>,
        onResult: (items: entityType[]) => void) {
        const m: SubscribeToQueryArgs = { entityKey: repo.metadata.key, orderBy: options.orderBy };
        const eventTypeKey = JSON.stringify(m);
        let q = this.queries.get(eventTypeKey);
        if (!q) {
            if ([...this.queries.keys()].length == 0)
                this.openListener();
            this.queries.set(eventTypeKey, q = new LiveQueryOnFrontEnd(repo, m))


            const { url, filterObject } = new RestEntityDataProvider(Remult.apiBaseUrl + '/' + repo.metadata.key, Action.provider, repo.metadata)
                .buildFindRequest({});
            url.add("__action", 'subscribe|' + this.clientId);
            const thenResult = (r: SubscribeResult) => {
                q.setAllItems(r.result);
                q.id = r.id;
            }
            if (filterObject) {
                Action.provider.post(url.url, filterObject).then(thenResult);
            }
            else
                Action.provider.get(url.url).then(thenResult);

        }
        else {
            onResult(q.items);
        }
        q.listeners.push(onResult);
        return () => {
            q.listeners.splice(q.listeners.indexOf(onResult), 1);
            if (q.listeners.length == 0) {
                this.queries.delete(eventTypeKey);
            }
        }

    }
    closeListener: VoidFunction = () => { };

    private openListener() {
        this.closeListener = this.lqp.openStreamAndReturnCloseFunction(this.clientId, message => {
            for (const q of this.queries.values()) {
                if (q.id === message.event) {
                    q.handle(JSON.parse(message.data));
                }
            }
        });
    }
}
export type listener = (message: any) => void;



export interface SubscribeToQueryArgs<entityType = any> {
    entityKey: string,
    orderBy?: EntityOrderBy<entityType>
}
export declare type liveQueryMessage = {
    type: "all",
    data: any[]
} | {
    type: "add"
    data: any
} | {
    type: 'replace',
    data: {
        oldId: any,
        item: any
    }
} | {
    type: "remove",
    data: { id: any }
}

export interface SubscribeResult {
    result: [],
    id: string
}
