const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');

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

// Helper function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const username = await getInput('Enter username: ');
    const baseMessage = await getInput('Enter message: ');
    const appendRandomInput = await getInput('Append random strings? [Y/N]: ');
    const appendRandom = appendRandomInput.toUpperCase() === 'Y';

    rl.close();

    console.log(`Starting loop for username: ${username}`);
    console.log(`Base message: ${baseMessage}`);
    console.log(`Append random: ${appendRandom ? 'Yes' : 'No'}`);

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
        const cookie = `test=${encodeURIComponent(JSON.stringify(cookieObj))}`;

        let message = baseMessage;
        let randomStr = '';
        if (appendRandom) {
            randomStr = Math.random().toString(36);
            message += ` ${randomStr}`;
        }

        const payload = `username=${encodeURIComponent(username)}&question=${encodeURIComponent(message)}&deviceId=${deviceId}&gameSlug=&referrer=`;

        const headers = {
            'Host': 'ngl.link',
            'Cookie': cookie,
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Not_A Brand";v="99", "Chromium";v="142"',
            'Sec-Ch-Ua-Mobile': '?0',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
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

        console.log(`\n--- Sending request ---`);
        console.log(`Device ID: ${deviceId}`);
        console.log(`Message: "${message}"${appendRandom ? ` (appended: ${randomStr})` : ''}`);

        try {
            const response = await axios.post('https://ngl.link/api/submit', payload, { headers });
            console.log(`Response status: ${response.status}`);
            console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.warn(`\n[!] Rate limited (429). Sleeping for 30 seconds...`);
                await sleep(30000);
            } else {
                console.error(`Error sending request: ${error.message}`);
                if (error.response) {
                    console.error(`Response status: ${error.response.status}`);
                }
            }
        }
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
