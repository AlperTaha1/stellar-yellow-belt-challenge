import { StellarWalletsKit, WalletNetwork, allowAllModules }
  from "https://esm.sh/@creit.tech/stellar-wallets-kit@1.9.5?bundle";

const kit = new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    modules: allowAllModules(),
});
const connectButton = document.getElementById('connectButton');
const showBalanceButton = document.getElementById('showBalanceButton');
const balanceDisplay = document.getElementById('balanceDisplay');
const sendPaymentButton = document.getElementById('sendPaymentButton');
const destinationInput = document.getElementById('destinationAddress');
const amountInput = document.getElementById('sendAmount');
const addressDisplay = document.getElementById('walletAddressDisplay');
const disconnectButton = document.getElementById('disconnectButton');
const paymentSection = document.getElementById('paymentSection');
const confirmButton = document.getElementById('confirmPaymentButton');
const fundWalletButton = document.getElementById('fundWalletButton');
const bidAmountInput = document.getElementById('bidAmountInput');
const placeBidButton = document.getElementById('placeBidButton');
const highestBidDisplay = document.getElementById('highestBid');
const highestBidderDisplay = document.getElementById('highestBidder');
const toggleAuctionButton = document.getElementById('toggleAuctionButton');
const auctionInteractiveSection = document.getElementById('auctionInteractiveSection');

let userPublicKey = "";
let currentHighestBid = 50;

bidAmountInput.addEventListener('input', () => {
    const val = parseFloat(bidAmountInput.value);
    if (val > currentHighestBid) {
        placeBidButton.disabled = false;
        placeBidButton.className = 'btn btn-enabled';
        placeBidButton.style.backgroundColor = '#10b981';
        placeBidButton.style.color = '#12141d';
    } else {
        placeBidButton.disabled = true;
        placeBidButton.className = 'btn btn-disabled';
        placeBidButton.style.backgroundColor = '';
        placeBidButton.style.color = '';
    }
});

async function connectWallet() {
    try {
        await kit.openModal({
            onWalletSelected: async (option) => {
                try {
                    kit.setWallet(option.id);
                    const publicKey = await kit.getAddress();

                    userPublicKey = publicKey;

                    connectButton.textContent = "Wallet Connected";
                    connectButton.style.backgroundColor = "#10b981";
                    connectButton.style.color = "#12141d";

                    addressDisplay.textContent = `${userPublicKey.substring(0, 4)}...${userPublicKey.substring(userPublicKey.length - 4)}`;
                    addressDisplay.style.display = "block";
                    disconnectButton.style.display = "inline-block";
                    fundWalletButton.style.display = "inline-block";
                } catch (error) {
                    console.error("Wallet connection rejected:", error);
                    alert("Error: Wallet connection rejected.");
                }
            }
        });
    } catch (error) {
        console.error("Modal error:", error);
    }
}

async function disconnectWallet() {
    userPublicKey = "";
    connectButton.textContent = "Connect Wallet";
    connectButton.style.backgroundColor = "";
    connectButton.style.color = "";
    disconnectButton.style.display = "none";
    addressDisplay.style.display = "none";
    balanceDisplay.textContent = "";
    paymentSection.style.display = "none";
    sendPaymentButton.style.display = "inline-block";
    sendPaymentButton.textContent = "Send Payment";
    sendPaymentButton.classList.remove('btn-secondary');
    sendPaymentButton.classList.add('btn-action');
    destinationInput.value = "";
    amountInput.value = "";
    confirmButton.classList.add('btn-disabled');
    confirmButton.classList.remove('btn-enabled');
    confirmButton.disabled = true;
    fundWalletButton.style.display = "none";
}

async function showBalance() {
    if (!userPublicKey) return alert("Please connect your wallet first!");
    try {
        balanceDisplay.textContent = "Fetching balance...";
        const server = new window.StellarSdk.Server('https://horizon-testnet.stellar.org');
        const account = await server.loadAccount(userPublicKey);
        const xlmBalance = account.balances.find(b => b.asset_type === 'native');
        balanceDisplay.textContent = xlmBalance ? `${xlmBalance.balance} XLM` : "0 XLM";
    } catch (error) {
        balanceDisplay.textContent = "Failed to fetch balance.";
    }
}

