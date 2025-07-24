
# Bikes for Cities – React Frontend Setup Tasks

This document outlines the **clear, actionable steps** to set up the React frontend development environment, beginning with the necessary directory restructuring.

---

## ✅ Phase 1: Directory Refactor

### Part 1: Comprehensive Directory Structure Refactoring Plan

This section provides a **meticulous, step-by-step refactoring plan** to rename `app/` to `backend/` and `Data/` to `data/` without breaking any import statements or dependencies.

#### 1.1 Critical Dependencies Analysis

**Files with `from app.` imports (15 files):**
- `scripts/plot_database.py` (2 imports)
- `scripts/populate_db.py` (2 imports) 
- `scripts/trip_ingestion.py` (2 imports)
- `scripts/database_summary.py` (1 import)
- `notebooks/test_reconstruction.ipynb` (2 imports)
- `app/api/routes.py` (1 import)
- `app/api/dependencies.py` (1 import)
- `app/processing/network_ops.py` (1 import)
- `app/processing/trip_loader.py` (1 import)
- `app/processing/visualization.py` (1 import)
- `notebooks/plot_db.ipynb` (3 imports)

**Files with `Data/` path references (8 files):**
- `notebooks/data_exploration.ipynb` (1 reference)
- `app/processing/trip_loader.py` (2 references)
- `docker-compose.yml` (1 reference)
- `Dockerfile` (1 reference)
- Documentation files (4 references)

**Files with `uvicorn app.api.main:app` references (4 files):**
- `docker-compose.yml` (1 reference)
- `Dockerfile` (1 reference)
- `docs/backend_specifications.md` (2 references)

#### 1.2 Step-by-Step Refactoring Process

**Step 1: Create Backup and Git Safety**
```bash
# 1. Create a backup branch
git checkout -b backup-before-refactor

# 2. Commit current state
git add .
git commit -m "Backup before directory refactoring"

# 3. Create refactor branch
git checkout -b refactor-directory-structure
```

**Step 2: Update Python Import Statements (BEFORE moving directories)**
```bash
# Use sed to replace all 'from app.' with 'from backend.' in Python files
find . -name "*.py" -exec sed -i '' 's/from app\./from backend./g' {} \;

# Update relative imports within the app directory
find app/ -name "*.py" -exec sed -i '' 's/from \.\./from ..\/..\/backend/g' {} \;
find app/ -name "*.py" -exec sed -i '' 's/from \./from ..\/backend/g' {} \;
```

**Step 3: Update Jupyter Notebooks**
```bash
# Update import statements in notebooks
find notebooks/ -name "*.ipynb" -exec sed -i '' 's/from app\./from backend./g' {} \;
```

**Step 4: Update Docker and Configuration Files**
```bash
# Update docker-compose.yml
sed -i '' 's/uvicorn app\.api\.main:app/uvicorn backend.api.main:app/g' docker-compose.yml
sed -i '' 's/\.\/Data:/\.\/data:/g' docker-compose.yml

# Update Dockerfile
sed -i '' 's/uvicorn app\.api\.main:app/uvicorn backend.api.main:app/g' Dockerfile
sed -i '' 's/\/app\/Data/\/app\/data/g' Dockerfile
```

**Step 5: Update Path References in Code**
```bash
# Update Data/ to data/ in Python files
find . -name "*.py" -exec sed -i '' 's/Data\//data\//g' {} \;
find . -name "*.py" -exec sed -i '' 's/"Data\//"data\//g' {} \;
find . -name "*.py" -exec sed -i '' 's/Data\//data\//g' {} \;

# Update notebooks
find notebooks/ -name "*.ipynb" -exec sed -i '' 's/Data\//data\//g' {} \;
```

**Step 6: Rename Directories**
```bash
# Rename app/ to backend/
mv app backend

# Rename Data/ to data/
mv Data data
```

**Step 7: Update Documentation Files**
```bash
# Update all documentation references
find . -name "*.md" -exec sed -i '' 's/app\//backend\//g' {} \;
find . -name "*.md" -exec sed -i '' 's/Data\//data\//g' {} \;
```

**Step 8: Update .gitignore**
```bash
# Update .gitignore to reflect new directory name
sed -i '' 's/Data\//data\//g' .gitignore
```

**Step 9: Test Import Resolution**
```bash
# Test that imports work from scripts directory
cd scripts
python -c "from backend.database.network_io import connect_db; print('Import successful')"

# Test from notebooks directory
cd ../notebooks
python -c "from backend.processing.visualization import *; print('Import successful')"
```

