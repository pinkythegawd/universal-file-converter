import './styles.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';

const tabButtons = Array.from(document.querySelectorAll('.tab'));
const panels = Array.from(document.querySelectorAll('.panel'));

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    for (const item of tabButtons) {
      item.classList.toggle('is-active', item === button);
    }
    for (const panel of panels) {
      panel.classList.toggle('is-active', panel.id === `panel-${tab}`);
    }
  });
}

const setStatus = (id, text, isError = false) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#b42318' : '';
};

const safeExt = (mime) => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  return 'bin';
};

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('File read failed.'));
    fr.readAsDataURL(file);
  });

const readAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('File read failed.'));
    fr.readAsArrayBuffer(file);
  });

const readAsText = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('File read failed.'));
    fr.readAsText(file);
  });

const triggerDownload = (anchor, url, filename) => {
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = false;
  anchor.textContent = `Download ${filename}`;
};

const imageInput = document.getElementById('image-input');
const imageFormat = document.getElementById('image-format');
const imageQualityWrap = document.getElementById('image-quality-wrap');
const imageQuality = document.getElementById('image-quality');
const imageConvert = document.getElementById('image-convert');
const imageDownload = document.getElementById('image-download');

imageFormat.addEventListener('change', () => {
  imageQualityWrap.style.display = imageFormat.value === 'image/png' ? 'none' : 'grid';
});
imageFormat.dispatchEvent(new Event('change'));

imageConvert.addEventListener('click', async () => {
  try {
    imageDownload.hidden = true;
    const file = imageInput.files?.[0];
    if (!file) {
      setStatus('image-status', 'Choose an image file first.', true);
      return;
    }

    setStatus('image-status', 'Converting image...');
    const targetMime = imageFormat.value;
    const sourceUrl = await readAsDataURL(file);
    const img = new Image();
    img.src = sourceUrl;

    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const quality = Number(imageQuality.value);
    const dataUrl = canvas.toDataURL(targetMime, quality);
    const blob = await (await fetch(dataUrl)).blob();
    const outUrl = URL.createObjectURL(blob);
    const base = file.name.replace(/\.[^.]+$/, '');
    const filename = `${base}.${safeExt(targetMime)}`;
    triggerDownload(imageDownload, outUrl, filename);
    setStatus('image-status', `Converted ${file.type || 'image'} to ${targetMime}.`);
  } catch (error) {
    setStatus('image-status', error.message || 'Image conversion failed.', true);
  }
});

function audioBufferToWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples * blockAlign);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * blockAlign, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, samples * blockAlign, true);

  let offset = 44;
  const channelData = [];
  for (let c = 0; c < channels; c += 1) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < samples; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function encodeWithMediaRecorder(audioBuffer, mimeType) {
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error(`This browser cannot encode ${mimeType}.`);
  }

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const offline = new OfflineAudioContext(channels, audioBuffer.length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  const context = new AudioContext({ sampleRate });
  const dest = context.createMediaStreamDestination();
  const playSource = context.createBufferSource();
  playSource.buffer = rendered;
  playSource.connect(dest);

  const recorder = new MediaRecorder(dest.stream, { mimeType });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('Audio recorder failed.'));
  });

  recorder.start();
  playSource.start();
  playSource.onended = () => {
    recorder.stop();
    context.close();
  };

  return done;
}

const audioInput = document.getElementById('audio-input');
const audioFormat = document.getElementById('audio-format');
const audioConvert = document.getElementById('audio-convert');
const audioDownload = document.getElementById('audio-download');

audioConvert.addEventListener('click', async () => {
  try {
    audioDownload.hidden = true;
    const file = audioInput.files?.[0];
    if (!file) {
      setStatus('audio-status', 'Choose an audio file first.', true);
      return;
    }

    setStatus('audio-status', 'Decoding audio...');
    const targetMime = audioFormat.value;
    const bytes = await readAsArrayBuffer(file);
    const decodeContext = new AudioContext();
    const buffer = await decodeContext.decodeAudioData(bytes.slice(0));
    await decodeContext.close();

    let outputBlob;
    if (targetMime === 'audio/wav') {
      outputBlob = audioBufferToWav(buffer);
    } else {
      setStatus('audio-status', `Encoding ${targetMime}...`);
      outputBlob = await encodeWithMediaRecorder(buffer, targetMime);
    }

    const outUrl = URL.createObjectURL(outputBlob);
    const base = file.name.replace(/\.[^.]+$/, '');
    const filename = `${base}.${safeExt(targetMime)}`;
    triggerDownload(audioDownload, outUrl, filename);
    setStatus('audio-status', `Converted to ${targetMime}. Browser codec support may vary.`);
  } catch (error) {
    setStatus('audio-status', error.message || 'Audio conversion failed.', true);
  }
});