async function fundWallet() {
    if (!userPublicKey) return;
    try {
        fundWalletButton.textContent = "Funding...";
        fundWalletButton.disabled = true;
        const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(userPublicKey)}`);
        if (response.ok) {
            alert("Success! 10,000 Testnet XLM added.");
            showBalance();
        }
    } finally {
        fundWalletButton.textContent = "Get Test XLM (Faucet)";
        fundWalletButton.disabled = false;
    }
}

async function sendPayment() {
    if (!userPublicKey) return;
    const destination = destinationInput.value.trim();
    const amount = amountInput.value.trim();

    try {
        confirmButton.textContent = "Processing...";
        confirmButton.disabled = true;

        const server = new window.StellarSdk.Server('https://horizon-testnet.stellar.org');
        const account = await server.loadAccount(userPublicKey);

        const transaction = new window.StellarSdk.TransactionBuilder(account, {
            fee: window.StellarSdk.BASE_FEE,
            networkPassphrase: window.StellarSdk.Networks.TESTNET
        })
        .addOperation(window.StellarSdk.Operation.payment({
            destination: destination,
            asset: window.StellarSdk.Asset.native(),
            amount: amount
        }))
        .setTimeout(30)
        .build();

        const signResponse = await kit.signTransaction(transaction.toXDR(), { network: 'TESTNET' });
        const signedXdr = typeof signResponse === 'string' ? signResponse : signResponse.signedXDR;

        const transactionToSubmit = window.StellarSdk.TransactionBuilder.fromXDR(signedXdr, window.StellarSdk.Networks.TESTNET);
        const response = await server.submitTransaction(transactionToSubmit);

        alert("Payment sent successfully!\nHash: " + response.hash);
        paymentSection.style.display = "none";
        sendPaymentButton.style.display = "inline-block";
        showBalance();
    } catch (error) {
        alert("Transaction Failed!");
    } finally {
        confirmButton.textContent = "Confirm Transaction";
        confirmButton.disabled = false;
    }
}

async function placeBid() {
    if (!userPublicKey) {
        alert("Please connect your wallet first!");
        return;
    }

    const bidVal = parseFloat(bidAmountInput.value);
    if (bidVal <= currentHighestBid) {
        alert("Bid must be higher than current highest bid!");
        return;
    }

    try {
        placeBidButton.textContent = "Submitting Bid...";
        placeBidButton.disabled = true;

        const server = new window.StellarSdk.Server('https://horizon-testnet.stellar.org');
        const account = await server.loadAccount(userPublicKey);

        const transaction = new window.StellarSdk.TransactionBuilder(account, {
            fee: window.StellarSdk.BASE_FEE,
            networkPassphrase: window.StellarSdk.Networks.TESTNET
        })
        .addOperation(window.StellarSdk.Operation.payment({
            destination: userPublicKey,
            asset: window.StellarSdk.Asset.native(),
            amount: bidVal.toString()
        }))
        .setTimeout(30)
        .build();

        const signResponse = await kit.signTransaction(transaction.toXDR(), { network: 'TESTNET' });
        const signedXdr = typeof signResponse === 'string' ? signResponse : signResponse.signedXDR;

        const transactionToSubmit = window.StellarSdk.TransactionBuilder.fromXDR(signedXdr, window.StellarSdk.Networks.TESTNET);
        const response = await server.submitTransaction(transactionToSubmit);

        currentHighestBid = bidVal;
        highestBidDisplay.textContent = `${currentHighestBid} XLM`;
        highestBidderDisplay.textContent = `${userPublicKey.substring(0, 6)}...${userPublicKey.substring(userPublicKey.length - 4)}`;

        alert("Bid placed successfully on-chain!\nHash: " + response.hash);

        bidAmountInput.value = '';
        placeBidButton.disabled = true;
        placeBidButton.textContent = "Place Bid";
        showBalance();

    } catch (error) {
        console.error("Bid error:", error);
        alert("Transaction Failed or Rejected!");
        placeBidButton.disabled = false;
        placeBidButton.textContent = "Place Bid";
    }
}



[destinationInput, amountInput].forEach(el => {
    el.addEventListener('input', () => {
        confirmButton.disabled = !(destinationInput.value && amountInput.value);
        confirmButton.className = confirmButton.disabled ? 'btn btn-disabled' : 'btn btn-enabled';
    });
});

   toggleAuctionButton.addEventListener('click', () => {
       if (auctionInteractiveSection.style.display === "none") {
           auctionInteractiveSection.style.display = "flex";
           toggleAuctionButton.textContent = "Close Auction";
           toggleAuctionButton.classList.remove('btn-action');
           toggleAuctionButton.classList.add('btn-secondary');

           paymentSection.style.display = "none";
       } else {
           auctionInteractiveSection.style.display = "none";
           toggleAuctionButton.textContent = "Enter Auction";
           toggleAuctionButton.classList.remove('btn-secondary');
           toggleAuctionButton.classList.add('btn-action');
       }
   });

   sendPaymentButton.addEventListener('click', () => {
       if (paymentSection.style.display === "none") {
           paymentSection.style.display = "flex";
           paymentSection.style.flexDirection = "column";

           auctionInteractiveSection.style.display = "none";
           toggleAuctionButton.textContent = "Enter Auction";
           toggleAuctionButton.classList.remove('btn-secondary');
           toggleAuctionButton.classList.add('btn-action');
       } else {
           paymentSection.style.display = "none";
       }
   });

placeBidButton.addEventListener('click', placeBid);
fundWalletButton.addEventListener('click', fundWallet);
confirmButton.addEventListener('click', sendPayment);
showBalanceButton.addEventListener('click', showBalance);
connectButton.addEventListener('click', connectWallet);
disconnectButton.addEventListener('click', disconnectWallet);