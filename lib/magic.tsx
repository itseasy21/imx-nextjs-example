import { Magic, EthNetworkName } from "magic-sdk";
// import { ConnectExtension } from "@magic-ext/connect";

export const ethNetwork = "ropsten";
// Create client-side Magic instance
const createMagic = (key: any) => {
  if (typeof window === "undefined") {
    return null;
  }

  return new Magic(key, {
    // extensions: [new ConnectExtension()],
    network: ethNetwork,
  });
};

export const magic = createMagic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY);
