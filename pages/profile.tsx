import { useEffect, useState } from "react";
import { useUser } from "../lib/UserContext";
import Loading from "../components/loading";
import { magic, ethNetwork } from "../lib/magic";
import { ethers } from "ethers";
import { Web3Provider } from "@ethersproject/providers";
import {
  getConfig,
  generateStarkWallet,
  Workflows,
  TokenType,
  BalancesApi,
  StarkWallet,
  Core__factory,
  EncodingApi,
  UsersApi,
  DepositsApi,
  BaseSigner,
} from "@imtbl/core-sdk";

const Profile = () => {
  const { user } = useUser();
  const config = getConfig(ethNetwork);
  const [l1Address, setL1Address] = useState("");
  const [l2Address, setL2Address] = useState("");
  const [l2Wallet, setl2Wallet] = useState<StarkWallet>();
  const [l1Balance, setL1Balance] = useState("");
  const [l2Balance, setL2Balance] = useState("0");
  const [l1Signer, setL1Signer] = useState<ethers.providers.JsonRpcSigner>();
  const [l1Provider, setL1Provider] = useState<ethers.providers.Web3Provider>();
  const coreSdkWorkflows = new Workflows(config);
  const balancesApi = new BalancesApi(config.api);
  const usersApi = new UsersApi(config.api);
  const depositApi = new DepositsApi(config.api);

  useEffect(() => {
    if (!l1Signer || !l2Wallet) {
      void init();
    }
  }, []);

  const isUserRegistered = async (userAddress: string): Promise<boolean> => {
    try {
      const userDet = await usersApi.getUsers({ user: userAddress });
      setL2Address(userDet.data.accounts[0]);
      console.log("user check passed 👉", userDet);
      return true;
    } catch (error) {
      return false;
    }
  };

  const init = async () => {
    if (magic) {
      const provider = new Web3Provider(magic.rpcProvider as any);
      setL1Provider(provider);
      // provider.on("debug", console.log);

      const l1Signer = provider.getSigner();
      setL1Signer(l1Signer);

      const address = await l1Signer.getAddress();
      setL1Address(address);
      console.log("provider network", await provider.getCode(address));

      setL1Balance(
        ethers.utils.formatEther(
          await provider.getBalance(address) // Balance is in wei
        )
      );

      if (!isUserRegistered(address)) {
        // 1 generate stark wallet
        const l2Wallet = await generateStarkWallet(l1Signer);
        setl2Wallet(l2Wallet);
        setL2Address(l2Wallet.starkPublicKey);
        console.log("1 👉 l2wallet:", l2Wallet);

        // This will be the L2 signer
        const l2Signer = new BaseSigner(l2Wallet.starkKeyPair);

        // 2 post stark wallet generation register user on imx
        await coreSdkWorkflows.registerOffchainWithSigner({
          l1Signer,
          l2Signer,
        });

        // deprecated - use registerOffchainWithSigner
        // const response = await coreSdkWorkflows.registerOffchain(
        //   l1Signer,
        //   l2Wallet
        // );
        // console.log("2 👉 register user", response);
      }

      // 3 get user balance
      const l2Bal = await balancesApi.listBalances({
        owner: address,
      });
      if (l2Bal.data.result.length > 0) {
        setL2Balance(l2Bal.data.result[0]?.balance);
      }
      console.log("3 👉 l2 balance", l2Bal);
    }
  };

  // Deposit using API
  const despositApi = async () => {
    if (l1Signer && l1Provider) {
      // Get instance of core contract
      const contract = Core__factory.connect(
        config.starkContractAddress,
        l1Signer
      );
      const encodingApi = new EncodingApi(config.api);
      const amount = ethers.utils.parseEther("0.0001");

      // 1 generate signable transaction
      let data = {
        user: l1Address,
        token: {
          type: "ETH",
          data: {
            decimals: 18,
          },
        },
        amount: amount.toString(),
      };

      const signableDepositResult = await depositApi.getSignableDeposit({
        getSignableDepositRequest: data,
      });

      const encodingResult = await encodingApi.encodeAsset({
        assetType: "asset",
        encodeAssetRequest: {
          token: {
            type: "ETH",
          },
        },
      });

      const assetType = encodingResult.data.asset_type;
      const starkPublicKey = signableDepositResult.data.stark_key;
      const vaultId = signableDepositResult.data.vault_id;

      //could be used
      const nonce = signableDepositResult.data.nonce;
      const gasPrice = await l1Provider.getGasPrice();

      // Populate and send transaction
      // const populatedTransaction =
      //   await contract.populateTransaction.depositEth(
      //     starkPublicKey,
      //     assetType,
      //     vaultId
      //   );
      const populatedTransaction = await contract.populateTransaction[
        "deposit(uint256,uint256,uint256)"
      ](starkPublicKey, assetType, vaultId);

      console.log("populatedTransaction", populatedTransaction);

      const tx = await l1Signer.sendTransaction({
        ...populatedTransaction,
        gasLimit: 99362,
        value: amount,
        maxPriorityFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
      });
      console.log("Mining transaction...");
      console.log(`https://${ethNetwork}.etherscan.io/tx/${tx.hash}`);
      // Waiting for the transaction to be mined
      const receipt = await tx.wait();
      // The transaction is now on chain!
      console.log(`Mined in block ${receipt.blockNumber}`);
      console.log("deposit receipt 👉", receipt);
    }
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
            <div className="profile-info">{l1Address}</div>

            <div className="label">L1 Balance</div>
            <div className="profile-info">ETH {l1Balance}</div>

            <div className="label">L2 Balance</div>
            <div className="profile-info">ETH {l2Balance}</div>

            <div className="label">Stark Wallet</div>
            <div className="profile-info">{l2Address}</div>

            <div className="label">Deposit 0.0001 ETH</div>
            <div className="profile-info">
              <div>
                <button onClick={despositApi}>
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
