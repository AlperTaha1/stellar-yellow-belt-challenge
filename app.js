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
        if (await window.freighterApi.isConnected()) {
            const publicKey = await window.freighterApi.getPublicKey();

            if (publicKey) {
                userPublicKey = publicKey;

                connectButton.textContent = "Wallet Connected";
                connectButton.style.backgroundColor = "#10b981";
                connectButton.style.color = "#12141d";

                console.log("Connected:", userPublicKey);
            }
        } else {
            alert("Freighter wallet not found. Please install the extension.");
        }
    } catch (error) {
        console.error("Connection error:", error);
        alert("Connection failed: " + error.message);
    }

    addressDisplay.textContent = `${userPublicKey.substring(0, 4)}...${userPublicKey.substring(userPublicKey.length - 4)}`;
    addressDisplay.style.display = "block";
    disconnectButton.style.display = "inline-block";
    fundWalletButton.style.display = "inline-block";
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

    console.log("Disconnected.");
    fundWalletButton.style.display = "none";
}

sendPaymentButton.addEventListener('click', () => {
    if (paymentSection.style.display === "none") {
        paymentSection.style.display = "flex";
        paymentSection.style.flexDirection = "column";
        sendPaymentButton.textContent = "Cancel";
        sendPaymentButton.classList.remove('btn-action');
        sendPaymentButton.classList.add('btn-secondary');
    } else {
        paymentSection.style.display = "none";
        sendPaymentButton.textContent = "Send Payment";
        sendPaymentButton.classList.remove('btn-secondary');
        sendPaymentButton.classList.add('btn-action');
    }
});

[destinationInput, amountInput].forEach(el => {
    el.addEventListener('input', () => {
        if (destinationInput.value.trim() && amountInput.value.trim()) {
            confirmButton.classList.add('btn-enabled');
            confirmButton.classList.remove('btn-disabled');
            confirmButton.disabled = false;
        } else {
            confirmButton.classList.add('btn-disabled');
            confirmButton.classList.remove('btn-enabled');
            confirmButton.disabled = true;
        }
    });
});



async function showBalance() {
    if (!userPublicKey) {
        alert("Please connect your wallet first!");
        return;
    }

    try {
        balanceDisplay.textContent = "Fetching balance...";

        const server = new window.StellarSdk.Server('https://horizon-testnet.stellar.org');
        const account = await server.loadAccount(userPublicKey);
        const xlmBalance = account.balances.find(b => b.asset_type === 'native');

        if (xlmBalance) {
            balanceDisplay.textContent = `${xlmBalance.balance} XLM`;
        } else {
            balanceDisplay.textContent = "0 XLM";
        }

    } catch (error) {
        console.error("Balance fetch error:", error);

        if (error.response && error.response.status === 404) {
             balanceDisplay.textContent = "Account not funded on Testnet.";
        } else {
             balanceDisplay.textContent = "Failed to fetch balance.";
        }
    }
}

async function fundWallet() {
    if (!userPublicKey) return;

    try {
        fundWalletButton.textContent = "Funding...";
        fundWalletButton.disabled = true;
        fundWalletButton.classList.add('btn-disabled');

        const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(userPublicKey)}`);
        const responseJSON = await response.json();

        if (response.ok) {
            alert("Success! 10,000 Testnet XLM added to your wallet.");
            showBalance();
        } else {
            console.error("Faucet error:", responseJSON);
            alert("Error: Account may already be funded or network is busy.");
        }
    } catch (error) {
        console.error("Fetch error:", error);
        alert("Failed to reach the Faucet network.");
    } finally {
        fundWalletButton.textContent = "Get Test XLM (Faucet)";
        fundWalletButton.disabled = false;
        fundWalletButton.classList.remove('btn-disabled');
    }
}

async function sendPayment() {
    if (!userPublicKey) {
        alert("Please connect your wallet first!");
        return;
    }

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

        const signedXdr = await window.freighterApi.signTransaction(transaction.toXDR(), { network: 'TESTNET' });

        const transactionToSubmit = window.StellarSdk.TransactionBuilder.fromXDR(signedXdr, window.StellarSdk.Networks.TESTNET);
        const response = await server.submitTransaction(transactionToSubmit);

        console.log("Transaction successful!", response);
        alert("Payment sent successfully!\nHash: " + response.hash);

        destinationInput.value = '';
        amountInput.value = '';
        paymentSection.style.display = "none";
        sendPaymentButton.textContent = "Send Payment";
        sendPaymentButton.classList.remove('btn-secondary');
        sendPaymentButton.classList.add('btn-action');
        showBalance();

    } catch (error) {
        console.error("Payment error:", error);
        alert("Payment failed! Check console for details.");
    } finally {
        confirmButton.textContent = "Confirm Transaction";
        if (!destinationInput.value.trim() || !amountInput.value.trim()) {
            confirmButton.disabled = true;
            confirmButton.classList.add('btn-disabled');
            confirmButton.classList.remove('btn-enabled');
        }
    }
}



fundWalletButton.addEventListener('click', fundWallet);

confirmButton.addEventListener('click', sendPayment);
showBalanceButton.addEventListener('click', showBalance);
connectButton.addEventListener('click', connectWallet);
disconnectButton.addEventListener('click', disconnectWallet);