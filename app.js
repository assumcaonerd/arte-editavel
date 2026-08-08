/**
 * Arte Editável - Protótipo funcional
 * Editor de reconstrução de artes gráficas a partir de imagens
 */

(function () {
  'use strict';

  // ===================== STATE =====================
  const state = {
    canvas: null,
    originalImage: null,
    originalImageDataUrl: null,
    projectName: 'Projeto sem nome',
    history: [],
    historyIndex: -1,
    currentTool: 'select',
    isAnalyzing: false,
    detectedElements: [],
    confidenceMap: {},
  };

  // ===================== DOM REFS =====================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===================== INIT =====================
  function init() {
    initCanvas();
    bindEvents();
    updateLayersPanel();
    showToast('Pronto. Envie uma arte para começar.');
  }

  function initCanvas() {
    const container = $('#canvas-container');
    const width = Math.min(900, container.clientWidth - 40);
    const height = Math.min(600, container.clientHeight - 40);

    state.canvas = new fabric.Canvas('main-canvas', {
      width,
      height,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: true,
    });

    state.canvas.on('object:moving', (e) => {
      const obj = e.target;
      if (!obj) return;
      const cx = state.canvas.width / 2;
      const cy = state.canvas.height / 2;
      if (Math.abs(obj.left + obj.getScaledWidth() / 2 - cx) < 8) {
        obj.set('left', cx - obj.getScaledWidth() / 2);
      }
      if (Math.abs(obj.top + obj.getScaledHeight() / 2 - cy) < 8) {
        obj.set('top', cy - obj.getScaledHeight() / 2);
      }
    });

    state.canvas.on('selection:created', onSelection);
    state.canvas.on('selection:updated', onSelection);
    state.canvas.on('selection:cleared', onDeselection);
    state.canvas.on('object:modified', () => {
      saveHistory();
      updateLayersPanel();
      updatePropertiesPanel();
    });
    state.canvas.on('object:added', () => updateLayersPanel());
    state.canvas.on('object:removed', () => updateLayersPanel());

    document.addEventListener('keydown', handleKeyboard);
  }

  // ===================== EVENTS =====================
  function bindEvents() {
    $('#btn-upload').addEventListener('click', () => {
      $('#modal-upload').classList.remove('hidden');
      resetUploadModal();
    });
    $('#close-upload-modal').addEventListener('click', closeUploadModal);
    $('#btn-cancel-upload').addEventListener('click', closeUploadModal);
    $('#drop-zone').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', handleFileSelect);
    
    const dropZone = $('#drop-zone');
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-blue-500');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-blue-500');
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    });

    $('#btn-start-analysis').addEventListener('click', startAnalysis);
    $('#btn-go-editor').addEventListener('click', goToEditor);
    $('#btn-manual-adjust').addEventListener('click', goToEditor);

    $$('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTool = btn.dataset.tool;
        state.canvas.isDrawingMode = false;
        state.canvas.selection = state.currentTool === 'select';
        if (state.currentTool === 'text') {
          addTextAtCenter();
        }
      });
    });

    $('#btn-add-text').addEventListener('click', addTextAtCenter);
    $('#btn-add-image').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) addImageFromFile(file);
      };
      input.click();
    });
    $('#btn-bg-color').addEventListener('click', changeBackground);
    $('#btn-duplicate').addEventListener('click', duplicateSelected);
    $('#btn-delete').addEventListener('click', deleteSelected);

    $('#format-select').addEventListener('change', changeFormat);

    $('#btn-undo').addEventListener('click', undo);
    $('#btn-redo').addEventListener('click', redo);

    $('#btn-save').addEventListener('click', saveProject);
    $('#btn-export').addEventListener('click', () => {
      $('#export-menu').classList.toggle('hidden');
    });
    $$('.export-option').forEach(btn => {
      btn.addEventListener('click', () => {
        exportArt(btn.dataset.format);
        $('#export-menu').classList.add('hidden');
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-export') && !e.target.closest('#export-menu')) {
        $('#export-menu').classList.add('hidden');
      }
    });

    $('#btn-compare').addEventListener('click', openCompare);
    $('#close-compare-modal').addEventListener('click', () => $('#modal-compare').classList.add('hidden'));
    $('#compare-slider').addEventListener('input', (e) => {
      const val = e.target.value;
      $('#compare-recon-wrapper').style.width = val + '%';
      $('#compare-handle').style.left = val + '%';
    });

    $('#btn-run-command').addEventListener('click', runNaturalCommand);
    $('#nl-command').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runNaturalCommand();
    });

    bindPropertyEvents();

    $('#project-name').addEventListener('change', (e) => {
      state.projectName = e.target.value || 'Projeto sem nome';
    });

    $('#btn-refresh-layers').addEventListener('click', updateLayersPanel);
  }

  function bindPropertyEvents() {
    $('#prop-text-content')?.addEventListener('input', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox')) {
        obj.set('text', e.target.value);
        state.canvas.requestRenderAll();
      }
    });
    $('#prop-font-family')?.addEventListener('change', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj && obj.set) {
        obj.set('fontFamily', e.target.value);
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-font-size')?.addEventListener('change', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj && obj.set) {
        obj.set('fontSize', parseInt(e.target.value, 10));
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-text-color')?.addEventListener('input', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj && obj.set) {
        obj.set('fill', e.target.value);
        state.canvas.requestRenderAll();
      }
    });
    $('#prop-opacity')?.addEventListener('input', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('opacity', parseInt(e.target.value, 10) / 100);
        state.canvas.requestRenderAll();
      }
    });
    $('#prop-left')?.addEventListener('change', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('left', parseFloat(e.target.value));
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-top')?.addEventListener('change', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('top', parseFloat(e.target.value));
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-width')?.addEventListener('change', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('scaleX', parseFloat(e.target.value) / (obj.width || 1));
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-height')?.addEventListener('change', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('scaleY', parseFloat(e.target.value) / (obj.height || 1));
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-angle')?.addEventListener('input', (e) => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('angle', parseInt(e.target.value, 10));
        state.canvas.requestRenderAll();
      }
    });

    $('#prop-bold')?.addEventListener('click', () => {
      const obj = state.canvas.getActiveObject();
      if (obj && obj.fontWeight !== undefined) {
        obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-italic')?.addEventListener('click', () => {
      const obj = state.canvas.getActiveObject();
      if (obj && obj.fontStyle !== undefined) {
        obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });
    $('#prop-underline')?.addEventListener('click', () => {
      const obj = state.canvas.getActiveObject();
      if (obj && obj.underline !== undefined) {
        obj.set('underline', !obj.underline);
        state.canvas.requestRenderAll();
        saveHistory();
      }
    });

    $$('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const obj = state.canvas.getActiveObject();
        if (obj && obj.textAlign !== undefined) {
          obj.set('textAlign', btn.dataset.align);
          state.canvas.requestRenderAll();
          saveHistory();
        }
      });
    });

    $('#prop-lock')?.addEventListener('click', () => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        const locked = !obj.lockMovementX;
        obj.set({
          lockMovementX: locked,
          lockMovementY: locked,
          lockRotation: locked,
          lockScalingX: locked,
          lockScalingY: locked,
          selectable: !locked,
        });
        state.canvas.requestRenderAll();
        updateLayersPanel();
        showToast(locked ? 'Elemento bloqueado' : 'Elemento desbloqueado');
      }
    });

    $('#prop-hide')?.addEventListener('click', () => {
      const obj = state.canvas.getActiveObject();
      if (obj) {
        obj.set('visible', !obj.visible);
        state.canvas.discardActiveObject();
        state.canvas.requestRenderAll();
        updateLayersPanel();
      }
    });
  }

  // ===================== FILE HANDLING =====================
  function handleFileSelect(e) {
    handleFiles(e.target.files);
  }

  function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      showToast('Formato não suportado. Use PNG, JPG ou WEBP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      state.originalImageDataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        state.originalImage = img;
        $('#preview-img').src = ev.target.result;
        $('#preview-info').textContent = `${img.width} × ${img.height} px • ${(file.size / 1024).toFixed(0)} KB`;
        $('#preview-container').classList.remove('hidden');
        $('#btn-start-analysis').disabled = false;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetUploadModal() {
    $('#upload-step-1').classList.remove('hidden');
    $('#upload-step-2').classList.add('hidden');
    $('#upload-step-3').classList.add('hidden');
    $('#preview-container').classList.add('hidden');
    $('#btn-start-analysis').disabled = true;
    $('#file-input').value = '';
  }

  function closeUploadModal() {
    $('#modal-upload').classList.add('hidden');
  }

  // ===================== ANALYSIS =====================
  async function startAnalysis() {
    if (!state.originalImageDataUrl) return;

    $('#upload-step-1').classList.add('hidden');
    $('#upload-step-2').classList.remove('hidden');

    const steps = [
      { pct: 15, status: 'Carregando imagem...', detail: 'Preparando para análise' },
      { pct: 30, status: 'Detectando objetos e pessoas...', detail: 'Segmentação de imagem' },
      { pct: 50, status: 'Reconhecendo textos (OCR)...', detail: 'Extraindo tipografia' },
      { pct: 70, status: 'Identificando logotipos e formas...', detail: 'Classificação de elementos' },
      { pct: 85, status: 'Reconstruindo fundo e camadas...', detail: 'Gerando máscaras' },
      { pct: 100, status: 'Análise concluída', detail: 'Preparando editor' },
    ];

    for (const step of steps) {
      $('#analysis-status').textContent = step.status;
      $('#analysis-detail').textContent = step.detail;
      $('#analysis-progress').style.width = step.pct + '%';
      await sleep(450 + Math.random() * 300);
    }

    const w = state.originalImage.width;
    const h = state.originalImage.height;

    state.detectedElements = [
      {
        id: 'bg-1',
        type: 'background',
        label: 'Fundo',
        confidence: 'high',
        bbox: { x: 0, y: 0, w, h },
        color: '#1a1a2e',
      },
      {
        id: 'photo-1',
        type: 'photo',
        label: 'Fotografia principal',
        confidence: 'medium',
        bbox: { x: w * 0.05, y: h * 0.1, w: w * 0.45, h: h * 0.7 },
        note: 'Detectada como região de imagem. Pode precisar de recorte manual.',
      },
      {
        id: 'text-1',
        type: 'text',
        label: 'Título (estimado)',
        confidence: 'medium',
        bbox: { x: w * 0.52, y: h * 0.15, w: w * 0.42, h: h * 0.12 },
        text: 'Título da Arte',
        fontGuess: 'Montserrat',
        fontSize: Math.round(h * 0.06),
        color: '#ffffff',
      },
      {
        id: 'text-2',
        type: 'text',
        label: 'Subtítulo / legenda',
        confidence: 'low',
        bbox: { x: w * 0.52, y: h * 0.3, w: w * 0.4, h: h * 0.08 },
        text: 'Texto secundário',
        fontGuess: 'Inter',
        fontSize: Math.round(h * 0.035),
        color: '#cccccc',
      },
      {
        id: 'logo-1',
        type: 'logo',
        label: 'Possível logotipo',
        confidence: 'low',
        bbox: { x: w * 0.75, y: h * 0.8, w: w * 0.18, h: h * 0.12 },
        note: 'Baixa confiança. Confirme ou redesenhe no editor.',
      },
    ];

    renderDetectedElements();
    $('#upload-step-2').classList.add('hidden');
    $('#upload-step-3').classList.remove('hidden');
  }

  function renderDetectedElements() {
    const container = $('#detected-elements');
    container.innerHTML = '';

    state.detectedElements.forEach((el) => {
      const confClass = `confidence-${el.confidence}`;
      const confLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' }[el.confidence];
      const typeIcon = {
        background: '🖼',
        photo: '📷',
        text: '🔤',
        logo: '◈',
        shape: '◻',
        object: '📦',
      }[el.type] || '•';

      const div = document.createElement('div');
      div.className = 'flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700';
      div.innerHTML = `
        <span class="text-lg">${typeIcon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${el.label}</div>
          <div class="text-xs text-gray-500">${el.type} ${el.note ? '• ' + el.note : ''}</div>
        </div>
        <span class="text-xs ${confClass} font-medium">${confLabel}</span>
      `;
      container.appendChild(div);
    });
  }

  function goToEditor() {
    closeUploadModal();
    buildEditableFromAnalysis();
    showToast('Arte carregada no editor. Ajuste as camadas conforme necessário.');
  }

  function buildEditableFromAnalysis() {
    if (!state.originalImage) return;

    state.canvas.clear();
    state.history = [];
    state.historyIndex = -1;

    const img = state.originalImage;
    const maxW = Math.min(900, window.innerWidth - 500);
    const maxH = Math.min(650, window.innerHeight - 160);
    let scale = Math.min(maxW / img.width, maxH / img.height, 1);

    const displayW = Math.round(img.width * scale);
    const displayH = Math.round(img.height * scale);

    state.canvas.setWidth(displayW);
    state.canvas.setHeight(displayH);

    fabric.Image.fromURL(state.originalImageDataUrl, (fabricImg) => {
      fabricImg.set({
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        name: 'Imagem original (fundo)',
        layerType: 'background',
        confidence: 'high',
      });
      state.canvas.add(fabricImg);
      state.canvas.sendToBack(fabricImg);

      state.detectedElements
        .filter((el) => el.type === 'text')
        .forEach((el) => {
          const text = new fabric.IText(el.text || 'Texto', {
            left: el.bbox.x * scale,
            top: el.bbox.y * scale,
            fontSize: Math.max(14, (el.fontSize || 24) * scale),
            fontFamily: el.fontGuess || 'Inter',
            fill: el.color || '#ffffff',
            name: el.label,
            layerType: 'text',
            confidence: el.confidence,
            shadow: 'rgba(0,0,0,0.4) 1px 1px 3px',
          });
          state.canvas.add(text);
        });

      state.detectedElements
        .filter((el) => el.type === 'photo' || el.type === 'logo')
        .forEach((el) => {
          const rect = new fabric.Rect({
            left: el.bbox.x * scale,
            top: el.bbox.y * scale,
            width: el.bbox.w * scale,
            height: el.bbox.h * scale,
            fill: 'transparent',
            stroke: el.confidence === 'low' ? '#ef4444' : '#3b82f6',
            strokeWidth: 1.5,
            strokeDashArray: [6, 4],
            name: el.label + ' (área estimada)',
            layerType: el.type,
            confidence: el.confidence,
            selectable: true,
            opacity: 0.7,
          });
          state.canvas.add(rect);
        });

      state.canvas.requestRenderAll();
      saveHistory();
      updateLayersPanel();
    });
  }

  // ===================== EDITOR ACTIONS =====================
  function addTextAtCenter() {
    const text = new fabric.IText('Novo texto', {
      left: state.canvas.width / 2 - 60,
      top: state.canvas.height / 2 - 15,
      fontSize: 28,
      fontFamily: 'Inter',
      fill: '#ffffff',
      name: 'Texto',
      layerType: 'text',
      shadow: 'rgba(0,0,0,0.35) 1px 1px 2px',
    });
    state.canvas.add(text);
    state.canvas.setActiveObject(text);
    state.canvas.requestRenderAll();
    saveHistory();
  }

  function addImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      fabric.Image.fromURL(ev.target.result, (img) => {
        const maxDim = Math.min(state.canvas.width, state.canvas.height) * 0.5;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        img.set({
          left: state.canvas.width / 2 - (img.width * scale) / 2,
          top: state.canvas.height / 2 - (img.height * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          name: 'Fotografia',
          layerType: 'photo',
        });
        state.canvas.add(img);
        state.canvas.setActiveObject(img);
        state.canvas.requestRenderAll();
        saveHistory();
      });
    };
    reader.readAsDataURL(file);
  }

  function changeBackground() {
    const color = prompt('Cor do fundo (ex: #1a1a2e ou blue):', '#1a1a2e');
    if (color) {
      state.canvas.backgroundColor = color;
      state.canvas.requestRenderAll();
      saveHistory();
      showToast('Fundo alterado');
    }
  }

  function duplicateSelected() {
    const obj = state.canvas.getActiveObject();
    if (!obj) {
      showToast('Selecione um elemento primeiro');
      return;
    }
    obj.clone((cloned) => {
      cloned.set({
        left: obj.left + 20,
        top: obj.top + 20,
        name: (obj.name || 'Elemento') + ' (cópia)',
      });
      state.canvas.add(cloned);
      state.canvas.setActiveObject(cloned);
      state.canvas.requestRenderAll();
      saveHistory();
    });
  }

  function deleteSelected() {
    const active = state.canvas.getActiveObjects();
    if (!active.length) {
      showToast('Selecione um elemento primeiro');
      return;
    }
    active.forEach((obj) => state.canvas.remove(obj));
    state.canvas.discardActiveObject();
    state.canvas.requestRenderAll();
    saveHistory();
  }

  function changeFormat() {
    const val = $('#format-select').value;
    const sizes = {
      '1080x1080': [1080, 1080],
      '1080x1920': [1080, 1920],
      '1920x1080': [1920, 1080],
      '1080x1350': [1080, 1350],
      a4: [2480, 3508],
    };

    if (val === 'original' && state.originalImage) {
      const img = state.originalImage;
      const maxW = Math.min(900, window.innerWidth - 500);
      const maxH = Math.min(650, window.innerHeight - 160);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      state.canvas.setWidth(Math.round(img.width * scale));
      state.canvas.setHeight(Math.round(img.height * scale));
      state.canvas.requestRenderAll();
      return;
    }

    if (val === 'custom') {
      const w = parseInt(prompt('Largura (px):', '1080'), 10);
      const h = parseInt(prompt('Altura (px):', '1080'), 10);
      if (w > 0 && h > 0) {
        resizeCanvasTo(w, h);
      }
      return;
    }

    if (sizes[val]) {
      const [tw, th] = sizes[val];
      const maxW = Math.min(900, window.innerWidth - 500);
      const maxH = Math.min(650, window.innerHeight - 160);
      const scale = Math.min(maxW / tw, maxH / th, 1);
      resizeCanvasTo(Math.round(tw * scale), Math.round(th * scale));
      showToast(`Formato alterado para ${val}`);
    }
  }

  function resizeCanvasTo(w, h) {
    state.canvas.setWidth(w);
    state.canvas.setHeight(h);
    state.canvas.requestRenderAll();
  }

  // ===================== SELECTION & PROPERTIES =====================
  function onSelection() {
    updatePropertiesPanel();
    updateLayersPanel();
  }

  function onDeselection() {
    $('#props-empty').classList.remove('hidden');
    $('#props-content').classList.add('hidden');
    updateLayersPanel();
  }

  function updatePropertiesPanel() {
    const obj = state.canvas.getActiveObject();
    if (!obj) {
      $('#props-empty').classList.remove('hidden');
      $('#props-content').classList.add('hidden');
      return;
    }

    $('#props-empty').classList.add('hidden');
    $('#props-content').classList.remove('hidden');

    const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
    $('#props-text').classList.toggle('hidden', !isText);

    if (isText) {
      $('#prop-text-content').value = obj.text || '';
      $('#prop-font-family').value = obj.fontFamily || 'Inter';
      $('#prop-font-size').value = Math.round(obj.fontSize || 24);
      $('#prop-text-color').value = rgbToHex(obj.fill) || '#ffffff';
    }

    $('#prop-opacity').value = Math.round((obj.opacity ?? 1) * 100);
    $('#prop-left').value = Math.round(obj.left || 0);
    $('#prop-top').value = Math.round(obj.top || 0);
    $('#prop-width').value = Math.round((obj.width || 0) * (obj.scaleX || 1));
    $('#prop-height').value = Math.round((obj.height || 0) * (obj.scaleY || 1));
    $('#prop-angle').value = Math.round(obj.angle || 0);
  }

  function updateLayersPanel() {
    const list = $('#layers-list');
    list.innerHTML = '';
    const objects = state.canvas.getObjects().slice().reverse();

    if (!objects.length) {
      list.innerHTML = '<p class="text-xs text-gray-500 p-3 text-center">Nenhuma camada ainda</p>';
      return;
    }

    objects.forEach((obj, idx) => {
      const name = obj.name || obj.type || `Camada ${idx + 1}`;
      const conf = obj.confidence || '';
      const confClass = conf ? `confidence-${conf}` : '';
      const isActive = state.canvas.getActiveObject() === obj;
      const isHidden = obj.visible === false;
      const isLocked = obj.lockMovementX === true;

      const item = document.createElement('div');
      item.className = `layer-item flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive ? 'active' : ''}`;
      item.innerHTML = `
        <span class="text-xs opacity-60 w-4">${isHidden ? '👁‍🗨' : isLocked ? '🔒' : '⠿'}</span>
        <span class="flex-1 truncate ${isHidden ? 'opacity-40' : ''}">${name}</span>
        ${conf ? `<span class="text-[10px] ${confClass}">${conf[0].toUpperCase()}</span>` : ''}
      `;
      item.addEventListener('click', () => {
        state.canvas.setActiveObject(obj);
        state.canvas.requestRenderAll();
        updatePropertiesPanel();
        updateLayersPanel();
      });
      list.appendChild(item);
    });
  }

  // ===================== HISTORY =====================
  function saveHistory() {
    const json = state.canvas.toJSON(['name', 'layerType', 'confidence']);
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(json);
    if (state.history.length > 40) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    state.canvas.loadFromJSON(state.history[state.historyIndex], () => {
      state.canvas.requestRenderAll();
      updateLayersPanel();
    });
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    state.canvas.loadFromJSON(state.history[state.historyIndex], () => {
      state.canvas.requestRenderAll();
      updateLayersPanel();
    });
  }

  // ===================== NATURAL LANGUAGE =====================
  function runNaturalCommand() {
    const cmd = ($('#nl-command').value || '').trim().toLowerCase();
    if (!cmd) return;

    let handled = false;

    if (cmd.includes('título') || cmd.includes('titulo') || cmd.includes('mude o texto') || cmd.includes('altere o texto')) {
      const match = cmd.match(/(?:para|por|como)\s+["']?(.+?)["']?$/i) || cmd.match(/t[ií]tulo\s+(.+)/i);
      if (match) {
        const newText = match[1].trim();
        const texts = state.canvas.getObjects().filter((o) => o.type === 'i-text' || o.type === 'text' || o.type === 'textbox');
        if (texts.length) {
          texts[0].set('text', newText);
          state.canvas.requestRenderAll();
          saveHistory();
          showToast(`Título alterado para: ${newText}`);
          handled = true;
        }
      }
    }

    if (cmd.includes('fundo')) {
      if (cmd.includes('azul')) {
        state.canvas.backgroundColor = '#0a1628';
        state.canvas.requestRenderAll();
        saveHistory();
        showToast('Fundo alterado para azul-escuro');
        handled = true;
      } else if (cmd.includes('preto') || cmd.includes('escuro')) {
        state.canvas.backgroundColor = '#0a0a0a';
        state.canvas.requestRenderAll();
        saveHistory();
        showToast('Fundo escurecido');
        handled = true;
      } else if (cmd.includes('branco')) {
        state.canvas.backgroundColor = '#f5f5f5';
        state.canvas.requestRenderAll();
        saveHistory();
        showToast('Fundo branco');
        handled = true;
      } else if (cmd.includes('remover') || cmd.includes('apagar')) {
        const bg = state.canvas.getObjects().find((o) => o.layerType === 'background');
        if (bg) {
          state.canvas.remove(bg);
          state.canvas.requestRenderAll();
          saveHistory();
          showToast('Imagem de fundo removida');
          handled = true;
        }
      }
    }

    if (cmd.includes('centraliz')) {
      const objs = state.canvas.getActiveObjects().length
        ? state.canvas.getActiveObjects()
        : state.canvas.getObjects().filter((o) => o.type === 'i-text' || o.type === 'text');
      objs.forEach((o) => {
        o.set('left', state.canvas.width / 2 - (o.getScaledWidth() / 2));
      });
      state.canvas.requestRenderAll();
      saveHistory();
      showToast('Elementos centralizados');
      handled = true;
    }

    if (cmd.includes('story') || cmd.includes('stories')) {
      $('#format-select').value = '1080x1920';
      changeFormat();
      handled = true;
    }
    if (cmd.includes('quadrado') || cmd.includes('instagram')) {
      $('#format-select').value = '1080x1080';
      changeFormat();
      handled = true;
    }

    if (cmd.includes('remover') && (cmd.includes('logo') || cmd.includes('logotipo'))) {
      const logos = state.canvas.getObjects().filter((o) => o.layerType === 'logo' || (o.name || '').toLowerCase().includes('logo'));
      logos.forEach((o) => state.canvas.remove(o));
      state.canvas.requestRenderAll();
      saveHistory();
      showToast('Logotipo(s) removido(s)');
      handled = true;
    }

    if (cmd.includes('fonte') && (cmd.includes('forte') || cmd.includes('moderna') || cmd.includes('negrito'))) {
      const texts = state.canvas.getObjects().filter((o) => o.type === 'i-text' || o.type === 'text');
      texts.forEach((t) => {
        t.set({ fontFamily: 'Oswald', fontWeight: 'bold' });
      });
      state.canvas.requestRenderAll();
      saveHistory();
      showToast('Fonte alterada para estilo mais forte (Oswald)');
      handled = true;
    }

    if (cmd.includes('acrescente') || cmd.includes('adicione') || cmd.includes('criar')) {
      if (cmd.includes('texto') || cmd.includes('chamada') || cmd.includes('título')) {
        addTextAtCenter();
        handled = true;
      }
    }

    if (!handled) {
      showToast('Comando não reconhecido ainda. Exemplos: "Mude o título para X", "Deixe o fundo azul-escuro", "Centralize os textos", "Transforme em story"');
    } else {
      $('#nl-command').value = '';
    }
  }

  // ===================== SAVE / EXPORT =====================
  function saveProject() {
    const data = {
      name: state.projectName,
      version: 1,
      canvas: state.canvas.toJSON(['name', 'layerType', 'confidence']),
      originalImage: state.originalImageDataUrl,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('arte-editavel-project', JSON.stringify(data));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${state.projectName || 'projeto'}.json`);
    showToast('Projeto salvo (local + arquivo JSON)');
  }

  function exportArt(format) {
    if (format === 'json') {
      saveProject();
      return;
    }

    if (format === 'png' || format === 'jpg' || format === 'webp') {
      const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const quality = format === 'jpg' ? 0.92 : 1;
      const dataUrl = state.canvas.toDataURL({ format: format === 'jpg' ? 'jpeg' : format, quality, multiplier: 2 });
      downloadDataUrl(dataUrl, `${state.projectName}.${format}`);
      showToast(`Exportado como ${format.toUpperCase()} (alta resolução)`);
      return;
    }

    if (format === 'svg') {
      const svg = state.canvas.toSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      downloadBlob(blob, `${state.projectName}.svg`);
      showToast('Exportado como SVG');
      return;
    }

    if (format === 'png-layers') {
      exportLayersAsPNG();
      return;
    }

    if (format === 'pptx') {
      showToast('Exportação PPTX ainda experimental. Por enquanto exporte SVG ou PNG e importe no PowerPoint/Canva.');
      return;
    }
  }

  async function exportLayersAsPNG() {
    const objects = state.canvas.getObjects();
    if (!objects.length) {
      showToast('Nenhuma camada para exportar');
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder('camadas');

    const visibility = objects.map((o) => o.visible);
    objects.forEach((o) => o.set('visible', false));

    for (let i = 0; i < objects.length; i++) {
      objects[i].set('visible', true);
      state.canvas.requestRenderAll();
      await sleep(50);
      const dataUrl = state.canvas.toDataURL({ format: 'png', multiplier: 1 });
      const base64 = dataUrl.split(',')[1];
      const name = (objects[i].name || `camada-${i + 1}`).replace(/[^\w\-]+/g, '_');
      folder.file(`${String(i + 1).padStart(2, '0')}-${name}.png`, base64, { base64: true });
      objects[i].set('visible', false);
    }

    objects.forEach((o, i) => o.set('visible', visibility[i]));
    state.canvas.requestRenderAll();

    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `${state.projectName}-camadas.zip`);
    showToast('Camadas exportadas em ZIP');
  }

  // ===================== COMPARE =====================
  function openCompare() {
    if (!state.originalImageDataUrl) {
      showToast('Envie uma imagem primeiro para comparar');
      return;
    }
    $('#compare-original').src = state.originalImageDataUrl;
    const recon = state.canvas.toDataURL({ format: 'png', multiplier: 1 });
    $('#compare-recon').src = recon;
    $('#modal-compare').classList.remove('hidden');
  }

  // ===================== KEYBOARD =====================
  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's') {
        e.preventDefault();
        saveProject();
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    }
  }

  // ===================== UTILS =====================
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function rgbToHex(color) {
    if (!color) return '#ffffff';
    if (color.startsWith('#')) return color;
    const m = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#ffffff';
    return (
      '#' +
      [m[1], m[2], m[3]]
        .map((x) => parseInt(x, 10).toString(16).padStart(2, '0'))
        .join('')
    );
  }

  // Boot
  init();
})();
