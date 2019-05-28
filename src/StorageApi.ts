import SimpleTokenClient, { ITokenConfig } from '@ofa2/simple-token-client';
import { createReadStream, createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { extname, resolve as pathResolve } from 'path';
import { Response } from 'request';
import rp from 'request-promise';
import { pipeline as originPipeline } from 'stream';
import { format as urlFormat, parse as urlParse } from 'url';
import { promisify } from 'util';
import uuidV4 from 'uuid/v4';

const pipeline = promisify(originPipeline);

export interface IStorageConfig extends ITokenConfig {
  baseUrl: string;
}

interface IFile {
  path: string;
  originalFilename: string;
}

class StorageApi {
  private downloadDir = tmpdir();

  private config: IStorageConfig;

  private tokenClient: SimpleTokenClient;

  constructor(config: IStorageConfig) {
    this.config = config;
    this.tokenClient = new SimpleTokenClient(config);
  }

  async uploadFile(bucket: string, path: string, file: IFile, userinfo: object) {
    let token = await this.tokenClient.getToken();

    return rp({
      baseUrl: this.config.baseUrl,
      uri: '/api/v1/file',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      formData: {
        bucket,
        path,
        userinfo: JSON.stringify(userinfo),
        file: {
          value: createReadStream(file.path),
          options: {
            filename: file.originalFilename,
          },
        },
      },
      json: true,
    });
  }

  async downloadFile(uri: string) {
    let token = await this.tokenClient.getToken();

    let res: Response = await rp({
      uri,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      resolveWithFullResponse: true,
    });

    let contentDisposition = res.headers['content-disposition'];
    let filename = contentDisposition
      ? (/filename="(.*)"/gi.exec(contentDisposition) || [])[1]
      : '';
    let ext = extname(filename || '');
    let saveAs = pathResolve(this.downloadDir, `ofa2-storage-${uuidV4()}${ext}`);
    let writeStream = createWriteStream(saveAs);

    return pipeline(res, writeStream);
  }

  async queryFile(qs: { skip: number; limit: number; where: object; sort: string | object }) {
    let token = await this.tokenClient.getToken();

    return rp({
      baseUrl: this.config.baseUrl,
      uri: '/api/v1/file',
      qs,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      json: true,
    });
  }

  async destoryFile({ bucket, path }: { bucket: string; path: string }) {
    let token = await this.tokenClient.getToken();

    return rp({
      method: 'DELETE',
      baseUrl: this.config.baseUrl,
      uri: `/${bucket}/${path}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      json: true,
    });
  }

  fileUri(file: {
    metadata: {
      bucket: string;
      path: string;
    };
  }) {
    let urlObj = urlParse(this.config.baseUrl);
    let { bucket } = file.metadata;
    let { path } = file.metadata;

    if (!bucket || !path) {
      throw new Error('no bucket or path');
    }

    delete urlObj.host;
    urlObj.hostname = `${bucket}.${urlObj.hostname}`;
    urlObj.pathname = path;

    return urlFormat(urlObj);
  }
}

export { StorageApi };
export default StorageApi;