function decodeUtf16(bytes, littleEndian) {
  if (bytes.length % 2 !== 0) {
    throw new Error('Invalid UTF-16 byte length.');
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    const code = littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1];
    out += String.fromCharCode(code);
  }
  return out;
}

function encodeUtf16(text, littleEndian) {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (littleEndian) {
      out[i * 2] = code & 0xff;
      out[i * 2 + 1] = (code >> 8) & 0xff;
    } else {
      out[i * 2] = (code >> 8) & 0xff;
      out[i * 2 + 1] = code & 0xff;
    }
  }
  return out;
}

function decodeLatin1(bytes) {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function encodeLatin1(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    out[i] = code <= 255 ? code : 63;
  }
  return out;
}

function decodeByEncoding(bytes, encoding) {
  if (encoding === 'utf-8') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  if (encoding === 'utf-16le') {
    return decodeUtf16(bytes, true);
  }
  if (encoding === 'utf-16be') {
    return decodeUtf16(bytes, false);
  }
  if (encoding === 'latin1') {
    return decodeLatin1(bytes);
  }
  throw new Error(`Unsupported source encoding: ${encoding}`);
}

function encodeByEncoding(text, encoding) {
  if (encoding === 'utf-8') {
    return new TextEncoder().encode(text);
  }
  if (encoding === 'utf-16le') {
    return encodeUtf16(text, true);
  }
  if (encoding === 'utf-16be') {
    return encodeUtf16(text, false);
  }
  if (encoding === 'latin1') {
    return encodeLatin1(text);
  }
  throw new Error(`Unsupported target encoding: ${encoding}`);
}

const textInput = document.getElementById('text-input');
const textSource = document.getElementById('text-source-encoding');
const textTarget = document.getElementById('text-target-encoding');
const textPreview = document.getElementById('text-preview');
const textConvert = document.getElementById('text-convert');
const textDownload = document.getElementById('text-download');

let decodedText = '';

textInput.addEventListener('change', async () => {
  const file = textInput.files?.[0];
  textDownload.hidden = true;
  if (!file) {
    textPreview.value = '';
    decodedText = '';
    return;
  }
  try {
    const bytes = new Uint8Array(await readAsArrayBuffer(file));
    decodedText = decodeByEncoding(bytes, textSource.value);
    textPreview.value = decodedText;
    setStatus('text-status', 'File decoded.');
  } catch (error) {
    setStatus('text-status', error.message || 'Could not decode text.', true);
  }
});

textSource.addEventListener('change', async () => {
  if (textInput.files?.[0]) {
    textInput.dispatchEvent(new Event('change'));
  }
});

textConvert.addEventListener('click', () => {
  try {
    const file = textInput.files?.[0];
    const current = textPreview.value;
    if (!file && !current) {
      setStatus('text-status', 'Choose a text file or type content first.', true);
      return;
    }

    const bytes = encodeByEncoding(current, textTarget.value);
    const blob = new Blob([bytes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const base = (file?.name || 'converted-text').replace(/\.[^.]+$/, '');
    const filename = `${base}.${textTarget.value}.txt`;
    triggerDownload(textDownload, url, filename);
    setStatus('text-status', `Converted to ${textTarget.value}.`);
  } catch (error) {
    setStatus('text-status', error.message || 'Text conversion failed.', true);
  }
});

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const markupMode = document.getElementById('markup-mode');
const markupInput = document.getElementById('markup-input');
const markupConvert = document.getElementById('markup-convert');
const markupOutput = document.getElementById('markup-output');
const markupPreview = document.getElementById('markup-preview');
const markupDownload = document.getElementById('markup-download');

const convertMarkup = () => {
  const mode = markupMode.value;
  const input = markupInput.value;

  if (!input.trim()) {
    markupOutput.value = '';
    markupPreview.innerHTML = '';
    setStatus('markup-status', 'Enter Markdown or HTML content to convert.', true);
    return;
  }

  if (mode === 'md-to-html') {
    const raw = marked.parse(input);
    const clean = DOMPurify.sanitize(raw);
    markupOutput.value = clean;
    markupPreview.innerHTML = clean;
    setStatus('markup-status', 'Converted Markdown to HTML.');
  } else {
    const clean = DOMPurify.sanitize(input);
    const markdown = turndown.turndown(clean);
    markupOutput.value = markdown;
    markupPreview.textContent = markdown;
    setStatus('markup-status', 'Converted HTML to Markdown.');
  }
};

markupConvert.addEventListener('click', convertMarkup);
markupDownload.addEventListener('click', () => {
  const output = markupOutput.value;
  if (!output.trim()) {
    setStatus('markup-status', 'Nothing to download yet.', true);
    return;
  }

  const mode = markupMode.value;
  const ext = mode === 'md-to-html' ? 'html' : 'md';
  const blob = new Blob([output], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `converted-markup.${ext}`;
  anchor.click();
  URL.revokeObjectURL(url);
});
