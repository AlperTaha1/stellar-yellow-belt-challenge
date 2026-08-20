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
                    const walletResponse = await kit.getAddress();

                    // KRİTİK ÇÖZÜM: Gelen veri obje ise içindeki 'address'i al, metinse direkt kullan
                    userPublicKey = typeof walletResponse === 'string' ? walletResponse : walletResponse.address;

                    connectButton.textContent = "Wallet Connected";
                    connectButton.style.backgroundColor = "#10b981";
                    connectButton.style.color = "#12141d";

                    // Artık elimizde saf string olduğu için substring sorunsuz çalışacak
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

// Kendi sözleşme adresimizi tanımlıyoruz
const CONTRACT_ID = 'CBUIFCRLVKNGIVWIRJYZ3G75VJJIMIDITJUGIQA5IKPAMJJ7ABOJLCIZ';

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
        placeBidButton.textContent = "Submitting to Contract...";
        placeBidButton.disabled = true;

        // 1. Soroban RPC Sunucusuna Bağlan (Akıllı Sözleşmeler için)
        const server = new window.StellarSdk.SorobanRpc.Server('https://soroban-testnet.stellar.org:443');
        const account = await server.getAccount(userPublicKey);

        // 2. Sözleşmeyi ve içindeki 'place_bid' fonksiyonunu çağır
        const contract = new window.StellarSdk.Contract(CONTRACT_ID);
        const operation = contract.call(
            "place_bid",
            new window.StellarSdk.Address(userPublicKey).toScVal(),
            window.StellarSdk.nativeToScVal(bidVal, { type: "u32" })
        );

        let transaction = new window.StellarSdk.TransactionBuilder(account, {
            fee: "10000",
            networkPassphrase: window.StellarSdk.Networks.TESTNET
        })
            .addOperation(operation)
            .setTimeout(30)
            .build();

        // 3. Soroban için işlemi hazırla (Gaz ücretleri ve kaynak hesaplaması)
        transaction = await server.prepareTransaction(transaction);

        // 4. Cüzdan ile imzala
        const signResponse = await kit.signTransaction(transaction.toXDR(), { network: 'TESTNET' });
        const signedXdr = typeof signResponse === 'string' ? signResponse : signResponse.signedXDR;
        const transactionToSubmit = window.StellarSdk.TransactionBuilder.fromXDR(signedXdr, window.StellarSdk.Networks.TESTNET);

        // 5. Ağa gönder
        const response = await server.sendTransaction(transactionToSubmit);

        alert("Awesome! Bid placed on Smart Contract!\nStatus: " + response.status);

        // Arayüzü güncelle
        currentHighestBid = bidVal;
        highestBidDisplay.textContent = `${currentHighestBid} XLM`;
        highestBidderDisplay.textContent = `${userPublicKey.substring(0, 6)}...${userPublicKey.substring(userPublicKey.length - 4)}`;

        bidAmountInput.value = '';
        showBalance();

    } catch (error) {
        console.error("Contract call error:", error);
        alert("Contract Transaction Failed!");
    } finally {
        placeBidButton.disabled = true;
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