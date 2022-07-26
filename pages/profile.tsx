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
  BalancesApi,
  StarkWallet,
  Core__factory,
  EncodingApi,
  UsersApi,
  DepositsApi,
  BaseSigner,
  GetSignableOrderRequest,
  WalletConnection,
  GetSignableTradeRequest,
  PrepareWithdrawalRequest,
  TokenType,
  ERC721Withdrawal,
  OrdersApi,
  WithdrawalsApi,
  TransfersApi,
  AssetsApi,
} from "@imtbl/core-sdk";
import merge from "lodash/merge";

const Profile = () => {
  const { user } = useUser();
  const config = getConfig(ethNetwork);
  const collectionAddress = "0x61e506cec264d5b2705f10e5a934dc5313a56a6e"; //use env variable
  const [l1Address, setL1Address] = useState("");
  const [l2Address, setL2Address] = useState("");
  const [l2Wallet, setl2Wallet] = useState<StarkWallet>();
  const [l1Balance, setL1Balance] = useState("");
  const [l2Balance, setL2Balance] = useState("0");
  const [l1Signer, setL1Signer] = useState<ethers.providers.JsonRpcSigner>();
  const [l2Signer, setL2Signer] = useState<BaseSigner>();
  const [l1Provider, setL1Provider] = useState<ethers.providers.Web3Provider>();
  const [walletConnection, setWalletConnection] = useState<WalletConnection>();
  const coreSdkWorkflows = new Workflows(config);
  const balancesApi = new BalancesApi(config.api);
  const usersApi = new UsersApi(config.api);
  const depositApi = new DepositsApi(config.api);

  useEffect(() => {
    if (!l1Signer || !l2Wallet) {
      void init();
    }
  }, []);

  const init = async () => {
    if (magic) {
      const provider = new Web3Provider(magic.rpcProvider as any);
      setL1Provider(provider);
      // provider.on("debug", console.log);

      const l1Signer = provider.getSigner();
      setL1Signer(l1Signer);

      const address = await l1Signer.getAddress();
      setL1Address(address);

      setL1Balance(
        ethers.utils.formatEther(
          await provider.getBalance(address) // Balance is in wei
        )
      );

      // 1 generate stark wallet
      const l2Wallet = await generateStarkWallet(l1Signer);
      setl2Wallet(l2Wallet);
      setL2Address(l2Wallet.starkPublicKey);
      console.log("1 👉 l2wallet:", l2Wallet);

      // This will be the L2 signer
      const l2Signer = new BaseSigner(l2Wallet.starkKeyPair);
      setL2Signer(l2Signer);

      setWalletConnection({ l1Signer, l2Signer });

      // 2 post stark wallet generation register user on imx
      await coreSdkWorkflows.registerOffchainWithSigner({
        l1Signer,
        l2Signer,
      });
      console.log("2 👉 registerOffChainWithSigner: ☑︎");

      // deprecated - use registerOffchainWithSigner
      // const response = await coreSdkWorkflows.registerOffchain(
      //   l1Signer,
      //   l2Wallet
      // );
      // console.log("2 👉 register user", response);

      // 3 get user balance
      const l2Bal = await balancesApi.listBalances({
        owner: address,
      });
      if (l2Bal.data.result.length > 0) {
        setL2Balance(
          ethers.utils.formatEther(
            l2Bal.data.result[0]?.balance // Balance is in wei
          )
        );
      }
      console.log("3 👉 l2 balance", l2Bal);
    }
  };

  // Deposit from L1 Wallet
  const deposit = async () => {
    if (l1Signer && l1Provider && l2Wallet) {
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
      let populatedTransaction: ethers.PopulatedTransaction;

      coreSdkWorkflows
        .isRegisteredOnchain(l1Signer, l2Wallet)
        .then(async () => {
          console.log("deposit using depositEth 👇🏻");
          // Populate and send transaction
          populatedTransaction = await contract.populateTransaction[
            "deposit(uint256,uint256,uint256)"
          ](starkPublicKey, assetType, vaultId);

          console.log("populatedTransaction", populatedTransaction);
        })
        .catch(async () => {
          console.log("deposit using registerAndDepositEth 👇🏻");
          //register user
          const signableResult = await usersApi.getSignableRegistration({
            getSignableRegistrationRequest: {
              ether_key: l1Address,
              stark_key: l2Address,
            },
          });

          //register and deposit
          populatedTransaction =
            await contract.populateTransaction.registerAndDepositEth(
              l1Address,
              starkPublicKey,
              signableResult.data.operator_signature,
              assetType,
              vaultId
            );
          console.log("populatedTransaction", populatedTransaction);
        })
        .finally(async () => {
          const tx = await l1Signer.sendTransaction({
            ...populatedTransaction,
            value: amount,
            gasLimit: 199362,
            maxPriorityFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
          });
          console.log("Mining transaction... 👇🏻");
          console.log(
            `Etherscan 👉 https://${ethNetwork}.etherscan.io/tx/${tx.hash}`
          );
          // Waiting for the transaction to be mined
          const receipt = await tx.wait();
          // The transaction is now on chain!
          console.log(`Mined in block ${receipt.blockNumber}`);
          console.log("deposit receipt 👉", receipt);
        });
    }
  };

  // TODO: deposit funds from moonpay wallet

  // sell the same nft for 0.22 ETH
  // i.e  create a buy order
  const createOrder = async () => {
    if (walletConnection) {
      // Order expiration in UNIX timestamp
      // In this case, set the expiration date as 1 month from now
      // Note: will be rounded down to the nearest hour
      const now = new Date(Date.now());
      now.setMonth(now.getMonth() + 1);
      const timestamp = Math.floor(now.getTime() / 1000);

      const assetApi = new AssetsApi(config.api);
      const tokenDetails = await assetApi.getAsset({
        tokenId: "47",
        tokenAddress: collectionAddress,
      });

      // Object with key-value pairs that implement the GetSignableOrderRequest interface
      const orderParameters: GetSignableOrderRequest = {
        // Fee-exclusive amount to buy the asset
        // Change '0.1' to any value of the currency wanted to sell this asset
        amount_buy: ethers.utils.parseEther("0.1").toString(),

        // Amount to sell (quantity)
        // Change '1' to any value indicating the number of assets you are selling
        amount_sell: "1",

        expiration_timestamp: timestamp,

        // Optional Inclusion of either maker or taker fees.
        // For simplicity, no maker or taker fees are added in this sample
        fees: [],

        // The currency wanted to sell this asset
        token_buy: {
          type: "ETH", // Or 'ERC20' if it's another currency
          data: {
            decimals: 18, // decimals used by the token
          },
        },

        // The asset being sold
        token_sell: {
          type: "ERC721",
          data: {
            // The collection address of this asset
            token_address: tokenDetails.data.token_address,

            // The ID of this asset
            token_id: tokenDetails.data.token_id, //eg: 117 i.e NFT ID
          },
        },

        // The ETH address of the L1 Wallet
        user: l1Address,
      };

      // Call the createOrderWithSigner method exposed by the Workflow class
      const response = await coreSdkWorkflows.createOrderWithSigner(
        walletConnection,
        orderParameters
      );

      // This will log the response specified in this API: https://docs.x.immutable.com/reference/#/operations/createOrder
      console.log("order created: ", response);
    }
  };

  // Cancel Order
  // i.e. Cancel Sell
  const cancelOrder = async () => {
    if (walletConnection) {
      // Only ID of the order is required
      const orderId = 142417;
      const requestParams = {
        order_id: orderId, // order ID here
      };

      // Execute
      const cancelResponse = await coreSdkWorkflows.cancelOrderWithSigner(
        walletConnection,
        requestParams
      );
      // Print the result, see: https://docs.x.immutable.com/reference#/operations/cancelOrder
      console.log("order cancelled: ", cancelResponse); //{ "order_id": 0,"status": "string" }
    }
  };

  // Buy another nft: 47 with order id 142412
  const buyOrder = async () => {
    if (walletConnection) {
      const orderId = 142412;

      const tradeRequest: GetSignableTradeRequest = {
        order_id: orderId,
        user: l1Address,
      };
      // call the workflow method. This method will call https://docs.x.immutable.com/reference/#/operations/createTrade
      await coreSdkWorkflows
        .createTradeWithSigner(walletConnection, tradeRequest)
        .then((res) => {
          console.log("Trade successful!", res);
        })
        .catch((err) => {
          console.log("Trade unsuccessful!", err);
        });
    }
  };

  /** Withdraw NFT **/

  // Prepare for withdrawal
  const prepareWithdrawNFT = async () => {
    const tokenId = "47";
    if (walletConnection) {
      const withdrawRequest: PrepareWithdrawalRequest = {
        token: {
          type: TokenType.ERC721,
          data: {
            tokenId: tokenId,
            tokenAddress: collectionAddress,
          },
        },
        quantity: ethers.utils.parseEther("0.0001").toString(),
      };

      await coreSdkWorkflows
        .prepareWithdrawalWithSigner(walletConnection, withdrawRequest)
        .then((res) => {
          console.log("Withdraw NFT successfully added to queue.", res);
        })
        .catch((err) => {
          console.log("Withdraw unsuccessful!", err);
        });
    }
  };

  // Complete Withdrawal
  const completeWithdrawNFT = async () => {
    const tokenId = "47";
    if (l1Signer) {
      const token: ERC721Withdrawal = {
        type: TokenType.ERC721,
        data: {
          tokenId: tokenId,
          tokenAddress: collectionAddress,
        },
      };

      await coreSdkWorkflows
        .completeERC721Withdrawal(l1Signer, l2Address, token)
        .then((res) => {
          console.log("Withdraw NFT successful", res);
        })
        .catch((err) => {
          console.log("Withdraw unsuccessful!", err);
        });
    }
  };

  /** withdraw money from wallet **/

  // Prepare for withdrawal
  const prepareWithdraw = async () => {
    if (walletConnection) {
      const withdrawRequest: PrepareWithdrawalRequest = {
        token: {
          type: TokenType.ETH,
          data: {
            decimals: 18,
          },
        },
        quantity: ethers.utils.parseEther("0.0001").toString(),
      };

      await coreSdkWorkflows
        .prepareWithdrawalWithSigner(walletConnection, withdrawRequest)
        .then((res) => {
          console.log("Withdraw successfully added to queue.", res);
        })
        .catch((err) => {
          console.log("Withdraw unsuccessful!", err);
        });
    }
  };

  // Complete Withdrawal
  const completeWithdraw = async () => {
    if (l1Signer) {
      await coreSdkWorkflows
        .completeEthWithdrawal(l1Signer, l2Address)
        .then((res) => {
          console.log("Withdraw successful", res);
        })
        .catch((err) => {
          console.log("Withdraw unsuccessful!", err);
        });
    }
  };

  // Transaction history
  const transactionHistory = async () => {
    /* APIs to call and merge
     * https://api.ropsten.x.immutable.com/v1/orders?include_fees=true&status=filled&user=0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239
     * https://api.ropsten.x.immutable.com/v1/deposits?status=success&user=0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239
     * https://api.ropsten.x.immutable.com/v1/withdrawals?status=success&user=0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239
     * https://api.ropsten.x.immutable.com/v1/transfers?receiver=0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239&status=success
     * https://api.ropsten.x.immutable.com/v2/exchanges?wallet_address=0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239
     * https://api.ropsten.x.immutable.com/v1/transfers?status=success&user=0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239
     */
    const userAddress = l1Address; //user wallet address //test use 0xc4ee25ea692c62eb642f4a68f784fd4e5cd9e239

    const ordersApi = new OrdersApi(config.api);
    const depositsApi = new DepositsApi(config.api);
    const withdrawalsApi = new WithdrawalsApi(config.api);
    const transfersApi = new TransfersApi(config.api);

    const ordersHistory = await ordersApi.listOrders({
      includeFees: true,
      status: "filled",
      user: userAddress,
    });

    const depositsHistory = await depositsApi.listDeposits({
      status: "success",
      user: userAddress,
    });

    const withdrawalsHistory = await withdrawalsApi.listWithdrawals({
      status: "success",
      user: userAddress,
    });

    const transfersOutHistory = await transfersApi.listTransfers({
      receiver: userAddress,
      status: "success",
    });

    const transfersInHistory = await transfersApi.listTransfers({
      status: "success",
      user: userAddress,
    });

    const history = merge(
      ordersHistory,
      depositsHistory,
      withdrawalsHistory,
      transfersOutHistory,
      transfersInHistory
    );
    console.log("Transaction history", history);
  };

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
                <button onClick={deposit}>
                  Deposit 0.0001 ETH from L1 wallet
                </button>
              </div>
            </div>

            <div className="label">Transaction History</div>
            <div className="profile-info">
              <div>
                <button onClick={transactionHistory}>Get History</button>
              </div>
            </div>

            <div className="label">Buy Order</div>
            <div className="profile-info">
              <div>
                <button onClick={buyOrder}>Buy NFT</button>
              </div>
            </div>

            <div className="label">Sell NFT Bought in Last Button</div>
            <div className="profile-info">
              <div>
                <button onClick={createOrder}>Sell NFT</button>
              </div>
            </div>

            <div className="label">Cancel Order (Cancel Sell)</div>
            <div className="profile-info">
              <div>
                <button onClick={cancelOrder}>Cancel Sell</button>
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
