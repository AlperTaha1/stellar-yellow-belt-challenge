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

let userPublicKey = "";


async function connectWallet() {
    try {
        await kit.openModal({
            onWalletSelected: async (option) => {
                try {
                    kit.setWallet(option.id);
                    const publicKey = await kit.getPublicKey();

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

sendPaymentButton.addEventListener('click', () => {
    paymentSection.style.display = paymentSection.style.display === "none" ? "flex" : "none";
});
[destinationInput, amountInput].forEach(el => {
    el.addEventListener('input', () => {
        confirmButton.disabled = !(destinationInput.value && amountInput.value);
        confirmButton.className = confirmButton.disabled ? 'btn btn-disabled' : 'btn btn-enabled';
    });
});
fundWalletButton.addEventListener('click', fundWallet);
confirmButton.addEventListener('click', sendPayment);
showBalanceButton.addEventListener('click', showBalance);
connectButton.addEventListener('click', connectWallet);
disconnectButton.addEventListener('click', disconnectWallet);