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
  console.error('Get your token from: https://vercel.com/dashboard/[your-project]/storage');
  console.error('Then run: export BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."');
  process.exit(1);
}

const videosDir = path.join(__dirname, '..', 'public', 'videos', 'full');
const outputFile = path.join(__dirname, '..', 'blob-urls.json');

async function uploadVideos() {
  console.log('🚀 Starting video upload to Vercel Blob...\n');
  
  // Check if videos directory exists
  if (!fs.existsSync(videosDir)) {
    console.error(`❌ Videos directory not found: ${videosDir}`);
    process.exit(1);
  }

  // Get all video files
  const videoFiles = fs.readdirSync(videosDir).filter(file => 
    file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mov')
  );

  if (videoFiles.length === 0) {
    console.error('❌ No video files found in', videosDir);
    process.exit(1);
  }

  console.log(`📁 Found ${videoFiles.length} videos to upload\n`);

  const uploadedUrls = {};
  let uploadedCount = 0;
  let skippedCount = 0;

  // Check existing blobs
  try {
    const { blobs } = await list();
    const existingFiles = new Set(blobs.map(blob => blob.pathname));
    
    for (const fileName of videoFiles) {
      const blobPath = `videos/${fileName}`;
      
      // Skip if already uploaded
      if (existingFiles.has(blobPath)) {
        const existingBlob = blobs.find(b => b.pathname === blobPath);
        uploadedUrls[fileName] = existingBlob.url;
        console.log(`⏭️  Skipping ${fileName} (already uploaded)`);
        skippedCount++;
        continue;
      }

      console.log(`📤 Uploading ${fileName}...`);
      
      try {
        const filePath = path.join(videosDir, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        
        const blob = await put(blobPath, fileBuffer, {
          access: 'public',
          contentType: 'video/mp4',
        });
        
        uploadedUrls[fileName] = blob.url;
        uploadedCount++;
        console.log(`✅ Uploaded: ${blob.url}\n`);
      } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error listing existing blobs:', error.message);
    
    // If listing fails, try uploading all files
    for (const fileName of videoFiles) {
      console.log(`📤 Uploading ${fileName}...`);
      
      try {
        const filePath = path.join(videosDir, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        
        const blob = await put(`videos/${fileName}`, fileBuffer, {
          access: 'public',
          contentType: 'video/mp4',
        });
        
        uploadedUrls[fileName] = blob.url;
        uploadedCount++;
        console.log(`✅ Uploaded: ${blob.url}\n`);
      } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error.message);
      }
    }
  }

  // Save URLs to JSON file
  fs.writeFileSync(outputFile, JSON.stringify(uploadedUrls, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Upload Summary:');
  console.log(`✅ Uploaded: ${uploadedCount} videos`);
  console.log(`⏭️  Skipped: ${skippedCount} videos (already uploaded)`);
  console.log(`📁 URLs saved to: ${outputFile}`);
  console.log('='.repeat(50));
  
  if (uploadedCount > 0) {
    console.log('\n💡 Next steps:');
    console.log('1. Update your constants.ts to use blob-urls.json');
    console.log('2. Deploy to Vercel');
  }
}

// Run the upload
uploadVideos().catch(console.error);