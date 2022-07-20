import { useEffect, useState } from "react";
import { useUser } from "../lib/UserContext";
import Loading from "../components/loading";
import { magic, ethNetwork } from "../lib/magic";
import { ethers } from "ethers";
import {
  getConfig,
  generateStarkWallet,
  Workflows,
  TokenType,
  BalancesApi,
} from "@imtbl/core-sdk";

import { AlchemyProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";

const Profile = () => {
  const { user } = useUser();
  const config = getConfig(ethNetwork);
  const [address, setAddress] = useState("");
  const [starkWallet, setstarkWallet] = useState("");
  const [l1Balance, setL1Balance] = useState("");
  const [l2Balance, setL2Balance] = useState("0");
  const [signer, setSigner] = useState();
  const workflows = new Workflows(config);

  useEffect(() => {
    if (!signer || !starkWallet) {
      init();
    }
  }, []);

  const init = async () => {
    const provider = new ethers.providers.Web3Provider(magic.rpcProvider);
    // provider.on("debug", console.log);
    const signer = provider.getSigner();
    setSigner(signer);
    const address = await signer.getAddress();
    setAddress(address);
    setL1Balance(
      ethers.utils.formatEther(
        await provider.getBalance(address) // Balance is in wei
      )
    );

    registerUser(address, signer);
  };

  const demoTest = async () => {
    // User registration workflow example

    const alchemyApiKey = "IivG2zRO-_JpmxAlzhmJyksyWT9ZGVST";
    const ethNetwork = "ropsten";

    // Setup provider and signer
    const providerX = new AlchemyProvider(ethNetwork, alchemyApiKey);
    const signerX = Wallet.createRandom().connect(providerX);
    // const signerX = new Wallet(privateKey).connect(provider);

    // Configure Core SDK Workflow class
    const configX = getConfig(ethNetwork);
    console.log("config", configX);
    const workflowsX = new Workflows(configX);
    const tmpStarkWallet = await generateStarkWallet(signerX);
    console.log("tmpStarkWallet", tmpStarkWallet);
    const reg = await workflows.registerOffchain(signerX, tmpStarkWallet);
    console.log("reg", reg);
    // const response = await workflowsX.registerOffchainWithSigner(signerX, {
    //   signMessage: signerX.signMessage.bind(signerX),
    //   getAddress: signerX.getAddress.bind(signerX),
    // });
    // console.log("registerOffchainWithSigner", response);

    // try {
    //   const reg = await workflowsX.isRegisteredOnchain(signerX, tmpStarkWallet);
    //   console.log("isRegisteredOnchain:", reg);
    // } catch (e) {
    //   console.log("isRegisteredOnchain error:", e);
    // }

    const depositMoney = await workflowsX.depositEth(signerX, {
      type: TokenType.ETH,
      amount: "0.0001",
    });
    console.log("2 -> deposit:", depositMoney);
  };

  // 1. post login register user on imx
  const registerUser = async (address, localSigner) => {
    // L2 credentials
    // Obtain stark key pair associated with this user
    const tmpStarkWallet = await generateStarkWallet(localSigner);
    setstarkWallet(tmpStarkWallet);
    console.log("1.1 -> stark wallet:", tmpStarkWallet);

    const register = await workflows.registerOffchain(
      localSigner,
      tmpStarkWallet
    );
    // const reg = await workflows.isRegisteredOnchain(
    //   localSigner,
    //   tmpStarkWallet
    // );
    // console.log("isRegisteredOnchain:", reg);

    const l2Bal = await new BalancesApi(config).listBalances({
      owner: address,
    });
    setL2Balance(l2Bal.data.result[0]?.balance);
    console.log(l2Bal);
    console.log("1.2 -> register user:", register);
  };

  // TODO: deposit funds from L1 wallet
  const deposit = async () => {
    const depositMoney = await workflows.depositEth(signer, {
      type: TokenType.ETH,
      amount: "0.0001",
    });
    console.log("2 -> deposit:", depositMoney);
  };
  // TODO: deposit funds from moonpay wallet
  // TODO: buy nft
  // TODO: sell the same nft for 0.22 ETH
  // TODO: buy another nft
  // TODO: withdraw nft
  // TODO: Transaction history

  return (
    <>
      {user?.loading ? (
        <Loading />
      ) : (
        user?.issuer && (
          <>
            <div className="label">Email</div>
            <div className="profile-info">{user.email}</div>

            <div className="label">User Id</div>
            <div className="profile-info">{user.issuer}</div>

            <div className="label">Address</div>
            <div className="profile-info">{address}</div>

            <div className="label">L1 Balance</div>
            <div className="profile-info">ETH {l1Balance}</div>

            <div className="label">L2 Balance</div>
            <div className="profile-info">ETH {l2Balance}</div>

            <div className="label">Stark Wallet</div>
            <div className="profile-info">{starkWallet.starkPublicKey}</div>

            <div className="label">Deposit 0.0001 ETH</div>
            <div className="profile-info">
              <div>
                <button onClick={demoTest}>
                  Deposit 0.0001 ETH from L1 wallet
                </button>
              </div>
            </div>
          </>
        )
      )}
      <style jsx>{`
        .label {
          font-size: 12px;
          color: #6851ff;
          margin: 30px 0 5px;
        }
        .profile-info {
          font-size: 17px;
          word-wrap: break-word;
        }
      `}</style>
    </>
  );
};

export default Profile;
