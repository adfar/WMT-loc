// Walmart Store Locator App

document.addEventListener('DOMContentLoaded', () => {
    const storeNumberInput = document.getElementById('storeNumber');
    const searchBtn = document.getElementById('searchBtn');
    const resultsSection = document.getElementById('results');
    const errorSection = document.getElementById('error');
    const loadingSection = document.getElementById('loading');
    const storeCountEl = document.getElementById('storeCount');

    // Display store count
    if (typeof STORES !== 'undefined') {
        storeCountEl.textContent = `${Object.keys(STORES).length} stores in database`;
    }

    // Search function
    function searchStore() {
        const storeNumber = storeNumberInput.value.trim();

        // Hide all sections
        resultsSection.classList.add('hidden');
        errorSection.classList.add('hidden');
        loadingSection.classList.add('hidden');

        // Validate input
        if (!storeNumber) {
            showError('Please enter a store number');
            return;
        }

        if (!/^\d+$/.test(storeNumber)) {
            showError('Please enter a valid store number (numbers only)');
            return;
        }

        // Show loading
        loadingSection.classList.remove('hidden');

        // Simulate small delay for UX
        setTimeout(() => {
            loadingSection.classList.add('hidden');

            // Look up store
            if (typeof STORES === 'undefined') {
                showError('Store database not loaded. Please refresh the page.');
                return;
            }

            const store = STORES[storeNumber];

            if (store) {
                displayStore(store);
            } else {
                showError(`Store #${storeNumber} not found in database. The store may not exist or hasn't been added yet.`);
            }
        }, 300);
    }

    // Display store information
    function displayStore(store) {
        document.getElementById('storeName').textContent = store.name;
        document.getElementById('storeType').textContent = store.type;
        document.getElementById('storeNum').textContent = store.number;
        document.getElementById('storeAddress').textContent = store.address;
        document.getElementById('storeCity').textContent = store.city;
        document.getElementById('storeState').textContent = store.state;

        const phoneEl = document.getElementById('storePhone');
        if (store.phone) {
            phoneEl.textContent = store.phone;
            phoneEl.href = `tel:${store.phone.replace(/\D/g, '')}`;
            phoneEl.style.display = '';
        } else {
            phoneEl.textContent = 'Phone not available';
            phoneEl.href = '#';
            phoneEl.style.pointerEvents = 'none';
        }

        // Google Maps directions link
        const addressQuery = encodeURIComponent(`${store.address}, ${store.city}, ${store.state}`);
        document.getElementById('directionsLink').href = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;

        // Walmart.com link
        document.getElementById('walmartLink').href = `https://www.walmart.com/store/${store.number}`;

        resultsSection.classList.remove('hidden');
    }

    // Show error message
    function showError(message) {
        document.getElementById('errorMessage').textContent = message;
        errorSection.classList.remove('hidden');
    }

    // Event listeners
    searchBtn.addEventListener('click', searchStore);

    storeNumberInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchStore();
        }
    });

    // Focus input on load
    storeNumberInput.focus();
});
