"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ImageEnlargePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var IMG_SELECTOR = `.workspace-leaf-content[data-type='markdown'] img:not(a img), .workspace-leaf-content[data-type='image'] img`;
var ZOOM_FACTOR = 0.8;
var IMG_VIEW_MIN = 30;
var BUTTON_AREA_HEIGHT = 100;
var MAX_CANVAS_DIM = 8192;
var ImageEnlargePlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.overlayEl = null;
    this.imgInfo = { curWidth: 0, curHeight: 0, realWidth: 0, realHeight: 0, left: 0, top: 0 };
    this.overlayScope = null;
    this.overlayAbortController = null;
    this.rafId = null;
    this.handleImageClick = (evt) => {
      const target = evt.target;
      const img = target instanceof HTMLImageElement ? target : target.closest("img");
      if (!img || !(img instanceof HTMLImageElement))
        return;
      if (!img.matches(IMG_SELECTOR))
        return;
      if (this.overlayEl)
        return;
      evt.preventDefault();
      evt.stopPropagation();
      this.openOverlay(img.src);
    };
  }
  onload() {
    this.registerDomEvent(document, "click", this.handleImageClick, true);
  }
  onunload() {
    this.closeOverlay();
  }
  openOverlay(src) {
    if (this.overlayEl)
      return;
    const overlay = document.createElement("div");
    overlay.addClass("image-enlarge-overlay");
    this.overlayEl = overlay;
    const imgView = document.createElement("img");
    imgView.addClass("image-enlarge-view");
    imgView.src = src;
    const btnGroup = document.createElement("div");
    btnGroup.addClass("image-enlarge-btn-group");
    const copyBtn = document.createElement("button");
    copyBtn.addClass("image-enlarge-btn");
    copyBtn.textContent = "Copy";
    const copyPathBtn = document.createElement("button");
    copyPathBtn.addClass("image-enlarge-btn");
    copyPathBtn.textContent = "Copy Path";
    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(copyPathBtn);
    overlay.appendChild(imgView);
    overlay.appendChild(btnGroup);
    document.body.appendChild(overlay);
    if (imgView.complete && imgView.naturalWidth > 0) {
      this.calculateFitSize(imgView);
    } else {
      imgView.onload = () => {
        if (!this.overlayEl)
          return;
        this.calculateFitSize(imgView);
      };
    }
    const controller = new AbortController();
    this.overlayAbortController = controller;
    const { signal } = controller;
    imgView.addEventListener("dragstart", (e) => e.preventDefault(), { signal });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay)
        this.closeOverlay();
    }, { signal });
    this.overlayScope = new import_obsidian.Scope();
    this.overlayScope.register(null, "Escape", () => {
      this.closeOverlay();
      return false;
    });
    this.overlayScope.register(["Mod"], "c", () => {
      this.copyImageToClipboard(imgView);
      return false;
    });
    this.overlayScope.register(["Mod", "Shift"], "c", () => {
      this.copyImagePath(src);
      return false;
    });
    this.app.keymap.pushScope(this.overlayScope);
    imgView.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomIn = e.deltaY < 0;
      const ratio = zoomIn ? 0.1 : -0.1;
      const rect = imgView.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      if (this.rafId !== null)
        cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.zoom(ratio, { offsetX, offsetY });
        this.applyTransform(imgView);
      });
    }, { signal });
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.copyImageToClipboard(imgView);
    }, { signal });
    copyPathBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.copyImagePath(src);
    }, { signal });
  }
  calculateFitSize(imgView) {
    const winW = document.documentElement.clientWidth;
    const winH = document.documentElement.clientHeight - BUTTON_AREA_HEIGHT;
    const zoomW = winW * ZOOM_FACTOR;
    const zoomH = winH * ZOOM_FACTOR;
    let w = imgView.naturalWidth, h = imgView.naturalHeight;
    if (h > zoomH) {
      h = zoomH;
      w = h / imgView.naturalHeight * imgView.naturalWidth;
      if (w > zoomW)
        w = zoomW;
    } else if (w > zoomW) {
      w = zoomW;
    }
    h = w * imgView.naturalHeight / imgView.naturalWidth;
    this.imgInfo = {
      curWidth: w,
      curHeight: h,
      realWidth: imgView.naturalWidth,
      realHeight: imgView.naturalHeight,
      left: (winW - w) / 2,
      top: (winH - h) / 2
    };
    this.applyTransform(imgView);
  }
  zoom(ratio, offset) {
    const info = this.imgInfo;
    const zoomIn = ratio > 0;
    const multiplier = zoomIn ? 1 + ratio : 1 / (1 - ratio);
    let zoomRatio = info.curWidth * multiplier / info.realWidth;
    const curRatio = info.curWidth / info.realWidth;
    if (curRatio < 1 && zoomRatio > 1 || curRatio > 1 && zoomRatio < 1) {
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
    if (newW < IMG_VIEW_MIN || newH < IMG_VIEW_MIN) {
      if (newW < IMG_VIEW_MIN) {
        newW = IMG_VIEW_MIN;
        newH = newW * info.realHeight / info.realWidth;
      } else {
        newH = IMG_VIEW_MIN;
        newW = newH * info.realWidth / info.realHeight;
      }
      info.curWidth = newW;
      info.curHeight = newH;
      return;
    }
    info.left += offset.offsetX * (1 - multiplier);
    info.top += offset.offsetY * (1 - multiplier);
    info.curWidth = newW;
    info.curHeight = newH;
  }
  applyTransform(imgView) {
    const info = this.imgInfo;
    imgView.style.width = `${info.curWidth}px`;
    imgView.style.height = `${info.curHeight}px`;
    imgView.style.transform = `translate(${info.left}px, ${info.top}px)`;
  }
  copyImagePath(src) {
    let path = src;
    try {
      const url = new URL(src);
      const decodedPath = decodeURIComponent(url.pathname);
      const vaultBasePath = this.app.vault.adapter instanceof import_obsidian.FileSystemAdapter ? this.app.vault.adapter.getBasePath() : null;
      if (vaultBasePath && decodedPath.includes(vaultBasePath)) {
        const idx = decodedPath.indexOf(vaultBasePath);
        path = decodedPath.substring(idx + vaultBasePath.length);
        if (path.startsWith("/"))
          path = path.substring(1);
      } else {
        path = decodedPath;
        if (path.startsWith("/"))
          path = path.substring(1);
      }
    } catch (e) {
    }
    navigator.clipboard.writeText(path).then(
      () => new import_obsidian.Notice("Path copied: " + path),
      () => new import_obsidian.Notice("Failed to copy path")
    );
  }
  copyImageToClipboard(imgView) {
    const image = new Image();
    const isFileUrl = imgView.src.startsWith("file:");
    if (!isFileUrl) {
      image.crossOrigin = "anonymous";
    }
    image.src = imgView.src;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      let w = image.naturalWidth;
      let h = image.naturalHeight;
      if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
        const scale = Math.min(MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h);
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx)
        return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, w, h);
      try {
        canvas.toBlob(async (blob) => {
          canvas.width = 0;
          if (!blob) {
            new import_obsidian.Notice("Failed to copy image");
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob })
            ]);
            new import_obsidian.Notice("Image copied");
          } catch (e) {
            new import_obsidian.Notice("Failed to copy image");
          }
        });
      } catch (err) {
        new import_obsidian.Notice("Failed to copy image");
        console.error(err);
      }
    };
    image.onerror = () => {
      new import_obsidian.Notice("Failed to copy image");
    };
  }
  closeOverlay() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.overlayAbortController) {
      this.overlayAbortController.abort();
      this.overlayAbortController = null;
    }
    if (this.overlayScope) {
      this.app.keymap.popScope(this.overlayScope);
      this.overlayScope = null;
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgRmlsZVN5c3RlbUFkYXB0ZXIsIE5vdGljZSwgUGx1Z2luLCBTY29wZSB9IGZyb20gJ29ic2lkaWFuJztcblxuY29uc3QgSU1HX1NFTEVDVE9SID0gYC53b3Jrc3BhY2UtbGVhZi1jb250ZW50W2RhdGEtdHlwZT0nbWFya2Rvd24nXSBpbWc6bm90KGEgaW1nKSwgLndvcmtzcGFjZS1sZWFmLWNvbnRlbnRbZGF0YS10eXBlPSdpbWFnZSddIGltZ2A7XG5jb25zdCBaT09NX0ZBQ1RPUiA9IDAuODtcbmNvbnN0IElNR19WSUVXX01JTiA9IDMwO1xuY29uc3QgQlVUVE9OX0FSRUFfSEVJR0hUID0gMTAwOyAvLyBib3R0b20gYnV0dG9uIGdyb3VwIGNsZWFyYW5jZVxuY29uc3QgTUFYX0NBTlZBU19ESU0gPSA4MTkyO1xuXG5pbnRlcmZhY2UgSW1nSW5mbyB7XG4gIGN1cldpZHRoOiBudW1iZXI7XG4gIGN1ckhlaWdodDogbnVtYmVyO1xuICByZWFsV2lkdGg6IG51bWJlcjtcbiAgcmVhbEhlaWdodDogbnVtYmVyO1xuICBsZWZ0OiBudW1iZXI7XG4gIHRvcDogbnVtYmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbWFnZUVubGFyZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIG92ZXJsYXlFbDogSFRNTERpdkVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpbWdJbmZvOiBJbWdJbmZvID0geyBjdXJXaWR0aDogMCwgY3VySGVpZ2h0OiAwLCByZWFsV2lkdGg6IDAsIHJlYWxIZWlnaHQ6IDAsIGxlZnQ6IDAsIHRvcDogMCB9O1xuICBwcml2YXRlIG92ZXJsYXlTY29wZTogU2NvcGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBvdmVybGF5QWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByYWZJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBoYW5kbGVJbWFnZUNsaWNrID0gKGV2dDogTW91c2VFdmVudCkgPT4ge1xuICAgIGNvbnN0IHRhcmdldCA9IGV2dC50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29uc3QgaW1nID0gdGFyZ2V0IGluc3RhbmNlb2YgSFRNTEltYWdlRWxlbWVudFxuICAgICAgPyB0YXJnZXRcbiAgICAgIDogdGFyZ2V0LmNsb3Nlc3QoJ2ltZycpO1xuICAgIGlmICghaW1nIHx8ICEoaW1nIGluc3RhbmNlb2YgSFRNTEltYWdlRWxlbWVudCkpIHJldHVybjtcbiAgICBpZiAoIWltZy5tYXRjaGVzKElNR19TRUxFQ1RPUikpIHJldHVybjtcbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHJldHVybjtcbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7IC8vIE9ic2lkaWFuIFx1NTA3NFx1MzA2RVx1MzBDRlx1MzBGM1x1MzBDOVx1MzBFOVx1MzA0Q1x1NzUzQlx1NTBDRlx1MzA5Mlx1NTIyNVx1MzBEQVx1MzBBNFx1MzBGM1x1MzA2N1x1OTU4Qlx1MzA0Rlx1MzA2RVx1MzA5Mlx1OTYzMlx1MzA1MFxuICAgIHRoaXMub3Blbk92ZXJsYXkoaW1nLnNyYyk7XG4gIH07XG5cbiAgb25sb2FkKCkge1xuICAgIC8vIGNhcHR1cmU6IHRydWUgXHUyMDE0IE9ic2lkaWFuL0NNNiBcdTMwNkUgc3RvcFByb3BhZ2F0aW9uIFx1MzA4OFx1MzA4QVx1NTE0OFx1MzA2Qlx1NzY3QVx1NzA2QlxuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChkb2N1bWVudCwgJ2NsaWNrJywgdGhpcy5oYW5kbGVJbWFnZUNsaWNrLCB0cnVlKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge1xuICAgIHRoaXMuY2xvc2VPdmVybGF5KCk7XG4gIH1cblxuICBwcml2YXRlIG9wZW5PdmVybGF5KHNyYzogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMub3ZlcmxheUVsKSByZXR1cm47XG5cbiAgICAvLyBDcmVhdGUgb3ZlcmxheVxuICAgIGNvbnN0IG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBvdmVybGF5LmFkZENsYXNzKCdpbWFnZS1lbmxhcmdlLW92ZXJsYXknKTtcbiAgICB0aGlzLm92ZXJsYXlFbCA9IG92ZXJsYXk7XG5cbiAgICAvLyBDcmVhdGUgaW1hZ2Ugdmlld1xuICAgIGNvbnN0IGltZ1ZpZXcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICBpbWdWaWV3LmFkZENsYXNzKCdpbWFnZS1lbmxhcmdlLXZpZXcnKTtcbiAgICBpbWdWaWV3LnNyYyA9IHNyYztcblxuICAgIC8vIENyZWF0ZSBidXR0b24gZ3JvdXBcbiAgICBjb25zdCBidG5Hcm91cCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGJ0bkdyb3VwLmFkZENsYXNzKCdpbWFnZS1lbmxhcmdlLWJ0bi1ncm91cCcpO1xuXG4gICAgY29uc3QgY29weUJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGNvcHlCdG4uYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2UtYnRuJyk7XG4gICAgY29weUJ0bi50ZXh0Q29udGVudCA9ICdDb3B5JztcblxuICAgIGNvbnN0IGNvcHlQYXRoQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgY29weVBhdGhCdG4uYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2UtYnRuJyk7XG4gICAgY29weVBhdGhCdG4udGV4dENvbnRlbnQgPSAnQ29weSBQYXRoJztcblxuICAgIGJ0bkdyb3VwLmFwcGVuZENoaWxkKGNvcHlCdG4pO1xuICAgIGJ0bkdyb3VwLmFwcGVuZENoaWxkKGNvcHlQYXRoQnRuKTtcbiAgICBvdmVybGF5LmFwcGVuZENoaWxkKGltZ1ZpZXcpO1xuICAgIG92ZXJsYXkuYXBwZW5kQ2hpbGQoYnRuR3JvdXApO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3ZlcmxheSk7XG5cbiAgICAvLyBVc2UgaW1nVmlldyBsb2FkIGV2ZW50IHRvIGNhbGN1bGF0ZSBmaXQgc2l6ZSAoYXZvaWRzIGRvdWJsZS1sb2FkaW5nKVxuICAgIGlmIChpbWdWaWV3LmNvbXBsZXRlICYmIGltZ1ZpZXcubmF0dXJhbFdpZHRoID4gMCkge1xuICAgICAgdGhpcy5jYWxjdWxhdGVGaXRTaXplKGltZ1ZpZXcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbWdWaWV3Lm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLm92ZXJsYXlFbCkgcmV0dXJuOyAvLyBndWFyZDogb3ZlcmxheSBtYXkgaGF2ZSBjbG9zZWQgYmVmb3JlIGltYWdlIGxvYWRlZFxuICAgICAgICB0aGlzLmNhbGN1bGF0ZUZpdFNpemUoaW1nVmlldyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEFib3J0Q29udHJvbGxlciBmb3IgYmF0Y2ggZXZlbnQgbGlzdGVuZXIgY2xlYW51cFxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgdGhpcy5vdmVybGF5QWJvcnRDb250cm9sbGVyID0gY29udHJvbGxlcjtcbiAgICBjb25zdCB7IHNpZ25hbCB9ID0gY29udHJvbGxlcjtcblxuICAgIC8vIFByZXZlbnQgYWNjaWRlbnRhbCBkcmFnXG4gICAgaW1nVmlldy5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCAoZSkgPT4gZS5wcmV2ZW50RGVmYXVsdCgpLCB7IHNpZ25hbCB9KTtcblxuICAgIC8vIENsb3NlIG9uIGJhY2tncm91bmQgY2xpY2tcbiAgICBvdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGlmIChlLnRhcmdldCA9PT0gb3ZlcmxheSkgdGhpcy5jbG9zZU92ZXJsYXkoKTtcbiAgICB9LCB7IHNpZ25hbCB9KTtcblxuICAgIC8vIEtleWJvYXJkIHZpYSBPYnNpZGlhbiBTY29wZSBcdTIwMTQgaW50ZWdyYXRlcyB3aXRoIEtleW1hcCBzeXN0ZW1cbiAgICB0aGlzLm92ZXJsYXlTY29wZSA9IG5ldyBTY29wZSgpO1xuICAgIHRoaXMub3ZlcmxheVNjb3BlLnJlZ2lzdGVyKG51bGwsICdFc2NhcGUnLCAoKSA9PiB7XG4gICAgICB0aGlzLmNsb3NlT3ZlcmxheSgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICAgIHRoaXMub3ZlcmxheVNjb3BlLnJlZ2lzdGVyKFsnTW9kJ10sICdjJywgKCkgPT4ge1xuICAgICAgdGhpcy5jb3B5SW1hZ2VUb0NsaXBib2FyZChpbWdWaWV3KTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcbiAgICB0aGlzLm92ZXJsYXlTY29wZS5yZWdpc3RlcihbJ01vZCcsICdTaGlmdCddLCAnYycsICgpID0+IHtcbiAgICAgIHRoaXMuY29weUltYWdlUGF0aChzcmMpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICAgIHRoaXMuYXBwLmtleW1hcC5wdXNoU2NvcGUodGhpcy5vdmVybGF5U2NvcGUpO1xuXG4gICAgLy8gTW91c2V3aGVlbCB6b29tIHdpdGggUkFGIHRocm90dGxpbmcgdG8gcHJldmVudCBsYXlvdXQgdGhyYXNoaW5nXG4gICAgaW1nVmlldy5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBjb25zdCB6b29tSW4gPSBlLmRlbHRhWSA8IDA7XG4gICAgICBjb25zdCByYXRpbyA9IHpvb21JbiA/IDAuMSA6IC0wLjE7XG4gICAgICBjb25zdCByZWN0ID0gaW1nVmlldy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGNvbnN0IG9mZnNldFggPSBlLmNsaWVudFggLSByZWN0LmxlZnQ7XG4gICAgICBjb25zdCBvZmZzZXRZID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gICAgICBpZiAodGhpcy5yYWZJZCAhPT0gbnVsbCkgY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5yYWZJZCk7XG4gICAgICB0aGlzLnJhZklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgdGhpcy5yYWZJZCA9IG51bGw7XG4gICAgICAgIHRoaXMuem9vbShyYXRpbywgeyBvZmZzZXRYLCBvZmZzZXRZIH0pO1xuICAgICAgICB0aGlzLmFwcGx5VHJhbnNmb3JtKGltZ1ZpZXcpO1xuICAgICAgfSk7XG4gICAgfSwgeyBzaWduYWwgfSk7XG5cbiAgICAvLyBDb3B5IGJ1dHRvblxuICAgIGNvcHlCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHRoaXMuY29weUltYWdlVG9DbGlwYm9hcmQoaW1nVmlldyk7XG4gICAgfSwgeyBzaWduYWwgfSk7XG5cbiAgICAvLyBDb3B5IFBhdGggYnV0dG9uXG4gICAgY29weVBhdGhCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHRoaXMuY29weUltYWdlUGF0aChzcmMpO1xuICAgIH0sIHsgc2lnbmFsIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVGaXRTaXplKGltZ1ZpZXc6IEhUTUxJbWFnZUVsZW1lbnQpIHtcbiAgICBjb25zdCB3aW5XID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoO1xuICAgIGNvbnN0IHdpbkggPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IC0gQlVUVE9OX0FSRUFfSEVJR0hUO1xuICAgIGNvbnN0IHpvb21XID0gd2luVyAqIFpPT01fRkFDVE9SO1xuICAgIGNvbnN0IHpvb21IID0gd2luSCAqIFpPT01fRkFDVE9SO1xuXG4gICAgbGV0IHcgPSBpbWdWaWV3Lm5hdHVyYWxXaWR0aCwgaCA9IGltZ1ZpZXcubmF0dXJhbEhlaWdodDtcbiAgICBpZiAoaCA+IHpvb21IKSB7XG4gICAgICBoID0gem9vbUg7XG4gICAgICB3ID0gaCAvIGltZ1ZpZXcubmF0dXJhbEhlaWdodCAqIGltZ1ZpZXcubmF0dXJhbFdpZHRoO1xuICAgICAgaWYgKHcgPiB6b29tVykgdyA9IHpvb21XO1xuICAgIH0gZWxzZSBpZiAodyA+IHpvb21XKSB7XG4gICAgICB3ID0gem9vbVc7XG4gICAgfVxuICAgIGggPSB3ICogaW1nVmlldy5uYXR1cmFsSGVpZ2h0IC8gaW1nVmlldy5uYXR1cmFsV2lkdGg7XG5cbiAgICB0aGlzLmltZ0luZm8gPSB7XG4gICAgICBjdXJXaWR0aDogdyxcbiAgICAgIGN1ckhlaWdodDogaCxcbiAgICAgIHJlYWxXaWR0aDogaW1nVmlldy5uYXR1cmFsV2lkdGgsXG4gICAgICByZWFsSGVpZ2h0OiBpbWdWaWV3Lm5hdHVyYWxIZWlnaHQsXG4gICAgICBsZWZ0OiAod2luVyAtIHcpIC8gMixcbiAgICAgIHRvcDogKHdpbkggLSBoKSAvIDIsXG4gICAgfTtcbiAgICB0aGlzLmFwcGx5VHJhbnNmb3JtKGltZ1ZpZXcpO1xuICB9XG5cbiAgcHJpdmF0ZSB6b29tKHJhdGlvOiBudW1iZXIsIG9mZnNldDogeyBvZmZzZXRYOiBudW1iZXI7IG9mZnNldFk6IG51bWJlciB9KSB7XG4gICAgY29uc3QgaW5mbyA9IHRoaXMuaW1nSW5mbztcbiAgICBjb25zdCB6b29tSW4gPSByYXRpbyA+IDA7XG4gICAgY29uc3QgbXVsdGlwbGllciA9IHpvb21JbiA/IDEgKyByYXRpbyA6IDEgLyAoMSAtIHJhdGlvKTtcbiAgICBsZXQgem9vbVJhdGlvID0gaW5mby5jdXJXaWR0aCAqIG11bHRpcGxpZXIgLyBpbmZvLnJlYWxXaWR0aDtcblxuICAgIC8vIFNuYXAgdG8gMTAwJSB3aGVuIGNyb3NzaW5nIHRoZSAxOjEgdGhyZXNob2xkXG4gICAgY29uc3QgY3VyUmF0aW8gPSBpbmZvLmN1cldpZHRoIC8gaW5mby5yZWFsV2lkdGg7XG4gICAgaWYgKChjdXJSYXRpbyA8IDEgJiYgem9vbVJhdGlvID4gMSkgfHwgKGN1clJhdGlvID4gMSAmJiB6b29tUmF0aW8gPCAxKSkge1xuICAgICAgem9vbVJhdGlvID0gMTtcbiAgICAgIGNvbnN0IHNuYXBNdWx0aXBsaWVyID0gMSAvIGN1clJhdGlvO1xuICAgICAgaW5mby5sZWZ0ICs9IG9mZnNldC5vZmZzZXRYICogKDEgLSBzbmFwTXVsdGlwbGllcik7XG4gICAgICBpbmZvLnRvcCArPSBvZmZzZXQub2Zmc2V0WSAqICgxIC0gc25hcE11bHRpcGxpZXIpO1xuICAgICAgaW5mby5jdXJXaWR0aCA9IGluZm8ucmVhbFdpZHRoO1xuICAgICAgaW5mby5jdXJIZWlnaHQgPSBpbmZvLnJlYWxIZWlnaHQ7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IG5ld1cgPSBpbmZvLnJlYWxXaWR0aCAqIHpvb21SYXRpbztcbiAgICBsZXQgbmV3SCA9IGluZm8ucmVhbEhlaWdodCAqIHpvb21SYXRpbztcblxuICAgIC8vIEVuZm9yY2UgbWluaW11bSBzaXplXG4gICAgaWYgKG5ld1cgPCBJTUdfVklFV19NSU4gfHwgbmV3SCA8IElNR19WSUVXX01JTikge1xuICAgICAgaWYgKG5ld1cgPCBJTUdfVklFV19NSU4pIHtcbiAgICAgICAgbmV3VyA9IElNR19WSUVXX01JTjtcbiAgICAgICAgbmV3SCA9IG5ld1cgKiBpbmZvLnJlYWxIZWlnaHQgLyBpbmZvLnJlYWxXaWR0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld0ggPSBJTUdfVklFV19NSU47XG4gICAgICAgIG5ld1cgPSBuZXdIICogaW5mby5yZWFsV2lkdGggLyBpbmZvLnJlYWxIZWlnaHQ7XG4gICAgICB9XG4gICAgICBpbmZvLmN1cldpZHRoID0gbmV3VztcbiAgICAgIGluZm8uY3VySGVpZ2h0ID0gbmV3SDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpbmZvLmxlZnQgKz0gb2Zmc2V0Lm9mZnNldFggKiAoMSAtIG11bHRpcGxpZXIpO1xuICAgIGluZm8udG9wICs9IG9mZnNldC5vZmZzZXRZICogKDEgLSBtdWx0aXBsaWVyKTtcbiAgICBpbmZvLmN1cldpZHRoID0gbmV3VztcbiAgICBpbmZvLmN1ckhlaWdodCA9IG5ld0g7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5VHJhbnNmb3JtKGltZ1ZpZXc6IEhUTUxJbWFnZUVsZW1lbnQpIHtcbiAgICBjb25zdCBpbmZvID0gdGhpcy5pbWdJbmZvO1xuICAgIGltZ1ZpZXcuc3R5bGUud2lkdGggPSBgJHtpbmZvLmN1cldpZHRofXB4YDtcbiAgICBpbWdWaWV3LnN0eWxlLmhlaWdodCA9IGAke2luZm8uY3VySGVpZ2h0fXB4YDtcbiAgICBpbWdWaWV3LnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtpbmZvLmxlZnR9cHgsICR7aW5mby50b3B9cHgpYDtcbiAgfVxuXG4gIHByaXZhdGUgY29weUltYWdlUGF0aChzcmM6IHN0cmluZyk6IHZvaWQge1xuICAgIGxldCBwYXRoID0gc3JjO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHNyYyk7XG4gICAgICBjb25zdCBkZWNvZGVkUGF0aCA9IGRlY29kZVVSSUNvbXBvbmVudCh1cmwucGF0aG5hbWUpO1xuICAgICAgY29uc3QgdmF1bHRCYXNlUGF0aCA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgaW5zdGFuY2VvZiBGaWxlU3lzdGVtQWRhcHRlclxuICAgICAgICA/IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZ2V0QmFzZVBhdGgoKVxuICAgICAgICA6IG51bGw7XG4gICAgICBpZiAodmF1bHRCYXNlUGF0aCAmJiBkZWNvZGVkUGF0aC5pbmNsdWRlcyh2YXVsdEJhc2VQYXRoKSkge1xuICAgICAgICBjb25zdCBpZHggPSBkZWNvZGVkUGF0aC5pbmRleE9mKHZhdWx0QmFzZVBhdGgpO1xuICAgICAgICBwYXRoID0gZGVjb2RlZFBhdGguc3Vic3RyaW5nKGlkeCArIHZhdWx0QmFzZVBhdGgubGVuZ3RoKTtcbiAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnLycpKSBwYXRoID0gcGF0aC5zdWJzdHJpbmcoMSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXRoID0gZGVjb2RlZFBhdGg7XG4gICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy8nKSkgcGF0aCA9IHBhdGguc3Vic3RyaW5nKDEpO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gSWYgbm90IGEgdmFsaWQgVVJMLCB1c2UgYXMtaXNcbiAgICB9XG4gICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQocGF0aCkudGhlbihcbiAgICAgICgpID0+IG5ldyBOb3RpY2UoJ1BhdGggY29waWVkOiAnICsgcGF0aCksXG4gICAgICAoKSA9PiBuZXcgTm90aWNlKCdGYWlsZWQgdG8gY29weSBwYXRoJylcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBjb3B5SW1hZ2VUb0NsaXBib2FyZChpbWdWaWV3OiBIVE1MSW1hZ2VFbGVtZW50KTogdm9pZCB7XG4gICAgY29uc3QgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICBjb25zdCBpc0ZpbGVVcmwgPSBpbWdWaWV3LnNyYy5zdGFydHNXaXRoKCdmaWxlOicpO1xuICAgIGlmICghaXNGaWxlVXJsKSB7XG4gICAgICBpbWFnZS5jcm9zc09yaWdpbiA9ICdhbm9ueW1vdXMnO1xuICAgIH1cbiAgICBpbWFnZS5zcmMgPSBpbWdWaWV3LnNyYztcbiAgICBpbWFnZS5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgIGxldCB3ID0gaW1hZ2UubmF0dXJhbFdpZHRoO1xuICAgICAgbGV0IGggPSBpbWFnZS5uYXR1cmFsSGVpZ2h0O1xuICAgICAgaWYgKHcgPiBNQVhfQ0FOVkFTX0RJTSB8fCBoID4gTUFYX0NBTlZBU19ESU0pIHtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBNYXRoLm1pbihNQVhfQ0FOVkFTX0RJTSAvIHcsIE1BWF9DQU5WQVNfRElNIC8gaCk7XG4gICAgICAgIHcgPSBNYXRoLmZsb29yKHcgKiBzY2FsZSk7XG4gICAgICAgIGggPSBNYXRoLmZsb29yKGggKiBzY2FsZSk7XG4gICAgICB9XG4gICAgICBjYW52YXMud2lkdGggPSB3O1xuICAgICAgY2FudmFzLmhlaWdodCA9IGg7XG4gICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgIGlmICghY3R4KSByZXR1cm47XG4gICAgICBjdHguZmlsbFN0eWxlID0gJyNmZmYnO1xuICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICBjdHguZHJhd0ltYWdlKGltYWdlLCAwLCAwLCB3LCBoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNhbnZhcy50b0Jsb2IoYXN5bmMgKGJsb2IpID0+IHtcbiAgICAgICAgICBjYW52YXMud2lkdGggPSAwOyAvLyByZWxlYXNlIEdQVSBtZW1vcnlcbiAgICAgICAgICBpZiAoIWJsb2IpIHtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBjb3B5IGltYWdlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlKFtcbiAgICAgICAgICAgICAgbmV3IENsaXBib2FyZEl0ZW0oeyAnaW1hZ2UvcG5nJzogYmxvYiB9KSxcbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgbmV3IE5vdGljZSgnSW1hZ2UgY29waWVkJyk7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBuZXcgTm90aWNlKCdGYWlsZWQgdG8gY29weSBpbWFnZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbmV3IE5vdGljZSgnRmFpbGVkIHRvIGNvcHkgaW1hZ2UnKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgfVxuICAgIH07XG4gICAgaW1hZ2Uub25lcnJvciA9ICgpID0+IHtcbiAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBjb3B5IGltYWdlJyk7XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgY2xvc2VPdmVybGF5KCkge1xuICAgIGlmICh0aGlzLnJhZklkICE9PSBudWxsKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLnJhZklkKTtcbiAgICAgIHRoaXMucmFmSWQgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5vdmVybGF5QWJvcnRDb250cm9sbGVyKSB7XG4gICAgICB0aGlzLm92ZXJsYXlBYm9ydENvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgIHRoaXMub3ZlcmxheUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLm92ZXJsYXlTY29wZSkge1xuICAgICAgdGhpcy5hcHAua2V5bWFwLnBvcFNjb3BlKHRoaXMub3ZlcmxheVNjb3BlKTtcbiAgICAgIHRoaXMub3ZlcmxheVNjb3BlID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMub3ZlcmxheUVsKSB7XG4gICAgICB0aGlzLm92ZXJsYXlFbC5yZW1vdmUoKTtcbiAgICAgIHRoaXMub3ZlcmxheUVsID0gbnVsbDtcbiAgICB9XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUF5RDtBQUV6RCxJQUFNLGVBQWU7QUFDckIsSUFBTSxjQUFjO0FBQ3BCLElBQU0sZUFBZTtBQUNyQixJQUFNLHFCQUFxQjtBQUMzQixJQUFNLGlCQUFpQjtBQVd2QixJQUFxQixxQkFBckIsY0FBZ0QsdUJBQU87QUFBQSxFQUF2RDtBQUFBO0FBQ0UsU0FBUSxZQUFtQztBQUMzQyxTQUFRLFVBQW1CLEVBQUUsVUFBVSxHQUFHLFdBQVcs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
