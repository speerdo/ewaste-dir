# E-Waste Recycling Directory

A static website built with Astro that helps users find electronics recycling centers in their area.

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── scripts/
│   ├── prebuild.js
│   └── build-progress.js
└── package.json
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                       |
| :------------------------ | :------------------------------------------- |
| `npm install`             | Installs dependencies                        |
| `npm run dev`             | Starts local dev server at `localhost:4321`  |
| `npm run build`           | Build your production site to `./dist/`      |
| `npm run build:optimized` | Build with memory optimization (7GB limit)   |
| `npm run build:full`      | Run prebuild optimization and then build     |
| `npm run prebuild`        | Run data prefetching for build optimization  |
| `npm run build:monitor`   | Show build progress statistics during build  |
| `npm run preview`         | Preview your build locally, before deploying |
| `npm run clean`           | Clean build artifacts and caches             |

## ⚙️ Environment Variables

For the site to function correctly, you need to set up the following environment variables:

```env
# Supabase credentials (required for data fetching)
PUBLIC_SUPABASE_URL=your_supabase_url_here
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Maps API key (required for maps functionality)
PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Setting up environment variables:

1. Create a `.env` file in the root directory
2. Add the variables shown above with your actual values
3. For production deployment, add these variables to your hosting platform

**Note:** The prebuild optimization will show warnings if Supabase credentials are missing, but the build will still complete successfully.

## 🏎️ Performance Optimizations

This project implements several optimizations for handling large static site generation:

- Batch processing of pages to manage memory usage
- Prebuild data fetching to reduce database load during build
- Concurrency limits for parallel page generation
- Memory monitoring during the build process

## 👀 Want to learn more?

Feel free to check [Astro documentation](https://docs.astro.build) or jump into [Astro Discord server](https://astro.build/chat).

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