**Step 10: Update Requirements and Dependencies**
```bash
# If there are any setup.py or pyproject.toml files, update them
# Check if any scripts reference the old paths
grep -r "app/" . --exclude-dir=.git
grep -r "Data/" . --exclude-dir=.git
```

#### 1.3 Verification Steps

**After each step, verify:**
1. **Import Resolution**: All Python imports resolve correctly
2. **Docker Build**: Docker containers build without errors
3. **API Startup**: FastAPI application starts correctly
4. **Data Access**: Scripts can access data files
5. **Notebook Execution**: Jupyter notebooks run without import errors

**Final Verification Commands:**
```bash
# Test all imports
python -c "
from backend.api.main import app
from backend.database.network_io import connect_db
from backend.processing.trip_loader import load_graph
from backend.processing.visualization import generate_features_map
print('All imports successful')
"

# Test Docker build
docker-compose build

# Test API startup
docker-compose up backend -d
sleep 10
curl http://localhost:8000/docs
docker-compose down
```

#### 1.4 Rollback Plan

**If issues arise:**
```bash
# Rollback to backup branch
git checkout backup-before-refactor

# Or revert specific files
git checkout HEAD -- specific_file.py
```

#### 1.5 Post-Refactor Cleanup

**After successful refactor:**
1. Update README.md with new directory structure
2. Update any CI/CD pipelines
3. Update development documentation
4. Remove backup branch if everything works

---

### Part 2: Frontend Directory Creation

1. **Create a new folder `frontend/` at the root**
   - This will contain the React + Vite application

2. **Move existing `Dockerfile` for backend into `backend/` and rename to `Dockerfile.backend`**
   - Update `docker-compose.yml` to reflect the new path

---

## ⚙️ Phase 2: Initialize Frontend with Vite + TypeScript

1. `cd frontend/`
2. Run:
   ```bash
   npm create vite@latest . -- --template react-ts
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

4. Add TailwindCSS:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

5. Configure `tailwind.config.js` and `index.css`:
   - Add content paths in `tailwind.config.js`:
     ```js
     content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
     ```

   - In `src/index.css`, add:
     ```css
     @tailwind base;
     @tailwind components;
     @tailwind utilities;
     ```

---

## 🧩 Phase 3: Add Routing, Query, and Base Setup

1. Install routing and data tools:
   ```bash
   npm install react-router-dom @tanstack/react-query
   ```

2. Create base folder structure:
   ```
   src/
   ├── components/
   ├── pages/
   ├── sections/
   ├── services/
   ├── types/
   ├── hooks/
   ├── App.tsx
   └── main.tsx
   ```

3. Set up `App.tsx` with routing:
   ```tsx
   import { BrowserRouter, Routes, Route } from "react-router-dom";
   import LandingPage from "./pages/LandingPage";
   import ComparePage from "./pages/ComparePage";
   import MapPage from "./pages/MapPage";
   import AboutPage from "./pages/AboutPage";

   function App() {
     return (
       <BrowserRouter>
         <Routes>
           <Route path="/" element={<LandingPage />} />
           <Route path="/compare" element={<ComparePage />} />
           <Route path="/map/:city" element={<MapPage />} />
           <Route path="/about" element={<AboutPage />} />
         </Routes>
       </BrowserRouter>
     );
   }

   export default App;
   ```

4. Set up `main.tsx` with React Query Provider:
   ```tsx
   import React from 'react';
   import ReactDOM from 'react-dom/client';
   import App from './App';
   import './index.css';
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

   const queryClient = new QueryClient();

   ReactDOM.createRoot(document.getElementById('root')!).render(
     <React.StrictMode>
       <QueryClientProvider client={queryClient}>
         <App />
       </QueryClientProvider>
     </React.StrictMode>
   );
   ```

---

## 🧪 Phase 4: Docker Integration (Dev Mode)

1. Add this to `docker-compose.yml`:

   ```yaml
   frontend:
     build:
       context: ./frontend
     ports:
       - "5173:5173"
     volumes:
       - ./frontend:/app
     command: npm run dev
     working_dir: /app
   ```

2. Create a basic `Dockerfile` in `/frontend`:
   ```Dockerfile
   FROM node:18

   WORKDIR /app
   COPY . .
   RUN npm install
   CMD ["npm", "run", "dev"]
   ```

---

## 🧱 Next Tasks (Post-Setup)

Once the environment runs:
- ✅ Add `Navbar` and `Footer` shared layout
- ✅ Create stubs for pages: Landing, Compare, Map, About
- ✅ Create mock data and first API hook (`useCities`)
- ✅ Start with `LandingPage` and `HeroSection`

---

