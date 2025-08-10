#!/usr/bin/env node

import { put, list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for token
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is required');
  process.exit(1);
}

async function uploadAllVideos() {
  console.log('🚀 Uploading ALL videos to Vercel Blob...\n');
  
  const uploadedUrls = {};
  let totalUploaded = 0;
  let totalSkipped = 0;

  // Get existing blobs
  let existingFiles = new Set();
  try {
    const { blobs } = await list();
    existingFiles = new Set(blobs.map(blob => blob.pathname));
  } catch (error) {
    console.log('Warning: Could not list existing blobs');
  }

  // Upload from both directories
  const directories = [
    { path: path.join(__dirname, '..', 'public', 'videos', 'full'), prefix: 'full' },
    { path: path.join(__dirname, '..', 'public', 'videos', 'preview'), prefix: 'preview' }
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir.path)) {
      console.log(`⚠️  Directory not found: ${dir.path}`);
      continue;
    }

    const files = fs.readdirSync(dir.path).filter(file => 
      file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mov')
    );

    console.log(`\n📁 Found ${files.length} videos in ${dir.prefix} folder`);

    for (const fileName of files) {
      const blobPath = `videos/${dir.prefix}/${fileName}`;
      
      // Skip if already uploaded
      if (existingFiles.has(blobPath)) {
        console.log(`⏭️  Skipping ${dir.prefix}/${fileName} (already uploaded)`);
        totalSkipped++;
        continue;
      }

      console.log(`📤 Uploading ${dir.prefix}/${fileName}...`);
      
      try {
        const filePath = path.join(dir.path, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        
        const blob = await put(blobPath, fileBuffer, {
          access: 'public',
          contentType: 'video/mp4',
        });
        
        // Store URL with directory prefix
        const key = `${dir.prefix}/${fileName}`;
        uploadedUrls[key] = blob.url;
        totalUploaded++;
        console.log(`✅ Uploaded: ${blob.url}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error.message);
      }
    }
  }

  // Get all blob URLs (including previously uploaded)
  try {
    const { blobs } = await list();
    const allUrls = {};
    
    blobs.forEach(blob => {
      if (blob.pathname.startsWith('videos/')) {
        // Remove 'videos/' prefix for key
        const key = blob.pathname.replace('videos/', '');
        allUrls[key] = blob.url;
      }
    });

    // Save all URLs to JSON
    const outputFile = path.join(__dirname, '..', 'all-blob-urls.json');
    fs.writeFileSync(outputFile, JSON.stringify(allUrls, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Upload Summary:');
    console.log(`✅ Uploaded: ${totalUploaded} videos`);
    console.log(`⏭️  Skipped: ${totalSkipped} videos`);
    console.log(`📁 Total URLs saved: ${Object.keys(allUrls).length}`);
    console.log(`💾 Saved to: ${outputFile}`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Error saving URLs:', error);
  }
}

// Run the upload
uploadAllVideos().catch(console.error);