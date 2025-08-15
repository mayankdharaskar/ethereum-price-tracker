document.addEventListener('DOMContentLoaded', () => {
    const apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,inr';

    const ethPriceUSD = document.getElementById('ethPriceUSD');
    const ethPriceINR = document.getElementById('ethPriceINR');
    const countdownElement = document.getElementById('countdown');
    const lastUpdatedElement = document.getElementById('lastUpdated');

    let countdown = 10; // seconds
    let lastUSDPrice = null;
    let lastINRPrice = null;

    const fetchEthereumPrice = async () => {
        try {
            const response = await axios.get(apiUrl);
            const priceUSD = response.data.ethereum.usd;
            const priceINR = response.data.ethereum.inr;

            // Change color based on price movement
            if (lastUSDPrice !== null) {
                ethPriceUSD.style.color = priceUSD > lastUSDPrice ? '#00ff9d' : '#ff4d4d';
            }
            if (lastINRPrice !== null) {
                ethPriceINR.style.color = priceINR > lastINRPrice ? '#ffd700' : '#ff4d4d';
            }

            lastUSDPrice = priceUSD;
            lastINRPrice = priceINR;

            ethPriceUSD.textContent = `$${priceUSD}`;
            ethPriceINR.textContent = `₹${priceINR.toLocaleString('en-IN')}`;
            lastUpdatedElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        } catch (error) {
            ethPriceUSD.textContent = 'Failed to load';
            ethPriceINR.textContent = '';
            lastUpdatedElement.textContent = '';
            console.error('Error fetching Ethereum price:', error);
        }
    };

    const startCountdown = () => {
        setInterval(() => {
            countdown--;
            countdownElement.textContent = `Next update in: ${countdown}s`;

            if (countdown === 0) {
                fetchEthereumPrice();
                countdown = 10;
            }
        }, 1000);
    };

    fetchEthereumPrice();
    startCountdown();
});