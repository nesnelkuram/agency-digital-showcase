import https from 'https';
import http from 'http';

const baseUrl = 'https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com';
const folders = ['preview', 'full'];

function testUrl(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const req = client.request(url, { method: 'HEAD' }, (res) => {
            resolve({ url, status: res.statusCode, accessible: res.statusCode >= 200 && res.statusCode < 300 });
        });
        
        req.on('error', (error) => {
            resolve({ url, status: 'ERROR', accessible: false, error: error.message });
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ url, status: 'TIMEOUT', accessible: false });
        });
        
        req.end();
    });
}

async function testAdditionalPatterns() {
    console.log('Testing additional patterns...');
    
    const patterns = [];
    
    // Test numbers without zero padding
    for (const folder of folders) {
        for (let i = 10; i <= 12; i++) {
            patterns.push(`${baseUrl}/videos/${folder}/${i}.mp4`);
        }
    }
    
    // Test other potential formats
    for (const folder of folders) {
        patterns.push(`${baseUrl}/videos/${folder}/10.mp4`);
        patterns.push(`${baseUrl}/videos/${folder}/11.mp4`);
        patterns.push(`${baseUrl}/videos/${folder}/12.mp4`);
        patterns.push(`${baseUrl}/videos/${folder}/010.mp4`);
        patterns.push(`${baseUrl}/videos/${folder}/011.mp4`);
        patterns.push(`${baseUrl}/videos/${folder}/012.mp4`);
    }
    
    const additionalVideos = { preview: [], full: [] };
    
    for (const url of patterns) {
        const result = await testUrl(url);
        console.log(`Testing ${url}... ${result.accessible ? '✓ FOUND' : '✗ Not found'} (${result.status})`);
        
        if (result.accessible) {
            const folder = url.includes('/preview/') ? 'preview' : 'full';
            if (!additionalVideos[folder].includes(url)) {
                additionalVideos[folder].push(url);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\nAdditional videos found:');
    console.log(JSON.stringify(additionalVideos, null, 2));
    
    return additionalVideos;
}

testAdditionalPatterns().catch(console.error);