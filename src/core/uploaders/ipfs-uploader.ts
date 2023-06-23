import type { IStorageUploader, IpfsUploadBatchOptions, IpfsUploaderOptions } from "../../types/upload";
import type { FileOrBufferOrString } from "../../types/data";
import { getCIDForUpload, isUploaded } from "../../commons/cid";
import { PINATA_IPFS_URL, TW_IPFS_SERVER_URL } from "../../commons/urls";
import { isBufferOrStringWithName, isFileBufferOrStringEqual, isFileInstance } from "../../commons/utils";

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
export class IpfsUploader implements IStorageUploader<IpfsUploadBatchOptions> {
  public uploadWithGatewayUrl: boolean;

  constructor(options?: IpfsUploaderOptions) {
    this.uploadWithGatewayUrl = options?.uploadWithGatewayUrl || false;
  }

  async uploadBatch(
    data: FileOrBufferOrString[],
    options?: IpfsUploadBatchOptions,
  ): Promise<string[]> {
    if (options?.uploadWithoutDirectory && data.length > 1) {
      throw new Error(
        "[UPLOAD_WITHOUT_DIRECTORY_ERROR] Cannot upload more than one file or object without directory!",
      );
    }

    const formData = new FormData();
    const { form, fileNames } = await this.buildFormData(formData, data, options)

    try {
      const cid = await getCIDForUpload(
        data,
        fileNames.map((name) => decodeURIComponent(name)),
        !options?.uploadWithoutDirectory,
      );
      if ((await isUploaded(cid)) && !options?.alwaysUpload) {
        if (options?.onProgress) {
          options?.onProgress({
            progress: 100,
            total: 100,
          });
        }

        if (options?.uploadWithoutDirectory) {
          return [`ipfs://${cid}`];
        } else {
          return fileNames.map((name) => `ipfs://${cid}/${name}`);
        }
      }
    } catch {
      // no-op
    }

    return this.doUploadBatch(form, fileNames, options)
  }

  /**
   * Fetches a one-time-use upload token that can used to upload
   * a file to storage.
   *
   * @returns - The one time use token that can be passed to the Pinata API.
   */
  private async getUploadToken(): Promise<string> {
    const res = await fetch(`${TW_IPFS_SERVER_URL}/grant`, {
      method: "GET",
      headers: {
        "X-APP-NAME": "Storage SDK",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to get upload token`);
    }
    const body = await res.text();
    return body;
  }

  private async buildFormData(
    form: FormData,
    files: FileOrBufferOrString[],
    options?: IpfsUploadBatchOptions,
  ) {
    const fileNameToFileMap = new Map<string, FileOrBufferOrString>();
    const fileNames: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileName = "";

      if (isFileInstance(file)) {
        if (options?.rewriteFileNames) {
          let extensions = "";
          if (file.name) {
            const extensionStartIndex = file.name.lastIndexOf(".");
            if (extensionStartIndex > -1) {
              extensions = file.name.substring(extensionStartIndex);
            }
          }
          fileName = `${
            i + options.rewriteFileNames.fileStartNumber
          }${extensions}`;
        } else {
          fileName = `${file.name}`;
        }
      } else if (isBufferOrStringWithName(file)) {
        if (options?.rewriteFileNames) {
          fileName = `${i + options.rewriteFileNames.fileStartNumber}`;
        } else {
          fileName = `${file.name}`;
        }
      } else {
        if (options?.rewriteFileNames) {
          fileName = `${i + options.rewriteFileNames.fileStartNumber}`;
        } else {
          fileName = `${i}`;
        }
      }

      // If we don't want to wrap with directory, adjust the filepath
      const filepath = options?.uploadWithoutDirectory
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
        throw new Error(
          `[DUPLICATE_FILE_NAME_ERROR] File name ${fileName} was passed for more than one different file.`,
        );
      }

      // add it to the map so that we can check for duplicates
      fileNameToFileMap.set(fileName, file)
      fileNames.push(fileName)
      form.append("file", file as any, filepath)
    }

    const metadata = {
      name: `Storage SDK`,
      keyvalues: { ...options?.metadata },
    };
    form.append("pinataMetadata", JSON.stringify(metadata));

    if (options?.uploadWithoutDirectory) {
      form.append(
        "pinataOptions",
        JSON.stringify({
          wrapWithDirectory: false,
        }),
      );
    }

    return {
      form,
      // encode the file names on the way out (which is what the upload backend expects)
      fileNames: fileNames.map((fName) => encodeURIComponent(fName)),
    };
  }

  private async doUploadBatch(
    form: FormData,
    fileNames: string[],
    options?: IpfsUploadBatchOptions,
  ) {
    const token = await this.getUploadToken();

    if (options?.onProgress) {
      console.warn("The onProgress option is only supported in the browser");
    }
    const res = await fetch(PINATA_IPFS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form,
    });
    const body = await res.json();
    if (!res.ok) {
      console.warn(body);
      throw new Error("Failed to upload files to IPFS");
    }

    const cid = body.IpfsHash;
    if (!cid) {
      throw new Error("Failed to upload files to IPFS");
    }

    if (options?.uploadWithoutDirectory) {
      return [`ipfs://${cid}`];
    } else {
      return fileNames.map((name) => `ipfs://${cid}/${name}`);
    }
  }
}
