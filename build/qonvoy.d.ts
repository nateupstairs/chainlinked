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
/**
 * Initialize Qonvoy
 * @param c
 */
export declare function init(c: Config): void;
/**
 * Get Client
 * returns redis client that powers Qonvoy
 */
export declare function getClient(): any;
/**
 * Get Timestamp
 * @param seconds
 */
export declare function getTimestamp(seconds?: number): number;
/**
 * Modify Timestamp
 * modifies a timestamp value by x seconds
 * @param timestamp
 * @param seconds
 */
export declare function modifyTimestamp(timestamp: number, seconds?: number): number;
/**
 * Add
 * adds a task to named queue
 * @param queue
 * @param meta
 */
export declare function add(queue: string, meta: any): Promise<any>;
/**
 * Status
 * returns status of job by id
 * @param queue
 * @param id
 */
export declare function status(queue: string, id: string): Promise<Item>;
/**
 * Process Next
 * processes next task from named queue
 * @param queue
 * @param func
 */
export declare function processNext(queue: string, func: (item: Item) => Promise<boolean>): Promise<boolean>;
/**
 * Process One
 * process task by id from named queue
 * @param queue
 * @param id
 * @param func
 */
export declare function processOne(queue: string, id: string, func: (item: any) => Promise<boolean>): Promise<boolean>;
/**
 * Re-Queue
 * moves any stuck jobs from the processing queue back to pending
 * @param queue
 * @param minAge
 */
export declare function reQueue(queue: string, minAge?: number): Promise<boolean>;
/**
 * Count Successes
 * returns number of current successes from named queue
 * @param queue
 */
export declare function countSuccesses(queue: string): Promise<any>;
/**
 * Count Errors
 * returns number of current errors from named queue
 * @param queue
 */
export declare function countErrors(queue: string): Promise<any>;
/**
 * Report Successes
 * returns success log from named queue
 * @param queue
 * @param minAge
 */
export declare function reportSuccesses(queue: string, minAge?: number): Promise<any>;
/**
 * Report Errors
 * returns error log from named queue
 * @param queue
 * @param minAge
 */
export declare function reportErrors(queue: string, minAge?: number): Promise<any>;
/**
 * Clear Successes
 * clears success log from named queue
 * @param queue
 * @param minAge
 */
export declare function clearSuccesses(queue: string, minAge?: number): Promise<any>;
/**
 * Clear Errors
 * clears error log from the named queue
 * @param queue
 * @param minAge
 */
export declare function clearErrors(queue: string, minAge?: number): Promise<any>;
/**
 * Destroy
 * manually destroy a task by id
 * @param queue
 * @param id
 */
export declare function destroy(queue: string, id: string): Promise<boolean>;
/**
 * Retry
 * moves a task from the error log to the queue
 * @param queue
 * @param id
 */
export declare function retry(queue: string, id: string): Promise<boolean>;
