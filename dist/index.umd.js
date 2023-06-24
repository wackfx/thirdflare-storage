(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ipfs-unixfs-importer')) :
    typeof define === 'function' && define.amd ? define(['exports', 'ipfs-unixfs-importer'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.genMapping = {}, global.ipfsUnixfsImporter));
})(this, (function (exports, ipfsUnixfsImporter) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __asyncValues(o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    }

    /**
     * @internal
     */
    const DEFAULT_GATEWAY_URLS = {
        // Note: Gateway URLs should have trailing slashes (we clean this on user input)
        "ipfs://": [
            "https://ipfs-2.thirdwebcdn.com/ipfs/",
            "https://ipfs-3.thirdwebcdn.com/ipfs/",
            "https://ipfs-4.thirdwebcdn.com/ipfs/",
            "https://ipfs-5.thirdwebcdn.com/ipfs/",
            "https://cloudflare-ipfs.com/ipfs/",
            "https://ipfs.io/ipfs/",
            // TODO this one can become the default again once it's stable (no more VT issues)
            "https://ipfs.thirdwebcdn.com/ipfs/",
        ],
    };
    /**
     * @internal
     */
    const TW_IPFS_SERVER_URL = "https://upload.nftlabs.co";
    /**
     * @internal
     */
    const PINATA_IPFS_URL = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    /**
     * @internal
     */
    function parseGatewayUrls(gatewayUrls) {
        if (Array.isArray(gatewayUrls)) {
            return {
                "ipfs://": gatewayUrls,
            };
        }
        return gatewayUrls || {};
    }
    /**
     * @internal
     */
    function prepareGatewayUrls(gatewayUrls) {
        const allGatewayUrls = Object.assign(Object.assign({}, gatewayUrls), DEFAULT_GATEWAY_URLS);
        for (const key of Object.keys(DEFAULT_GATEWAY_URLS)) {
            if (gatewayUrls && gatewayUrls[key]) {
                // Make sure that all user gateway URLs have trailing slashes
                const cleanedGatewayUrls = gatewayUrls[key].map((url) => url.replace(/\/$/, "") + "/");
                allGatewayUrls[key] = [
                    ...cleanedGatewayUrls,
                    ...DEFAULT_GATEWAY_URLS[key],
                ];
            }
        }
        return allGatewayUrls;
    }

    let Buffer = globalThis.Buffer;
    const getBuffer = (() => {
        return () => __awaiter(void 0, void 0, void 0, function* () {
            if (Buffer)
                return Buffer;
            Buffer = (yield import('node:buffer')).Buffer;
            return Buffer;
        });
    })();
    getBuffer();
    /**
     * @internal
     */
    function isBrowser() {
        return typeof globalThis.window !== "undefined";
    }
    /**
     * @internal
     */
    function isFileInstance(data) {
        return globalThis.File && data instanceof File;
    }
    /**
     * @internal
     */
    function isBufferInstance(data) {
        return Buffer && data instanceof Buffer;
    }
    /**
     * @internal
     */
    function isBufferOrStringWithName(data) {
        return !!(data &&
            data.name &&
            data.data &&
            typeof data.name === "string" &&
            (typeof data.data === "string" || isBufferInstance(data.data)));
    }
    function isFileOrBuffer(data) {
        return (isFileInstance(data) ||
            isBufferInstance(data) ||
            isBufferOrStringWithName(data));
    }
    /**
     * @internal
     */
    function isFileBufferOrStringEqual(input1, input2) {
        if (isFileInstance(input1) && isFileInstance(input2)) {
            // if both are File types, compare the name, size, and last modified date (best guess that these are the same files)
            if (input1.name === input2.name &&
                input1.lastModified === input2.lastModified &&
                input1.size === input2.size) {
                return true;
            }
        }
        else if (isBufferInstance(input1) && isBufferInstance(input2)) {
            // buffer gives us an easy way to compare the contents!
            return input1.equals(input2);
        }
        else if (isBufferOrStringWithName(input1) &&
            isBufferOrStringWithName(input2)) {
            // first check the names
            if (input1.name === input2.name) {
                // if the data for both is a string, compare the strings
                if (typeof input1.data === "string" && typeof input2.data === "string") {
                    return input1.data === input2.data;
                }
                else if (isBufferInstance(input1.data) &&
                    isBufferInstance(input2.data)) {
                    // otherwise we know it's buffers, so compare the buffers
                    return input1.data.equals(input2.data);
                }
            }
        }
        // otherwise if we have not found a match, return false
        return false;
    }
    /**
     * @internal
     */
    function replaceGatewayUrlWithScheme(uri, gatewayUrls) {
        for (const scheme of Object.keys(gatewayUrls)) {
            for (const url of gatewayUrls[scheme]) {
                if (uri.startsWith(url)) {
                    return uri.replace(url, scheme);
                }
            }
        }
        return uri;
    }
    /**
     * @internal
     */
    function replaceSchemeWithGatewayUrl(uri, gatewayUrls, index = 0) {
        const scheme = Object.keys(gatewayUrls).find((s) => uri.startsWith(s));
        const schemeGatewayUrls = scheme ? gatewayUrls[scheme] : [];
        if ((!scheme && index > 0) || (scheme && index >= schemeGatewayUrls.length)) {
            return undefined;
        }
        if (!scheme) {
            return uri;
        }
        return uri.replace(scheme, schemeGatewayUrls[index]);
    }
    /**
     * @internal
     */
    function replaceObjectGatewayUrlsWithSchemes(data, gatewayUrls) {
        if (typeof data === "string") {
            return replaceGatewayUrlWithScheme(data, gatewayUrls);
        }
        if (typeof data === "object") {
            if (!data) {
                return data;
            }
            if (isFileOrBuffer(data)) {
                return data;
            }
            if (Array.isArray(data)) {
                return data.map((entry) => replaceObjectGatewayUrlsWithSchemes(entry, gatewayUrls));
            }
            return Object.fromEntries(Object.entries(data).map(([key, value]) => [
                key,
                replaceObjectGatewayUrlsWithSchemes(value, gatewayUrls),
            ]));
        }
        return data;
    }
    /**
     * @internal
     */
    function replaceObjectSchemesWithGatewayUrls(data, gatewayUrls) {
        if (typeof data === "string") {
            return replaceSchemeWithGatewayUrl(data, gatewayUrls);
        }
        if (typeof data === "object") {
            if (!data) {
                return data;
            }
            if (isFileOrBuffer(data)) {
                return data;
            }
            if (Array.isArray(data)) {
                return data.map((entry) => replaceObjectSchemesWithGatewayUrls(entry, gatewayUrls));
            }
            return Object.fromEntries(Object.entries(data).map(([key, value]) => [
                key,
                replaceObjectSchemesWithGatewayUrls(value, gatewayUrls),
            ]));
        }
        return data;
    }
    /**
     * @internal
     */
    function extractObjectFiles(data, files = []) {
        // If item is a FileOrBuffer add it to our list of files
        if (isFileOrBuffer(data)) {
            files.push(data);
            return files;
        }
        if (typeof data === "object") {
            if (!data) {
                return files;
            }
            if (Array.isArray(data)) {
                data.forEach((entry) => extractObjectFiles(entry, files));
            }
            else {
                Object.keys(data).map((key) => extractObjectFiles(data[key], files));
            }
        }
        return files;
    }
    /**
     * @internal
     */
    function replaceObjectFilesWithUris(data, uris) {
        if (isFileOrBuffer(data)) {
            if (uris.length) {
                data = uris.shift();
                return data;
            }
            else {
                console.warn("Not enough URIs to replace all files in object.");
            }
        }
        if (typeof data === "object") {
            if (!data) {
                return data;
            }
            if (Array.isArray(data)) {
                return data.map((entry) => replaceObjectFilesWithUris(entry, uris));
            }
            else {
                return Object.fromEntries(Object.entries(data).map(([key, value]) => [
                    key,
                    replaceObjectFilesWithUris(value, uris),
                ]));
            }
        }
        return data;
    }

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
    class StorageDownloader {
        download(uri, gatewayUrls, attempts = 0) {
            return __awaiter(this, void 0, void 0, function* () {
                if (attempts > 3) {
                    throw new Error("[FAILED_TO_DOWNLOAD_ERROR] Failed to download from URI - too many attempts failed.");
                }
                // Replace recognized scheme with the highest priority gateway URL that hasn't already been attempted
                const resolvedUri = replaceSchemeWithGatewayUrl(uri, gatewayUrls, attempts);
                // If every gateway URL we know about for the designated scheme has been tried (via recursion) and failed, throw an error
                if (!resolvedUri) {
                    throw new Error("[FAILED_TO_DOWNLOAD_ERROR] Unable to download from URI - all gateway URLs failed to respond.");
                }
                const res = yield fetch(resolvedUri);
                // If request to the current gateway fails, recursively try the next one we know about
                if (res.status >= 500 || res.status === 403 || res.status === 408) {
                    console.warn(`Request to ${resolvedUri} failed with status ${res.status} - ${res.statusText}`);
                    return this.download(uri, gatewayUrls, attempts + 1);
                }
                return res;
            });
        }
    }

    function getCIDForUpload(data, fileNames, wrapWithDirectory = true, cidVersion = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const CBuffer = globalThis.Buffer || (yield getBuffer());
            const contentWithPath = yield Promise.all(data.map((file, i) => __awaiter(this, void 0, void 0, function* () {
                const path = fileNames[i];
                let content;
                if (typeof file === "string") {
                    content = new TextEncoder().encode(file);
                }
                else if (isBufferOrStringWithName(file)) {
                    if (typeof file.data === "string") {
                        content = new TextEncoder().encode(file.data);
                    }
                    else {
                        content = file.data;
                    }
                }
                else if (CBuffer.isBuffer(file)) {
                    content = file;
                }
                else {
                    const buffer = yield file.arrayBuffer();
                    content = new Uint8Array(buffer);
                }
                return { path, content };
            })));
            return getCID(contentWithPath, wrapWithDirectory, cidVersion);
        });
    }
    function getCID(content, wrapWithDirectory = true, cidVersion = 0) {
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            const options = { onlyHash: true, wrapWithDirectory, cidVersion };
            const dummyBlockstore = {
                put: () => __awaiter(this, void 0, void 0, function* () { }),
            };
            let lastCid;
            try {
                for (var _b = __asyncValues(ipfsUnixfsImporter.importer(content, dummyBlockstore, options)), _c; _c = yield _b.next(), !_c.done;) {
                    const { cid } = _c.value;
                    lastCid = cid;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return `${lastCid}`;
        });
    }
    function isUploaded(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield fetch(`${DEFAULT_GATEWAY_URLS["ipfs://"][0]}${cid}`, {
                method: "HEAD",
                headers: {
                    // tell the gateway to skip fetching from origin in order to fail fast on 404s and just re-upload in those cases
                    "x-skip-origin": "true",
                },
            });
            return res.ok;
        });
    }

    /**
     * Default uploader used - handles uploading arbitrary data to IPFS
     *
     * @example
     * ```jsx
     * // Can instantiate the uploader with default configuration
     * const uploader = new StorageUploader();
     * const storage = new ThirdwebStorage({ uploader });
     *
     * // Or optionally, can pass configuration
     * const options = {
     *   // Upload objects with resolvable URLs
     *   uploadWithGatewayUrl: true,
     * }
     * const uploader = new StorageUploader(options);
     * const storage = new ThirdwebStorage({ uploader });
     * ```
     *
     * @public
     */
    class IpfsUploader {
        constructor(options) {
            this.uploadWithGatewayUrl = (options === null || options === void 0 ? void 0 : options.uploadWithGatewayUrl) || false;
        }
        uploadBatch(data, options) {
            return __awaiter(this, void 0, void 0, function* () {
                if ((options === null || options === void 0 ? void 0 : options.uploadWithoutDirectory) && data.length > 1) {
                    throw new Error("[UPLOAD_WITHOUT_DIRECTORY_ERROR] Cannot upload more than one file or object without directory!");
                }
                const formData = new FormData();
                const { form, fileNames } = yield this.buildFormData(formData, data, options);
                try {
                    const cid = yield getCIDForUpload(data, fileNames.map((name) => decodeURIComponent(name)), !(options === null || options === void 0 ? void 0 : options.uploadWithoutDirectory));
                    if ((yield isUploaded(cid)) && !(options === null || options === void 0 ? void 0 : options.alwaysUpload)) {
                        if (options === null || options === void 0 ? void 0 : options.onProgress) {
                            options === null || options === void 0 ? void 0 : options.onProgress({
                                progress: 100,
                                total: 100,
                            });
                        }
                        if (options === null || options === void 0 ? void 0 : options.uploadWithoutDirectory) {
                            return [`ipfs://${cid}`];
                        }
                        else {
                            return fileNames.map((name) => `ipfs://${cid}/${name}`);
                        }
                    }
                }
                catch (_a) {
                    // no-op
                }
                return this.doUploadBatch(form, fileNames, options);
            });
        }
        /**
         * Fetches a one-time-use upload token that can used to upload
         * a file to storage.
         *
         * @returns - The one time use token that can be passed to the Pinata API.
         */
        getUploadToken() {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield fetch(`${TW_IPFS_SERVER_URL}/grant`, {
                    method: "GET",
                    headers: {
                        "X-APP-NAME": "Storage SDK",
                    },
                });
                if (!res.ok) {
                    throw new Error(`Failed to get upload token`);
                }
                const body = yield res.text();
                return body;
            });
        }
        buildFormData(form, files, options) {
            return __awaiter(this, void 0, void 0, function* () {
                const fileNameToFileMap = new Map();
                const fileNames = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    let fileName = "";
                    if (isFileInstance(file)) {
                        if (options === null || options === void 0 ? void 0 : options.rewriteFileNames) {
                            let extensions = "";
                            if (file.name) {
                                const extensionStartIndex = file.name.lastIndexOf(".");
                                if (extensionStartIndex > -1) {
                                    extensions = file.name.substring(extensionStartIndex);
                                }
                            }
                            fileName = `${i + options.rewriteFileNames.fileStartNumber}${extensions}`;
                        }
                        else {
                            fileName = `${file.name}`;
                        }
                    }
                    else if (isBufferOrStringWithName(file)) {
                        if (options === null || options === void 0 ? void 0 : options.rewriteFileNames) {
                            fileName = `${i + options.rewriteFileNames.fileStartNumber}`;
                        }
                        else {
                            fileName = `${file.name}`;
                        }
                    }
                    else {
                        if (options === null || options === void 0 ? void 0 : options.rewriteFileNames) {
                            fileName = `${i + options.rewriteFileNames.fileStartNumber}`;
                        }
                        else {
                            fileName = `${i}`;
                        }
                    }
                    // If we don't want to wrap with directory, adjust the filepath
                    const filepath = (options === null || options === void 0 ? void 0 : options.uploadWithoutDirectory)
                        ? `files`
                        : `files/${fileName}`;
                    if (fileNameToFileMap.has(fileName)) {
                        // if the file in the map is the same as the file we are already looking at then just skip and continue
                        if (isFileBufferOrStringEqual(fileNameToFileMap.get(fileName), file)) {
                            // we add it to the filenames array so that we can return the correct number of urls,
                            fileNames.push(fileName);
                            // but then we skip because we don't need to upload it multiple times
                            continue;
                        }
                        // otherwise if file names are the same but they are not the same file then we should throw an error (trying to upload to differnt files but with the same names)
                        throw new Error(`[DUPLICATE_FILE_NAME_ERROR] File name ${fileName} was passed for more than one different file.`);
                    }
                    // add it to the map so that we can check for duplicates
                    fileNameToFileMap.set(fileName, file);
                    fileNames.push(fileName);
                    form.append("file", file, filepath);
                }
                const metadata = {
                    name: `Storage SDK`,
                    keyvalues: Object.assign({}, options === null || options === void 0 ? void 0 : options.metadata),
                };
                form.append("pinataMetadata", JSON.stringify(metadata));
                if (options === null || options === void 0 ? void 0 : options.uploadWithoutDirectory) {
                    form.append("pinataOptions", JSON.stringify({
                        wrapWithDirectory: false,
                    }));
                }
                return {
                    form,
                    // encode the file names on the way out (which is what the upload backend expects)
                    fileNames: fileNames.map((fName) => encodeURIComponent(fName)),
                };
            });
        }
        doUploadBatch(form, fileNames, options) {
            return __awaiter(this, void 0, void 0, function* () {
                const token = yield this.getUploadToken();
                if (options === null || options === void 0 ? void 0 : options.onProgress) {
                    console.warn("The onProgress option is only supported in the browser");
                }
                const res = yield fetch(PINATA_IPFS_URL, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: form,
                });
                const body = yield res.json();
                if (!res.ok) {
                    console.warn(body);
                    throw new Error("Failed to upload files to IPFS");
                }
                const cid = body.IpfsHash;
                if (!cid) {
                    throw new Error("Failed to upload files to IPFS");
                }
                if (options === null || options === void 0 ? void 0 : options.uploadWithoutDirectory) {
                    return [`ipfs://${cid}`];
                }
                else {
                    return fileNames.map((name) => `ipfs://${cid}/${name}`);
                }
            });
        }
    }

    /**
     * Upload and download files from decentralized storage systems.
     *
     * @example
     * ```jsx
     * // Create a default storage class without any configuration
     * const storage = new ThirdwebStorage();
     *
     * // Upload any file or JSON object
     * const uri = await storage.upload(data);
     * const result = await storage.download(uri);
     *
     * // Or configure a custom uploader, downloader, and gateway URLs
     * const gatewayUrls = {
     *   // We define a mapping of schemes to gateway URLs
     *   "ipfs://": [
     *     "https://ipfs.thirdwebcdn.com/ipfs/",
     *     "https://cloudflare-ipfs.com/ipfs/",
     *     "https://ipfs.io/ipfs/",
     *   ],
     * };
     * const downloader = new StorageDownloader();
     * const uploader = new IpfsUploader();
     * const storage = new ThirdwebStorage({ uploader, downloader, gatewayUrls });
     * ```
     *
     * @public
     */
    class ThirdwebStorage {
        constructor(options) {
            this.uploader = (options === null || options === void 0 ? void 0 : options.uploader) || new IpfsUploader();
            this.downloader = (options === null || options === void 0 ? void 0 : options.downloader) || new StorageDownloader();
            this.gatewayUrls = prepareGatewayUrls(parseGatewayUrls(options === null || options === void 0 ? void 0 : options.gatewayUrls));
        }
        /**
         * Resolve any scheme on a URL to get a retrievable URL for the data
         *
         * @param url - The URL to resolve the scheme of
         * @returns The URL with its scheme resolved
         *
         * @example
         * ```jsx
         * const uri = "ipfs://example";
         * const url = storage.resolveScheme(uri);
         * console.log(url);
         * ```
         */
        resolveScheme(url) {
            return replaceSchemeWithGatewayUrl(url, this.gatewayUrls);
        }
        /**
         * Downloads arbitrary data from any URL scheme.
         *
         * @param url - The URL of the data to download
         * @returns The response object fetched from the resolved URL
         *
         * @example
         * ```jsx
         * const uri = "ipfs://example";
         * const data = await storage.download(uri);
         * ```
         */
        download(url) {
            return __awaiter(this, void 0, void 0, function* () {
                return this.downloader.download(url, this.gatewayUrls);
            });
        }
        /**
         * Downloads JSON data from any URL scheme.
         * Resolves any URLs with schemes to retrievable gateway URLs.
         *
         * @param url - The URL of the JSON data to download
         * @returns The JSON data fetched from the resolved URL
         *
         * @example
         * ```jsx
         * const uri = "ipfs://example";
         * const json = await storage.downloadJSON(uri);
         * ```
         */
        downloadJSON(url) {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield this.download(url);
                // If we get a JSON object, recursively replace any schemes with gatewayUrls
                const json = yield res.json();
                return replaceObjectSchemesWithGatewayUrls(json, this.gatewayUrls);
            });
        }
        /**
         * Upload arbitrary file or JSON data using the configured decentralized storage system.
         * Automatically uploads any file data within JSON objects and replaces them with hashes.
         *
         * @param data - Arbitrary file or JSON data to upload
         * @param options - Options to pass through to the storage uploader class
         * @returns - The URI of the uploaded data
         *
         * @example
         * ```jsx
         * // Upload file data
         * const file = readFileSync("../file.jpg");
         * const fileUri = await storage.upload(file);
         *
         * // Or upload a JSON object
         * const json = { name: "JSON", image: file };
         * const jsonUri = await storage.upload(json);
         * ```
         */
        upload(data, options) {
            return __awaiter(this, void 0, void 0, function* () {
                const [uri] = yield this.uploadBatch([data], options);
                return uri;
            });
        }
        /**
         * Batch upload arbitrary file or JSON data using the configured decentralized storage system.
         * Automatically uploads any file data within JSON objects and replaces them with hashes.
         *
         * @param data - Array of arbitrary file or JSON data to upload
         * @param options - Options to pass through to the storage uploader class
         * @returns - The URIs of the uploaded data
         *
         * @example
         * ```jsx
         * // Upload an array of file data
         * const files = [
         *  readFileSync("../file1.jpg"),
         *  readFileSync("../file2.jpg"),
         * ];
         * const fileUris = await storage.uploadBatch(files);
         *
         * // Upload an array of JSON objects
         * const objects = [
         *  { name: "JSON 1", image: files[0] },
         *  { name: "JSON 2", image: files[1] },
         * ];
         * const jsonUris = await storage.uploadBatch(objects);
         * ```
         */
        uploadBatch(data, options) {
            return __awaiter(this, void 0, void 0, function* () {
                data = data.filter((item) => item !== undefined);
                if (!data.length) {
                    return [];
                }
                const isFileArray = data
                    .map((item) => isFileOrBuffer(item) || typeof item === "string")
                    .every((item) => !!item);
                let uris = [];
                // If data is an array of files, pass it through to upload directly
                if (isFileArray) {
                    uris = yield this.uploader.uploadBatch(data, options);
                }
                else {
                    // Otherwise it is an array of JSON objects, so we have to prepare it first
                    const metadata = (yield this.uploadAndReplaceFilesWithHashes(data, options)).map((item) => {
                        if (typeof item === "string") {
                            return item;
                        }
                        return JSON.stringify(item);
                    });
                    uris = yield this.uploader.uploadBatch(metadata, options);
                }
                if ((options === null || options === void 0 ? void 0 : options.uploadWithGatewayUrl) || this.uploader.uploadWithGatewayUrl) {
                    return uris.map((uri) => this.resolveScheme(uri));
                }
                else {
                    return uris;
                }
            });
        }
        uploadAndReplaceFilesWithHashes(data, options) {
            return __awaiter(this, void 0, void 0, function* () {
                let cleaned = data;
                // Replace any gateway URLs with their hashes
                cleaned = replaceObjectGatewayUrlsWithSchemes(cleaned, this.gatewayUrls);
                // Recurse through data and extract files to upload
                const files = extractObjectFiles(cleaned);
                if (files.length) {
                    // Upload all files that came from the object
                    const uris = yield this.uploader.uploadBatch(files, options);
                    // Recurse through data and replace files with hashes
                    cleaned = replaceObjectFilesWithUris(cleaned, uris);
                }
                if ((options === null || options === void 0 ? void 0 : options.uploadWithGatewayUrl) || this.uploader.uploadWithGatewayUrl) {
                    // If flag is set, replace all schemes with their preferred gateway URL
                    // Ex: used for Solana, where services don't resolve schemes for you, so URLs must be usable by default
                    cleaned = replaceObjectSchemesWithGatewayUrls(cleaned, this.gatewayUrls);
                }
                return cleaned;
            });
        }
    }

    exports.DEFAULT_GATEWAY_URLS = DEFAULT_GATEWAY_URLS;
    exports.IpfsUploader = IpfsUploader;
    exports.PINATA_IPFS_URL = PINATA_IPFS_URL;
    exports.StorageDownloader = StorageDownloader;
    exports.TW_IPFS_SERVER_URL = TW_IPFS_SERVER_URL;
    exports.ThirdwebStorage = ThirdwebStorage;
    exports.extractObjectFiles = extractObjectFiles;
    exports.getBuffer = getBuffer;
    exports.getCID = getCID;
    exports.getCIDForUpload = getCIDForUpload;
    exports.isBrowser = isBrowser;
    exports.isBufferInstance = isBufferInstance;
    exports.isBufferOrStringWithName = isBufferOrStringWithName;
    exports.isFileBufferOrStringEqual = isFileBufferOrStringEqual;
    exports.isFileInstance = isFileInstance;
    exports.isFileOrBuffer = isFileOrBuffer;
    exports.isUploaded = isUploaded;
    exports.parseGatewayUrls = parseGatewayUrls;
    exports.prepareGatewayUrls = prepareGatewayUrls;
    exports.replaceGatewayUrlWithScheme = replaceGatewayUrlWithScheme;
    exports.replaceObjectFilesWithUris = replaceObjectFilesWithUris;
    exports.replaceObjectGatewayUrlsWithSchemes = replaceObjectGatewayUrlsWithSchemes;
    exports.replaceObjectSchemesWithGatewayUrls = replaceObjectSchemesWithGatewayUrls;
    exports.replaceSchemeWithGatewayUrl = replaceSchemeWithGatewayUrl;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=index.umd.js.map
