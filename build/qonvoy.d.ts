export interface Config {
    redisConnectionString: string;
    retention?: number;
}
export interface Item {
    id: string;
    created: number;
    queue: string;
    attempts: number;
    success: boolean;
    error: string;
    meta: any;
}
export declare function init(c: Config): void;
export declare function add(queue: string, meta: any): Promise<any>;
export declare function status(queue: string, id: string): Promise<Item>;
export declare function processNext(queue: string, func: (item: Item) => Promise<boolean>): Promise<boolean>;
export declare function processOne(queue: string, id: string, func: (item: any) => Promise<boolean>): Promise<boolean>;
export declare function reQueue(queue: string, minAge: number): Promise<boolean>;
export declare function retry(queue: string, id: string): Promise<boolean>;
