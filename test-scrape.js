const https = require('https');

async function fetchJSON(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                'User-Agent': 'Walmart/25.1 (iPhone; iOS 17.2; Scale/3.00)',
                'Accept': 'application/json',
                ...headers,
            },
        };
        const req = https.get(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`  Redirect ${res.statusCode} -> ${res.headers.location}`);
                return resolve({ status: res.statusCode, data: '', redirect: res.headers.location });
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

(async () => {
    const apis = [
        // Mobile API endpoints
        ['https://mobile.walmart.com/store/1', {}],
        ['https://api.walmart.com/store/1', {}],
        // Google Places-style lookup
        ['https://maps.googleapis.com/maps/api/place/textsearch/json?query=Walmart+Supercenter+Rogers+AR&key=test', {}],
        // Try Walmart's Affil API (no auth needed for store lookup)
        ['https://developer.api.walmart.com/api-proxy/service/affil/product/v2/stores?zip=72756', {}],
        // Try the open data approach - Walmart's store data on data.world or similar
    ];

    for (const [url, headers] of apis) {
        console.log(`\n--- ${url.slice(0, 100)} ---`);
        try {
            const result = await fetchJSON(url, headers);
            console.log(`Status: ${result.status}`);
            if (result.headers) console.log(`Content-Type: ${result.headers['content-type']}`);
            if (result.data) {
                const preview = result.data.slice(0, 800);
                if (result.data.includes('phone') || result.data.includes('Phone')) {
                    console.log('*** CONTAINS PHONE DATA ***');
                }
                console.log(`Data: ${preview}`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
})();
