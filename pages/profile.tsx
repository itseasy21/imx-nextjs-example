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
  StarkWallet,
  Configuration,
} from "@imtbl/core-sdk";

import { AlchemyProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";

const Profile = () => {
  const { user } = useUser();
  const config = getConfig(ethNetwork);
  const [address, setAddress] = useState("");
  const [l2Wallet, setl2Wallet] = useState<StarkWallet>();
  const [l1Balance, setL1Balance] = useState("");
  const [l2Balance, setL2Balance] = useState("0");
  const [l1Signer, setL1Signer] = useState<ethers.providers.JsonRpcSigner>();
  const coreSdkWorkflows = new Workflows(config);

  useEffect(() => {
    if (!l1Signer || !l2Wallet) {
      void init();
    }
  }, []);

  const init = async () => {
    if (magic) {
      magic.preload();
      const l1Provider = new ethers.providers.Web3Provider(
        magic.rpcProvider as any
      );
      // provider.on("debug", console.log);

      const l1Signer = l1Provider.getSigner();
      setL1Signer(l1Signer);

      // 1 generate stark wallet
      const l2Wallet = await generateStarkWallet(l1Signer);
      setl2Wallet(l2Wallet);
      console.log("1 👉 l2wallet:", l2Wallet);

      const address = await l1Signer.getAddress();
      setAddress(address);

      setL1Balance(
        ethers.utils.formatEther(
          await l1Provider.getBalance(address) // Balance is in wei
        )
      );

      // 2 post login register user on imx
      const response = await coreSdkWorkflows.registerOffchain(
        l1Signer,
        l2Wallet
      );
      console.log("2 👉 register user", response);

      // 3 get user balance
      const balancesApi = new BalancesApi(config.api);
      const l2Bal = await balancesApi.listBalances({
        owner: address,
      });
      if (l2Bal.data.result.length > 0) {
        setL2Balance(l2Bal.data.result[0]?.balance);
      }
      console.log("3 👉 l2 balance", l2Bal);
    }
  };

  // sample code
  const demoTest = async () => {
    // User registration workflow example

    const alchemyApiKey = "IivG2zRO-_JpmxAlzhmJyksyWT9ZGVST";
    const ethNetwork = "ropsten";

    // Setup provider and signer
    const alchemyProvider = new AlchemyProvider(ethNetwork, alchemyApiKey);

    const l1Wallet = Wallet.createRandom();

    const l1Signer = l1Wallet.connect(alchemyProvider);
    const l2Wallet = await generateStarkWallet(l1Signer);
    console.log("1 -> l2Wallet: ", l2Wallet);

    const coreSdkConfig = getConfig(ethNetwork);
    const coreSdkWorkflows = new Workflows(coreSdkConfig);

    const response = await coreSdkWorkflows.registerOffchain(
      l1Signer,
      l2Wallet
    );
    console.log("2 -> registerOffChain", response);

    const depositMoney = await coreSdkWorkflows.depositEth(l1Signer, {
      type: TokenType.ETH,
      amount: "0.0001",
    });
    console.log("3 -> deposit:", depositMoney);
  };

  // TODO: deposit funds from L1 wallet
  const deposit = async () => {
    if (l1Signer && coreSdkWorkflows) {
      const depositMoney = await coreSdkWorkflows.depositEth(l1Signer, {
        type: TokenType.ETH,
        amount: "0.000001",
      });
      console.log("deposit 👉", depositMoney);
    }
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
            <div className="profile-info">{l2Wallet?.starkPublicKey}</div>

            <div className="label">Deposit 0.0001 ETH</div>
            <div className="profile-info">
              <div>
                <button onClick={deposit}>
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
