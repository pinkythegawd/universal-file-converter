# Universal File Converter (Client-Side Only)

A browser-only web app that converts:

- Images: PNG, JPG, WebP
- Audio: WAV, WebM (Opus), OGG (Opus) depending on browser codec support
- Text encodings: UTF-8, UTF-16 LE/BE, Latin-1
- Markdown and HTML in both directions

## Features

- Runs entirely in the browser with JavaScript APIs
- No backend and no file uploads
- Download converted output files directly
- Responsive UI for desktop and mobile

## Tech

- Vite
- Vanilla JavaScript
- DOMPurify
- marked
- Turndown

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy (One Click)

Update `your-repo-name` with your actual repository name.

- Vercel: https://vercel.com/new/clone?repository-url=https://github.com/pinkythegawd/your-repo-name
- Netlify: https://app.netlify.com/start/deploy?repository=https://github.com/pinkythegawd/your-repo-name

## Notes

- Audio encoding to OGG/WebM depends on `MediaRecorder.isTypeSupported` in the current browser.
- Text encoding conversion supports UTF-8, UTF-16 LE/BE, and Latin-1 without server-side tools.

## Author

- GitHub: pinkythegawd
- Name: MikePinku
- Profile: https://github.com/pinkythegawd
