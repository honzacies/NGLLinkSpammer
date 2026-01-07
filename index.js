const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');

puppeteerExtra.use(StealthPlugin());

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getInput(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function main() {
    const username = await getInput('Enter username: ');
    const baseMessage = await getInput('Enter message: ');
    const appendRandomInput = await getInput('Append random strings? [Y/N]: ');
    const appendRandom = appendRandomInput.toUpperCase() === 'Y';

    rl.close();

    console.log(`Starting for username: ${username}`);
    console.log(`Base message: ${baseMessage}`);
    console.log(`Append random: ${appendRandom ? 'Yes' : 'No'}`);

    const browser = await puppeteerExtra.launch({
        headless: true, // Set to false for debugging
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        ]
    });

    let page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to pass initial challenge and get clearance
    console.log('Navigating to pass Cloudflare challenge...');
    try {
        await page.goto(`https://ngl.link/${username}`, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for challenge to resolve if any
    } catch (err) {
        console.error('Initial navigation failed:', err);
    }

    let requestCount = 0;
    while (true) {
        const deviceId = uuidv4();
        const cookieObj = {
            "distinct_id": `$device:${deviceId}`,
            "$device_id": deviceId,
            "$initial_referrer": "$direct",
            "$initial_referring_domain": "$direct",
            "__mps": {},
            "__mpso": {
                "$initial_referrer": "$direct",
                "$initial_referring_domain": "$direct"
            },
            "__mpus": {},
            "__mpa": {},
            "__mpu": {},
            "__mpr": [],
            "__mpap": []
        };
        const testCookie = `test=${encodeURIComponent(JSON.stringify(cookieObj))}`;

        // Set custom cookies
        await page.setCookie({
            name: 'test',
            value: encodeURIComponent(JSON.stringify(cookieObj)),
            domain: 'ngl.link',
            path: '/',
            httpOnly: false,
            secure: true
        });

        let message = baseMessage;
        let randomStr = '';
        if (appendRandom) {
            randomStr = Math.random().toString(12);
            message += ` ${randomStr}`;
        }

        const payload = `username=${encodeURIComponent(username)}&question=${encodeURIComponent(message)}&deviceId=${deviceId}&gameSlug=&referrer=`;

        const headers = {
            'Host': 'ngl.link',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Not_A Brand";v="99", "Chromium";v="142"',
            'Sec-Ch-Ua-Mobile': '?0',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://ngl.link',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Referer': `https://ngl.link/${username}`,
            'Accept-Encoding': 'gzip, deflate, br',
            'Priority': 'u=1, i'
        };

        console.log(`\n--- Sending request #${++requestCount} ---`);
        console.log(`Device ID: ${deviceId}`);
        console.log(`Message: "${message}"${appendRandom ? ` (appended: ${randomStr})` : ''}`);
        console.log(`Payload length: ${payload.length}`);
        console.log(`Cookie: ${testCookie}`);

        let attempts = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                const response = await page.evaluate(async (url, payload, headers) => {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: payload,
                        credentials: 'include'
                    });
                    const text = await res.text();
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch {
                        data = text;
                    }
                    return { status: res.status, data, headers: Object.fromEntries(res.headers) };
                }, 'https://ngl.link/api/submit', payload, headers);

                if (typeof response.data === 'string' && response.data.includes('Just a moment')) {
                    console.log(`Challenge detected on attempt ${attempts}. Solving...`);
                    // Load the challenge HTML into the page to execute the JS and obtain clearance
                    await page.setContent(response.data, { waitUntil: 'networkidle2', timeout: 60000 });
                    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for challenge JS to execute and set cookies
                    console.log('Challenge solved, retrying request...');
                    continue; // Retry the request
                }

                console.log(`Response status: ${response.status}`);
                console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
                success = true;
            } catch (error) {
                console.error(`Error on attempt ${attempts}: ${error.message}`);
                if (attempts < maxAttempts) {
                    console.log('Refreshing page to renew clearance...');
                    await page.goto(`https://ngl.link/${username}`, { waitUntil: 'networkidle2', timeout: 60000 });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        if (!success) {
            console.error('Failed after max attempts. Skipping to next.');
        }

        // Random delay 10-30s
        const delay = Math.floor(Math.random() * 10);
        console.log(`Waiting ${delay / 1000}s before next...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Renew context every 10 requests
        if (requestCount % 10 === 0) {
            console.log('Renewing browser context...');
            await page.close();
            page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(`https://ngl.link/${username}`, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main().catch(async (error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});