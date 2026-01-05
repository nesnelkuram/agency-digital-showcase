# Agency Digital Showcase

Digital agency website with Brand Strategy Wizard and 3D interactive elements.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in `.env.local`:
   ```env
   RESEND_API_KEY=your_resend_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173

## Features

- 🎯 Brand Strategy Wizard with multi-stage decision tree
- 📧 Email report delivery via Resend API
- 🎨 Interactive 3D phone grid with parallax effects
- 📱 Fully responsive mobile-first design

## Deployment

Deployed on Vercel. Make sure to set `RESEND_API_KEY` in environment variables.

### Testing

Visit `/test-api.html` to test the email API endpoints.
