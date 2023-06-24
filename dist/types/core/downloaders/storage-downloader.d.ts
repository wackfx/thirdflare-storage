import type { GatewayUrls, IStorageDownloader } from "../../types/download";
/**
 * Default downloader used - handles downloading from all schemes specified in the gateway URLs configuration.
 *
 * @example
 * ```jsx
 * // Can instantiate the downloader with the default gateway URLs
 * const downloader = new StorageDownloader();
 * const storage = new ThirdwebStorage({ downloader });
 * ```
 *
 * @public
 */
export declare class StorageDownloader implements IStorageDownloader {
    download(uri: string, gatewayUrls: GatewayUrls, attempts?: number): Promise<Response>;
}
