# Vercel Blob Storage Setup Guide

## 1. Get Your Blob Token

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project (`agency-digital-showcase`)
3. Navigate to the "Storage" tab
4. Click "Connect Store" and select "Blob"
5. Create a new Blob store or select existing one
6. Go to the Blob store settings
7. Copy your `BLOB_READ_WRITE_TOKEN` (starts with `vercel_blob_rw_`)

## 2. Set Environment Variables

### For Local Development:
Add to `.env.local`:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxxx
```

### For Vercel Deployment:
1. Go to Project Settings → Environment Variables
2. Add `BLOB_READ_WRITE_TOKEN` with your token value
3. Apply to Production, Preview, and Development environments

## 3. Upload Videos to Blob

### Option A: Manual Upload via Dashboard
1. Go to Storage → Your Blob Store
2. Click "Upload" button
3. Select your video files from `public/videos/full/`
4. Wait for upload to complete

### Option B: Script Upload (Recommended)
```bash
# Set token for script
export BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxxxxx"

# Run upload script
node scripts/upload-videos-to-blob.mjs
```

The script will:
- Upload all videos from `public/videos/full/`
- Skip already uploaded videos
- Generate `blob-urls.json` with all URLs
- Show upload progress and summary

## 4. Use Blob Headers in Your App

Update your `App.tsx`:
```tsx
// Replace the old Header import
import BlobHeader from './components/BlobHeader';

// Use BlobHeader instead of Header or Header3D
<BlobHeader />
```

## 5. Deploy to Vercel

```bash
# Build and deploy
npm run build
vercel --prod
```

## Video Storage Structure

- **Preview videos** (small): Stay in `public/videos/preview/` for fast initial load
- **Full videos** (large): Uploaded to Vercel Blob for CDN delivery
- **Fallback**: If blob URLs not available, falls back to local files

## Costs

- Storage: $0.023/GB/month
- Bandwidth: $0.050/GB
- Free tier: 1GB storage + 10GB transfer (Hobby plan)

## Troubleshooting

### "BLOB_READ_WRITE_TOKEN not found"
- Make sure you've set the environment variable
- For local: Check `.env.local` file
- For Vercel: Check project environment variables

### Videos not loading
- Check browser console for errors
- Verify blob URLs in `blob-urls.json`
- Check Vercel Blob dashboard for uploaded files

### Upload script fails
- Verify your token is correct
- Check internet connection
- Ensure video files exist in `public/videos/full/`

## Benefits

✅ No more 837MB in your git repo
✅ Global CDN delivery
✅ Automatic caching
✅ Better performance on Vercel
✅ Cost-effective for video hosting