/**
 * Arte Editavel - Editor Canva-style
 * Prioridade: capas sob texto + OCR + camadas Fabric
 */
(function () {
  'use strict';

  var state = {
    canvas: null,
    originalImage: null,
    originalImageDataUrl: null,
    cleanBackgroundUrl: null,
    detectedElements: [],
    history: [],
    historyIndex: -1
  };
  window.__arteState = state;

  function $(s) { return document.querySelector(s); }
  function $$(s) { return document.querySelectorAll(s); }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.add('hidden'); }, 3200);
  }

  function initCanvas() {
    var el = document.getElementById('main-canvas');
    if (!el || typeof fabric === 'undefined') return;
    state.canvas = new fabric.Canvas('main-canvas', {
      backgroundColor: '#111827',
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true
    });
    state.canvas.setWidth(800);
    state.canvas.setHeight(600);
    fabric.Object.prototype.set({
      transparentCorners: false,
      borderColor: '#3b82f6',
      cornerColor: '#ffffff',
      cornerStrokeColor: '#3b82f6',
      cornerSize: 10,
      padding: 4,
      borderScaleFactor: 1.5
    });
    state.canvas.on('selection:created', onSelect);
    state.canvas.on('selection:updated', onSelect);
    state.canvas.on('selection:cleared', onDeselect);
    state.canvas.on('object:modified', function () { saveHistory(); updateLayersPanel(); });
  }

  function onSelect(e) {
    var obj = (e.selected && e.selected[0]) || state.canvas.getActiveObject();
    if (!obj) return;
    showProps(obj);
    updateLayersPanel();
  }

  function onDeselect() {
    if ($('#props-empty')) $('#props-empty').classList.remove('hidden');
    if ($('#props-content')) $('#props-content').classList.add('hidden');
    updateLayersPanel();
  }

  function showProps(obj) {
    if ($('#props-empty')) $('#props-empty').classList.add('hidden');
    if ($('#props-content')) $('#props-content').classList.remove('hidden');
    var isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
    if ($('#props-text')) $('#props-text').style.display = isText ? 'block' : 'none';
    if (isText) {
      if ($('#prop-text-content')) $('#prop-text-content').value = obj.text || '';
      if ($('#prop-font-size')) $('#prop-font-size').value = Math.round(obj.fontSize || 24);
      if ($('#prop-font-family')) $('#prop-font-family').value = obj.fontFamily || 'Impact';
      if ($('#prop-text-color')) $('#prop-text-color').value = (obj.fill && String(obj.fill).indexOf('#') === 0) ? obj.fill : '#ffffff';
    }
    if ($('#prop-left')) $('#prop-left').value = Math.round(obj.left || 0);
    if ($('#prop-top')) $('#prop-top').value = Math.round(obj.top || 0);
    if ($('#prop-opacity')) $('#prop-opacity').value = Math.round((obj.opacity != null ? obj.opacity : 1) * 100);
  }

  function saveHistory() {
    if (!state.canvas) return;
    var json = JSON.stringify(state.canvas.toJSON(['name', 'layerType']));
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(json);
    if (state.history.length > 40) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex <= 0 || !state.canvas) return;
    state.historyIndex--;
    state.canvas.loadFromJSON(state.history[state.historyIndex], function () {
      state.canvas.renderAll(); updateLayersPanel();
    });
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1 || !state.canvas) return;
    state.historyIndex++;
    state.canvas.loadFromJSON(state.history[state.historyIndex], function () {
      state.canvas.renderAll(); updateLayersPanel();
    });
  }

  function updateLayersPanel() {
    var list = $('#layers-list');
    if (!list || !state.canvas) return;
    list.innerHTML = '';
    var objs = state.canvas.getObjects().slice().reverse();
    if (!objs.length) {
      list.innerHTML = '<p class="text-xs text-gray-500 p-3 text-center">Nenhuma camada</p>';
      return;
    }
    objs.forEach(function (obj) {
      var div = document.createElement('div');
      var active = state.canvas.getActiveObject() === obj;
      div.className = 'layer-item flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-gray-700' + (active ? ' active' : '');
      div.innerHTML = '<span class="text-gray-500">=</span><span class="flex-1 truncate">' + (obj.name || obj.type) + '</span>';
      div.onclick = function () {
        state.canvas.setActiveObject(obj);
        state.canvas.requestRenderAll();
        showProps(obj);
        updateLayersPanel();
      };
      list.appendChild(div);
    });
  }

  function openUpload() {
    var m = $('#modal-upload');
    if (!m) return;
    m.classList.remove('hidden');
    if ($('#upload-step-1')) $('#upload-step-1').classList.remove('hidden');
    if ($('#upload-step-2')) $('#upload-step-2').classList.add('hidden');
    if ($('#upload-step-3')) $('#upload-step-3').classList.add('hidden');
    if ($('#preview-container')) $('#preview-container').classList.add('hidden');
    var btn = $('#btn-start-analysis');
    if (btn) btn.disabled = true;
  }

  function closeUpload() {
    if ($('#modal-upload')) $('#modal-upload').classList.add('hidden');
  }

  function handleFile(file) {
    if (!file || !file.type.match(/^image\/(png|jpeg|jpg|webp)/)) {
      toast('Use PNG, JPG ou WEBP');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      state.originalImageDataUrl = e.target.result;
      state.cleanBackgroundUrl = null;
      var img = new Image();
      img.onload = function () {
        state.originalImage = img;
        if ($('#preview-img')) $('#preview-img').src = e.target.result;
        if ($('#preview-container')) $('#preview-container').classList.remove('hidden');
        if ($('#preview-info')) $('#preview-info').textContent = img.width + ' x ' + img.height + ' px';
        var btn = $('#btn-start-analysis');
        if (btn) btn.disabled = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function startAnalysis() {
    if (!state.originalImageDataUrl) return;
    if ($('#upload-step-1')) $('#upload-step-1').classList.add('hidden');
    if ($('#upload-step-2')) $('#upload-step-2').classList.remove('hidden');
    if ($('#upload-step-3')) $('#upload-step-3').classList.add('hidden');
    if ($('#analysis-status')) $('#analysis-status').textContent = 'Analisando...';
    if ($('#analysis-detail')) $('#analysis-detail').textContent = 'OCR + camadas';
    if ($('#analysis-progress')) $('#analysis-progress').style.width = '30%';

    var result = { elements: [], simulated: true };
    try {
      if (window.LayerService) {
        if ($('#analysis-progress')) $('#analysis-progress').style.width = '50%';
        var recon = await window.LayerService.reconstruct(state.originalImageDataUrl);
        if (recon.backgroundUrl) state.cleanBackgroundUrl = recon.backgroundUrl;
        result = {
          elements: (recon.texts || []).map(function (t, i) {
            return {
              id: 'text-' + (i + 1),
              type: 'text',
              label: t.label || ('Texto ' + (i + 1)),
              text: t.text,
              bbox: { x: t.x, y: t.y, w: t.w, h: t.h },
              color: t.color || '#ffffff',
              fontGuess: t.fontFamily || 'Impact',
              confidence: 'high'
            };
          }),
          provider: recon.provider,
          simulated: !!recon.simulated
        };
      } else if (window.OCRService) {
        result = await window.OCRService.analyzeImage(state.originalImageDataUrl);
      }
    } catch (err) {
      console.error(err);
      result = { elements: [], simulated: true, error: err.message };
    }

    if ($('#analysis-progress')) $('#analysis-progress').style.width = '100%';
    state.detectedElements = result.elements || [];
    if ($('#analysis-status')) {
      $('#analysis-status').textContent = result.simulated
        ? 'Modo simulado - configure chave em Config'
        : 'OK (' + (result.provider || 'IA') + ')';
    }
    if ($('#analysis-detail')) {
      $('#analysis-detail').textContent = state.detectedElements.length + ' elementos';
    }
    var box = $('#detected-elements');
    if (box) {
      box.innerHTML = '';
      state.detectedElements.forEach(function (el) {
        var d = document.createElement('div');
        d.className = 'flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700';
        d.innerHTML = '<div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">' +
          (el.label || el.type) + '</div><div class="text-xs text-gray-500 truncate">' +
          (el.text || el.type) + '</div></div>';
        box.appendChild(d);
      });
    }
    setTimeout(function () {
      if ($('#upload-step-2')) $('#upload-step-2').classList.add('hidden');
      if ($('#upload-step-3')) $('#upload-step-3').classList.remove('hidden');
    }, 300);
  }

  function goToEditor() {
    closeUpload();
    if (!state.canvas || !state.originalImageDataUrl || !state.originalImage) {
      toast('Imagem nao carregada');
      return;
    }
    var img = state.originalImage;
    var maxW = Math.min(860, window.innerWidth - 480);
    var maxH = Math.min(620, window.innerHeight - 150);
    var scale = Math.min(maxW / img.width, maxH / img.height, 1);
    var displayW = Math.round(img.width * scale);
    var displayH = Math.round(img.height * scale);

    state.canvas.clear();
    state.canvas.setWidth(displayW);
    state.canvas.setHeight(displayH);
    state.history = [];
    state.historyIndex = -1;

    var bgUrl = state.cleanBackgroundUrl || state.originalImageDataUrl;

    fabric.Image.fromURL(bgUrl, function (fabricImg) {
      fabricImg.set({
        left: 0, top: 0,
        scaleX: scale, scaleY: scale,
        selectable: true,
        name: (state.cleanBackgroundUrl && state.cleanBackgroundUrl !== state.originalImageDataUrl) ? 'Fundo limpo' : 'Imagem (fundo)',
        layerType: 'background'
      });
      state.canvas.add(fabricImg);
      state.canvas.sendToBack(fabricImg);

      var textEls = (state.detectedElements || []).filter(function (e) {
        return e.type === 'text' && e.text;
      });

      textEls.forEach(function (el, i) {
        var bbox = el.bbox || {};
        var x = (typeof bbox.x === 'number' ? bbox.x : 0.06) * displayW;
        var y = (typeof bbox.y === 'number' ? bbox.y : (0.05 + i * 0.1)) * displayH;
        var w = (typeof bbox.w === 'number' ? bbox.w : 0.88) * displayW;
        var h = (typeof bbox.h === 'number' ? bbox.h : 0.09) * displayH;
        var fontSize = Math.max(16, Math.min(56, h * 0.75));
        var textW = Math.max(w, (el.text || '').length * fontSize * 0.52);

        var cover = new fabric.Rect({
          left: Math.max(0, x - 6),
          top: Math.max(0, y - 4),
          width: textW + 12,
          height: h + 10,
          fill: '#0a0a0a',
          opacity: 0.95,
          selectable: true,
          name: 'Capa',
          layerType: 'cover'
        });
        state.canvas.add(cover);

        var text = new fabric.IText(el.text, {
          left: x,
          top: y,
          fontSize: fontSize,
          fontFamily: el.fontGuess || (i === 0 ? 'Impact' : 'Arial Black'),
          fill: el.color || '#ffffff',
          name: el.text.substring(0, 32),
          layerType: 'text',
          shadow: 'rgba(0,0,0,0.55) 1px 1px 3px',
          editable: true
        });
        state.canvas.add(text);
      });

      state.canvas.requestRenderAll();
      updateLayersPanel();
      saveHistory();
      toast(textEls.length + ' textos editaveis com capa. Clique para editar.');
    }, { crossOrigin: 'anonymous' });
  }

  function addText() {
    if (!state.canvas) return;
    var t = new fabric.IText('Novo texto', {
      left: 60, top: 60, fontSize: 28, fontFamily: 'Impact', fill: '#ffffff',
      name: 'Novo texto', layerType: 'text', shadow: 'rgba(0,0,0,0.5) 1px 1px 2px'
    });
    state.canvas.add(t);
    state.canvas.setActiveObject(t);
    state.canvas.requestRenderAll();
    updateLayersPanel();
    saveHistory();
    showProps(t);
  }

  function deleteSelected() {
    if (!state.canvas) return;
    var active = state.canvas.getActiveObjects();
    if (!active.length) return;
    active.forEach(function (o) { state.canvas.remove(o); });
    state.canvas.discardActiveObject();
    state.canvas.requestRenderAll();
    updateLayersPanel();
    saveHistory();
    onDeselect();
  }

  function duplicateSelected() {
    if (!state.canvas) return;
    var active = state.canvas.getActiveObject();
    if (!active) return;
    active.clone(function (cloned) {
      cloned.set({ left: (active.left || 0) + 20, top: (active.top || 0) + 20 });
      state.canvas.add(cloned);
      state.canvas.setActiveObject(cloned);
      state.canvas.requestRenderAll();
      updateLayersPanel();
      saveHistory();
    });
  }

  function exportPNG() {
    if (!state.canvas) return;
    var url = state.canvas.toDataURL({ format: 'png', multiplier: 2 });
    var a = document.createElement('a');
    a.href = url;
    a.download = (($('#project-name') && $('#project-name').value) || 'arte') + '.png';
    a.click();
    toast('PNG exportado');
  }

  function bindProps() {
    function bind(id, fn) {
      var el = $(id);
      if (el) el.addEventListener(id.indexOf('color') >= 0 || id.indexOf('opacity') >= 0 || id.indexOf('content') >= 0 ? 'input' : 'change', fn);
    }
    bind('#prop-text-content', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj && (obj.type === 'i-text' || obj.type === 'text')) {
        obj.set('text', e.target.value);
        obj.set('name', e.target.value.substring(0, 32));
        state.canvas.requestRenderAll();
        updateLayersPanel();
      }
    });
    bind('#prop-font-size', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj) { obj.set('fontSize', parseInt(e.target.value, 10)); state.canvas.requestRenderAll(); }
    });
    bind('#prop-font-family', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj) { obj.set('fontFamily', e.target.value); state.canvas.requestRenderAll(); }
    });
    bind('#prop-text-color', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj) { obj.set('fill', e.target.value); state.canvas.requestRenderAll(); }
    });
    bind('#prop-left', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj) { obj.set('left', parseInt(e.target.value, 10)); state.canvas.requestRenderAll(); }
    });
    bind('#prop-top', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj) { obj.set('top', parseInt(e.target.value, 10)); state.canvas.requestRenderAll(); }
    });
    bind('#prop-opacity', function (e) {
      var obj = state.canvas && state.canvas.getActiveObject();
      if (obj) { obj.set('opacity', parseInt(e.target.value, 10) / 100); state.canvas.requestRenderAll(); }
    });
  }

  function bindEvents() {
    if ($('#btn-upload')) $('#btn-upload').addEventListener('click', openUpload);
    if ($('#close-upload-modal')) $('#close-upload-modal').addEventListener('click', closeUpload);
    if ($('#btn-cancel-upload')) $('#btn-cancel-upload').addEventListener('click', closeUpload);
    if ($('#btn-start-analysis')) $('#btn-start-analysis').addEventListener('click', startAnalysis);
    if ($('#btn-go-editor')) $('#btn-go-editor').addEventListener('click', goToEditor);
    if ($('#btn-manual-adjust')) $('#btn-manual-adjust').addEventListener('click', goToEditor);

    var dropZone = $('#drop-zone');
    var fileInput = $('#file-input');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      });
      dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
      dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('border-blue-500'); });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
    }

    if ($('#btn-add-text')) $('#btn-add-text').addEventListener('click', addText);
    if ($('#btn-delete')) $('#btn-delete').addEventListener('click', deleteSelected);
    if ($('#btn-duplicate')) $('#btn-duplicate').addEventListener('click', duplicateSelected);
    if ($('#btn-undo')) $('#btn-undo').addEventListener('click', undo);
    if ($('#btn-redo')) $('#btn-redo').addEventListener('click', redo);

    var exportBtn = $('#btn-export');
    var exportMenu = $('#export-menu');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      if (exportMenu) exportMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', function (e) {
      if (exportBtn && exportMenu && !exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
        exportMenu.classList.add('hidden');
      }
    });
    $$('.export-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (exportMenu) exportMenu.classList.add('hidden');
        if (btn.dataset.format === 'png') exportPNG();
        else toast('Em breve: ' + btn.dataset.format);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    });

    bindProps();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCanvas();
    bindEvents();
    console.log('Arte Editavel pronto - capas + OCR');
  });
})();
