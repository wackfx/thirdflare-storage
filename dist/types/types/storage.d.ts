import type { GatewayUrls, IStorageDownloader } from "./download";
import type { IStorageUploader, UploadOptions } from "./upload";
export declare type ThirdwebStorageOptions<T extends UploadOptions> = {
    uploader?: IStorageUploader<T>;
    downloader?: IStorageDownloader;
    gatewayUrls?: GatewayUrls | string[];
};
