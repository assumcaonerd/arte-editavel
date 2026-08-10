/**
 * Arte Editavel - Layer Reconstruction Engine
 * Pipeline: OCR + Text Removal + Layer Decomposition
 */
(function () {
  'use strict';

  var STORAGE = 'arte-editavel-layer-settings';

  function getSettings() {
    try {
      return Object.assign(
        { provider: 'vision', apiKey: '', falKey: '', ideogramKey: '' },
        JSON.parse(localStorage.getItem(STORAGE) || '{}')
      );
    } catch (e) {
      return { provider: 'vision', apiKey: '', falKey: '', ideogramKey: '' };
    }
  }

  function saveSettings(s) {
    localStorage.setItem(STORAGE, JSON.stringify(s));
  }

  async function reconstruct(imageDataUrl) {
    var s = getSettings();
    var provider = s.provider || 'vision';

    if (provider === 'ideogram' && s.ideogramKey) {
      return await callIdeogramLayerize(imageDataUrl, s.ideogramKey);
    }
    if (provider === 'fal' && s.falKey) {
      return await callFalLayered(imageDataUrl, s.falKey);
    }
    return await callVisionPipeline(imageDataUrl, s);
  }

  async function callIdeogramLayerize(imageDataUrl, apiKey) {
    var blob = dataURLtoBlob(imageDataUrl);
    var form = new FormData();
    form.append('image', blob, 'art.png');

    var endpoint = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? '/api/ideogram/layerize'
      : 'https://api.ideogram.ai/v1/ideogram-v3/layerize-text';
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Api-Key': apiKey },
      body: form
    });

    if (!res.ok) {
      var err = await res.text();
      throw new Error('Ideogram Layerize: ' + res.status + ' - ' + err.slice(0, 200));
    }

    var data = await res.json();
    var texts = [];
    var blocks = data.text_blocks || data.texts || data.text_containers || [];
    if (!Array.isArray(blocks)) blocks = [];

    blocks.forEach(function (b, i) {
      var t = b.text || b.content || b.value || '';
      if (!t) return;
      texts.push({
        text: t,
        x: (b.x != null ? b.x : (b.bbox && b.bbox.x)) || 0.08,
        y: (b.y != null ? b.y : (b.bbox && b.bbox.y)) || (0.05 + i * 0.1),
        w: (b.width != null ? b.width : (b.bbox && b.bbox.w)) || 0.84,
        h: (b.height != null ? b.height : (b.bbox && b.bbox.h)) || 0.08,
        fontSize: b.font_size || b.fontSize || 28,
        color: b.color || '#ffffff',
        fontFamily: b.font_family || b.fontFamily || 'Impact',
        label: b.label || (i === 0 ? 'Titulo' : 'Texto ' + (i + 1))
      });
    });

    if (!texts.length && window.OCRService) {
      var ocr = await window.OCRService.analyzeImage(imageDataUrl);
      texts = (ocr.elements || []).filter(function (e) { return e.type === 'text' && e.text; }).map(function (e, i) {
        return {
          text: e.text,
          x: (e.bbox && e.bbox.x) || 0.08,
          y: (e.bbox && e.bbox.y) || 0.05 + i * 0.1,
          w: (e.bbox && e.bbox.w) || 0.84,
          h: (e.bbox && e.bbox.h) || 0.08,
          fontSize: 28,
          color: '#ffffff',
          fontFamily: e.fontGuess || 'Impact',
          label: e.label || 'Texto ' + (i + 1)
        };
      });
    }

    return {
      backgroundUrl: data.base_image_url || data.baseImageUrl || imageDataUrl,
      texts: texts,
      layers: [],
      provider: 'ideogram',
      simulated: false,
      raw: data
    };
  }

  async function callFalLayered(imageDataUrl, falKey) {
    var res = await fetch('https://fal.run/fal-ai/qwen-image-layered', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + falKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageDataUrl,
        num_layers: 4,
        output_format: 'png'
      })
    });

    if (!res.ok) {
      var err = await res.text();
      throw new Error('fal Layered: ' + res.status + ' - ' + err.slice(0, 200));
    }

    var data = await res.json();
    var images = (data.images || []).map(function (img, i) {
      return {
        url: img.url || img,
        name: 'Camada ' + (i + 1),
        type: i === 0 ? 'background' : 'object'
      };
    });

    var texts = [];
    if (window.OCRService) {
      var ocr = await window.OCRService.analyzeImage(imageDataUrl);
      texts = (ocr.elements || []).filter(function (e) { return e.type === 'text' && e.text; }).map(function (e, i) {
        return {
          text: e.text,
          x: (e.bbox && e.bbox.x) || 0.08,
          y: (e.bbox && e.bbox.y) || 0.05 + i * 0.1,
          w: (e.bbox && e.bbox.w) || 0.84,
          h: (e.bbox && e.bbox.h) || 0.08,
          fontSize: 28,
          color: '#ffffff',
          fontFamily: e.fontGuess || 'Impact',
          label: e.label || 'Texto ' + (i + 1)
        };
      });
    }

    return {
      backgroundUrl: (images[0] && images[0].url) || imageDataUrl,
      texts: texts,
      layers: images.slice(1),
      provider: 'fal',
      simulated: false,
      raw: data
    };
  }

  async function callVisionPipeline(imageDataUrl, settings) {
    var ocr;
    if (window.OCRService) {
      ocr = await window.OCRService.analyzeImage(imageDataUrl);
    } else {
      ocr = { elements: [], simulated: true };
    }

    var texts = (ocr.elements || []).filter(function (e) { return e.type === 'text' && e.text; }).map(function (e, i) {
      return {
        text: e.text,
        x: (e.bbox && e.bbox.x) || 0.08,
        y: (e.bbox && e.bbox.y) || 0.05 + i * 0.1,
        w: (e.bbox && e.bbox.w) || 0.84,
        h: (e.bbox && e.bbox.h) || 0.08,
        fontSize: Math.max(18, Math.round(((e.bbox && e.bbox.h) || 0.08) * 600)),
        color: e.color || '#ffffff',
        fontFamily: e.fontGuess || (i === 0 ? 'Impact' : 'Arial Black'),
        label: e.label || (i === 0 ? 'Titulo' : 'Texto ' + (i + 1))
      };
    });

    var backgroundUrl = imageDataUrl;

    if (settings.falKey && texts.length) {
      try {
        backgroundUrl = await falRemoveText(imageDataUrl, settings.falKey);
      } catch (e) {
        console.warn('[Layer] Inpaint falhou, usando original:', e.message);
      }
    }

    return {
      backgroundUrl: backgroundUrl,
      texts: texts,
      layers: [],
      provider: ocr.provider || 'vision',
      simulated: !!ocr.simulated,
      raw: ocr
    };
  }

  async function falRemoveText(imageDataUrl, falKey) {
    var res = await fetch('https://fal.run/fal-ai/image-editing/object-removal', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + falKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageDataUrl,
        prompt: 'all text, captions, titles, watermarks, logos with text'
      })
    });
    if (!res.ok) {
      var err = await res.text();
      throw new Error('fal remove: ' + res.status + ' ' + err.slice(0, 150));
    }
    var data = await res.json();
    var url = data.images && data.images[0] && (data.images[0].url || data.images[0]);
    if (!url) throw new Error('fal remove: sem imagem');
    return url;
  }

  function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var bstr = atob(parts[1]);
    var n = bstr.length;
    var u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  window.LayerService = {
    reconstruct: reconstruct,
    getSettings: getSettings,
    saveSettings: saveSettings
  };
})();
