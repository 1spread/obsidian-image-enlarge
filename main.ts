import { Notice, Plugin, Scope } from 'obsidian';

const IMG_SELECTOR = `.workspace-leaf-content[data-type='markdown'] img:not(a img), .workspace-leaf-content[data-type='image'] img`;
const ZOOM_FACTOR = 0.8;
const IMG_VIEW_MIN = 30;

interface ImgInfo {
  curWidth: number;
  curHeight: number;
  realWidth: number;
  realHeight: number;
  left: number;
  top: number;
}

export default class ImageEnlargePlugin extends Plugin {
  private overlayEl: HTMLDivElement | null = null;
  private imgInfo: ImgInfo = { curWidth: 0, curHeight: 0, realWidth: 0, realHeight: 0, left: 0, top: 0 };
  private currentImgSrc = '';
  private overlayScope: Scope | null = null;

  private handleImageClick = (evt: MouseEvent, delegateTarget: HTMLImageElement) => {
    if (this.overlayEl) return;
    evt.preventDefault();
    this.openOverlay(delegateTarget.src);
  };

  async onload() {
    // Delegated click handler — bubble phase, no interference with Obsidian internals
    document.on('click', IMG_SELECTOR, this.handleImageClick);
    this.register(() => document.off('click', IMG_SELECTOR, this.handleImageClick));
  }

  onunload() {
    this.closeOverlay();
  }

