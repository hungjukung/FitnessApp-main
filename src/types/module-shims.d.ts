declare module '@react-native/assets-registry/registry' {
  export interface PackagerAsset {
    __packager_asset: boolean;
    fileSystemLocation?: string;
    httpServerLocation: string;
    width?: number;
    height?: number;
    scales: number[];
    hash: string;
    name: string;
    type: string;
  }

  export function getAssetByID(assetId: number | object): PackagerAsset;
}

declare module 'react-native/Libraries/Image/AssetSourceResolver' {
  export default class AssetSourceResolver {
    asset: any;
    constructor(serverUrl: string | null, jsbundleUrl: string | null, asset: any);
    static pickScale(scales: number[], deviceScale: number): number;
    defaultAsset(): any;
    fromSource(source: string | { uri: string }): any;
    resourceIdentifierWithoutScale(): string;
  }
}

declare module 'invariant';
