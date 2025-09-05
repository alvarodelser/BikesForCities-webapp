 🚀 Step 9 — Deployment Guide (React + Vite App)
🎯 Goal
Publish your React frontend to the web in a reliable, fast, and professional way — so others (including your academic supervisors, collaborators, or civic tech stakeholders) can access it live.
This step will teach you:
How to build your frontend for production
How to deploy it using platforms like Vercel, Netlify, or GitHub Pages
How to handle environment variables
How to connect your app to a backend running on another domain (CORS, proxies, etc.)
🧱 1. Build the Production App
When you’re ready to deploy:
npm run build
Vite creates a /dist folder with:
Optimized, minified JavaScript
Bundled CSS
Indexed HTML
You can preview the build locally:
npm run preview
☁️ 2. Hosting Options
Platform	Best For
Vercel	Fastest setup, built for frontend frameworks
Netlify	Great CI/CD, good for static sites
GitHub Pages	OK for demos; limited SPA support
Render	Great if you’re hosting FastAPI there too
We’ll walk through Vercel (recommended) and Netlify.
🚀 3. Deploying with Vercel (Recommended)
✅ Step-by-Step:
Push your frontend code to GitHub
Go to vercel.com and log in with GitHub
Click “New Project” → select your repo
Vercel auto-detects your project as a Vite + React app
Confirm the defaults:
Build command: vite build or npm run build
Output directory: dist
Click Deploy
That’s it — your app is live. You get:
A live URL (e.g., https://your-project.vercel.app)
Automatic re-deploys on every push to main
🌐 4. Setting Up Environment Variables
If you use different API URLs for dev and prod:
// vite.config.ts
export default defineConfig({
  define: {
    __API_BASE__: JSON.stringify(process.env.API_BASE),
  }
});
Then:
In Vercel → Project Settings → Environment Variables
Set API_BASE=https://api.yourdomain.com
Access it in code:
const API_URL = import.meta.env.VITE_API_BASE;
And in .env:
VITE_API_BASE=http://localhost:8000
⚠️ Prefix with VITE_ for Vite to expose it to the frontend.
🌍 5. CORS (Cross-Origin Resource Sharing)
If your backend (e.g. FastAPI) is on another domain, you must allow frontend requests.
✅ FastAPI CORS middleware:
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
This ensures your frontend can fetch data after deployment.
📦 6. Deploying with Netlify (Alternative)
Push to GitHub
Go to netlify.com
Connect your repo → Set build command npm run build, output folder dist
Deploy!
You can also use the Netlify CLI:
npm install -g netlify-cli
netlify deploy
🧪 7. Testing Your Deployment
Confirm your map and charts load correctly
Test with slow network (Chrome DevTools → “Slow 3G”)
Check mobile responsiveness
Verify that API calls work (inspect network tab for 200s)
Share the live link with stakeholders!
📘 Summary
Task	Command / Action
Build project	npm run build
Preview build	npm run preview
Deploy to Vercel	Login → New Project → GitHub → Deploy
Set env vars	VITE_ prefixed + Vercel settings
CORS backend fix	Use CORSMiddleware in FastAPI
Auto-redeploy	Push to main triggers rebuild
🎓 Academic Use Case
Having a live deployment means:
You can include a working demo URL in your paper or presentation
Reviewers can interact with the project directly
You can share it with government stakeholders or open data communities
✅ Final Touches
Optional Enhancement	Why Add It
Custom domain	Looks more professional
Metadata/SEO	Better discoverability
Google Analytics	Track visits from cities or institutions
Lighthouse scores	Improve performance & accessibility