  private openOverlay(src: string) {
    if (this.overlayEl) return;
    this.currentImgSrc = src;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.addClass('image-enlarge-overlay');
    this.overlayEl = overlay;

    // Create image view
    const imgView = document.createElement('img');
    imgView.addClass('image-enlarge-view');
    imgView.src = src;

    // Create button group
    const btnGroup = document.createElement('div');
    btnGroup.addClass('image-enlarge-btn-group');

    const copyBtn = document.createElement('button');
    copyBtn.addClass('image-enlarge-btn');
    copyBtn.textContent = 'Copy';

    const copyPathBtn = document.createElement('button');
    copyPathBtn.addClass('image-enlarge-btn');
    copyPathBtn.textContent = 'Copy Path';

    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(copyPathBtn);
    overlay.appendChild(imgView);
    overlay.appendChild(btnGroup);
    document.body.appendChild(overlay);

    // Wait for image to load, then calculate fit size
    const realImg = new Image();
    realImg.src = src;
    realImg.onload = () => {
      this.calculateFitSize(realImg, imgView);
    };
    if (realImg.complete) {
      this.calculateFitSize(realImg, imgView);
    }

    // Close on background click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeOverlay();
    });

    // Keyboard via Obsidian Scope — integrates with Keymap system
    this.overlayScope = new Scope();
    this.overlayScope.register(null, 'Escape', () => {
      this.closeOverlay();
      return false;
    });
    this.overlayScope.register(['Mod'], 'c', () => {
      this.copyImageToClipboard(imgView);
      return false;
    });
    this.overlayScope.register(['Mod', 'Shift'], 'c', () => {
      this.copyImagePath(src);
      return false;
    });
    this.app.keymap.pushScope(this.overlayScope);

    // Mousewheel zoom
    imgView.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomIn = e.deltaY < 0;
      const ratio = zoomIn ? 0.1 : -0.1;
      const rect = imgView.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      this.zoom(ratio, { offsetX, offsetY });
      this.applyTransform(imgView);
    });

    // Copy button
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyImageToClipboard(imgView);
    });

    // Copy Path button
    copyPathBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyImagePath(src);
    });
  }

  private calculateFitSize(realImg: HTMLImageElement, imgView: HTMLImageElement) {
    const winW = document.documentElement.clientWidth;
    const winH = document.documentElement.clientHeight - 100;
    const zoomW = winW * ZOOM_FACTOR;
    const zoomH = winH * ZOOM_FACTOR;

    let w = realImg.naturalWidth, h = realImg.naturalHeight;
    if (h > zoomH) {
      h = zoomH;
      w = h / realImg.naturalHeight * realImg.naturalWidth;
      if (w > zoomW) w = zoomW;
    } else if (w > zoomW) {
      w = zoomW;
    }
    h = w * realImg.naturalHeight / realImg.naturalWidth;

    this.imgInfo = {
      curWidth: w,
      curHeight: h,
      realWidth: realImg.naturalWidth,
      realHeight: realImg.naturalHeight,
      left: (winW - w) / 2,
      top: (winH - h) / 2,
    };
    this.applyTransform(imgView);
  }

  private zoom(ratio: number, offset: { offsetX: number; offsetY: number }) {
    const info = this.imgInfo;
    const zoomIn = ratio > 0;
    const multiplier = zoomIn ? 1 + ratio : 1 / (1 - ratio);
    let zoomRatio = info.curWidth * multiplier / info.realWidth;

    // Snap to 100% when crossing the 1:1 threshold
    const curRatio = info.curWidth / info.realWidth;
    if ((curRatio < 1 && zoomRatio > 1) || (curRatio > 1 && zoomRatio < 1)) {
      zoomRatio = 1;
      const snapMultiplier = 1 / curRatio;
      info.left += offset.offsetX * (1 - snapMultiplier);
      info.top += offset.offsetY * (1 - snapMultiplier);
      info.curWidth = info.realWidth;
      info.curHeight = info.realHeight;
      return;
    }

    let newW = info.realWidth * zoomRatio;
    let newH = info.realHeight * zoomRatio;

    // Enforce minimum size
    if (newW < IMG_VIEW_MIN || newH < IMG_VIEW_MIN) {
      if (newW < IMG_VIEW_MIN) {
        newW = IMG_VIEW_MIN;
        newH = newW * info.realHeight / info.realWidth;
      } else {
        newH = IMG_VIEW_MIN;
        newW = newH * info.realWidth / info.realHeight;
      }
      return;
    }

    info.left += offset.offsetX * (1 - multiplier);
    info.top += offset.offsetY * (1 - multiplier);
    info.curWidth = newW;
    info.curHeight = newH;
  }

  private applyTransform(imgView: HTMLImageElement) {
    const info = this.imgInfo;
    imgView.style.width = info.curWidth + 'px';
    imgView.style.height = info.curHeight + 'px';
    imgView.style.left = info.left + 'px';
    imgView.style.top = info.top + 'px';
  }

  private copyImagePath(src: string): void {
    let path = src;
    try {
      const url = new URL(src);
      const decodedPath = decodeURIComponent(url.pathname);
      const vaultBasePath = (this.app.vault.adapter as any).basePath as string;
      if (vaultBasePath && decodedPath.includes(vaultBasePath)) {
        const idx = decodedPath.indexOf(vaultBasePath);
        path = decodedPath.substring(idx + vaultBasePath.length);
        if (path.startsWith('/')) path = path.substring(1);
      } else {
        path = decodedPath;
        if (path.startsWith('/')) path = path.substring(1);
      }
    } catch {
      // If not a valid URL, use as-is
    }
    navigator.clipboard.writeText(path).then(
      () => new Notice('Path copied: ' + path),
      () => new Notice('Failed to copy path')
    );
  }

  private copyImageToClipboard(imgView: HTMLImageElement): void {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imgView.src;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            new Notice('Failed to copy image');
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            new Notice('Image copied');
          } catch {
            new Notice('Failed to copy image');
          }
        });
      } catch (err) {
        new Notice('Failed to copy image');
        console.error(err);
      }
    };
    image.onerror = () => {
      new Notice('Failed to copy image');
    };
  }

  private closeOverlay() {
    if (this.overlayScope) {
      this.app.keymap.popScope(this.overlayScope);
      this.overlayScope = null;
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }
}
