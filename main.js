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
    this.handleImageClick = (evt, delegateTarget) => {
      if (this.overlayEl)
        return;
      evt.preventDefault();
      this.openOverlay(delegateTarget.src);
    };
  }
  onload() {
    document.on("click", IMG_SELECTOR, this.handleImageClick);
    this.register(() => document.off("click", IMG_SELECTOR, this.handleImageClick));
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgRmlsZVN5c3RlbUFkYXB0ZXIsIE5vdGljZSwgUGx1Z2luLCBTY29wZSB9IGZyb20gJ29ic2lkaWFuJztcblxuY29uc3QgSU1HX1NFTEVDVE9SID0gYC53b3Jrc3BhY2UtbGVhZi1jb250ZW50W2RhdGEtdHlwZT0nbWFya2Rvd24nXSBpbWc6bm90KGEgaW1nKSwgLndvcmtzcGFjZS1sZWFmLWNvbnRlbnRbZGF0YS10eXBlPSdpbWFnZSddIGltZ2A7XG5jb25zdCBaT09NX0ZBQ1RPUiA9IDAuODtcbmNvbnN0IElNR19WSUVXX01JTiA9IDMwO1xuY29uc3QgQlVUVE9OX0FSRUFfSEVJR0hUID0gMTAwOyAvLyBib3R0b20gYnV0dG9uIGdyb3VwIGNsZWFyYW5jZVxuY29uc3QgTUFYX0NBTlZBU19ESU0gPSA4MTkyO1xuXG5pbnRlcmZhY2UgSW1nSW5mbyB7XG4gIGN1cldpZHRoOiBudW1iZXI7XG4gIGN1ckhlaWdodDogbnVtYmVyO1xuICByZWFsV2lkdGg6IG51bWJlcjtcbiAgcmVhbEhlaWdodDogbnVtYmVyO1xuICBsZWZ0OiBudW1iZXI7XG4gIHRvcDogbnVtYmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbWFnZUVubGFyZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIG92ZXJsYXlFbDogSFRNTERpdkVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpbWdJbmZvOiBJbWdJbmZvID0geyBjdXJXaWR0aDogMCwgY3VySGVpZ2h0OiAwLCByZWFsV2lkdGg6IDAsIHJlYWxIZWlnaHQ6IDAsIGxlZnQ6IDAsIHRvcDogMCB9O1xuICBwcml2YXRlIG92ZXJsYXlTY29wZTogU2NvcGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBvdmVybGF5QWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByYWZJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBoYW5kbGVJbWFnZUNsaWNrID0gKGV2dDogTW91c2VFdmVudCwgZGVsZWdhdGVUYXJnZXQ6IEhUTUxJbWFnZUVsZW1lbnQpID0+IHtcbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHJldHVybjtcbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLm9wZW5PdmVybGF5KGRlbGVnYXRlVGFyZ2V0LnNyYyk7XG4gIH07XG5cbiAgb25sb2FkKCkge1xuICAgIC8vIERlbGVnYXRlZCBjbGljayBoYW5kbGVyIFx1MjAxNCBidWJibGUgcGhhc2UsIG5vIGludGVyZmVyZW5jZSB3aXRoIE9ic2lkaWFuIGludGVybmFsc1xuICAgIGRvY3VtZW50Lm9uKCdjbGljaycsIElNR19TRUxFQ1RPUiwgdGhpcy5oYW5kbGVJbWFnZUNsaWNrKTtcbiAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IGRvY3VtZW50Lm9mZignY2xpY2snLCBJTUdfU0VMRUNUT1IsIHRoaXMuaGFuZGxlSW1hZ2VDbGljaykpO1xuICB9XG5cbiAgb251bmxvYWQoKSB7XG4gICAgdGhpcy5jbG9zZU92ZXJsYXkoKTtcbiAgfVxuXG4gIHByaXZhdGUgb3Blbk92ZXJsYXkoc3JjOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHJldHVybjtcblxuICAgIC8vIENyZWF0ZSBvdmVybGF5XG4gICAgY29uc3Qgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG92ZXJsYXkuYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2Utb3ZlcmxheScpO1xuICAgIHRoaXMub3ZlcmxheUVsID0gb3ZlcmxheTtcblxuICAgIC8vIENyZWF0ZSBpbWFnZSB2aWV3XG4gICAgY29uc3QgaW1nVmlldyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgIGltZ1ZpZXcuYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2UtdmlldycpO1xuICAgIGltZ1ZpZXcuc3JjID0gc3JjO1xuXG4gICAgLy8gQ3JlYXRlIGJ1dHRvbiBncm91cFxuICAgIGNvbnN0IGJ0bkdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgYnRuR3JvdXAuYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2UtYnRuLWdyb3VwJyk7XG5cbiAgICBjb25zdCBjb3B5QnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgY29weUJ0bi5hZGRDbGFzcygnaW1hZ2UtZW5sYXJnZS1idG4nKTtcbiAgICBjb3B5QnRuLnRleHRDb250ZW50ID0gJ0NvcHknO1xuXG4gICAgY29uc3QgY29weVBhdGhCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBjb3B5UGF0aEJ0bi5hZGRDbGFzcygnaW1hZ2UtZW5sYXJnZS1idG4nKTtcbiAgICBjb3B5UGF0aEJ0bi50ZXh0Q29udGVudCA9ICdDb3B5IFBhdGgnO1xuXG4gICAgYnRuR3JvdXAuYXBwZW5kQ2hpbGQoY29weUJ0bik7XG4gICAgYnRuR3JvdXAuYXBwZW5kQ2hpbGQoY29weVBhdGhCdG4pO1xuICAgIG92ZXJsYXkuYXBwZW5kQ2hpbGQoaW1nVmlldyk7XG4gICAgb3ZlcmxheS5hcHBlbmRDaGlsZChidG5Hcm91cCk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5KTtcblxuICAgIC8vIFVzZSBpbWdWaWV3IGxvYWQgZXZlbnQgdG8gY2FsY3VsYXRlIGZpdCBzaXplIChhdm9pZHMgZG91YmxlLWxvYWRpbmcpXG4gICAgaWYgKGltZ1ZpZXcuY29tcGxldGUgJiYgaW1nVmlldy5uYXR1cmFsV2lkdGggPiAwKSB7XG4gICAgICB0aGlzLmNhbGN1bGF0ZUZpdFNpemUoaW1nVmlldyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGltZ1ZpZXcub25sb2FkID0gKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMub3ZlcmxheUVsKSByZXR1cm47IC8vIGd1YXJkOiBvdmVybGF5IG1heSBoYXZlIGNsb3NlZCBiZWZvcmUgaW1hZ2UgbG9hZGVkXG4gICAgICAgIHRoaXMuY2FsY3VsYXRlRml0U2l6ZShpbWdWaWV3KTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQWJvcnRDb250cm9sbGVyIGZvciBiYXRjaCBldmVudCBsaXN0ZW5lciBjbGVhbnVwXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICB0aGlzLm92ZXJsYXlBYm9ydENvbnRyb2xsZXIgPSBjb250cm9sbGVyO1xuICAgIGNvbnN0IHsgc2lnbmFsIH0gPSBjb250cm9sbGVyO1xuXG4gICAgLy8gUHJldmVudCBhY2NpZGVudGFsIGRyYWdcbiAgICBpbWdWaWV3LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIChlKSA9PiBlLnByZXZlbnREZWZhdWx0KCksIHsgc2lnbmFsIH0pO1xuXG4gICAgLy8gQ2xvc2Ugb24gYmFja2dyb3VuZCBjbGlja1xuICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgaWYgKGUudGFyZ2V0ID09PSBvdmVybGF5KSB0aGlzLmNsb3NlT3ZlcmxheSgpO1xuICAgIH0sIHsgc2lnbmFsIH0pO1xuXG4gICAgLy8gS2V5Ym9hcmQgdmlhIE9ic2lkaWFuIFNjb3BlIFx1MjAxNCBpbnRlZ3JhdGVzIHdpdGggS2V5bWFwIHN5c3RlbVxuICAgIHRoaXMub3ZlcmxheVNjb3BlID0gbmV3IFNjb3BlKCk7XG4gICAgdGhpcy5vdmVybGF5U2NvcGUucmVnaXN0ZXIobnVsbCwgJ0VzY2FwZScsICgpID0+IHtcbiAgICAgIHRoaXMuY2xvc2VPdmVybGF5KCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG4gICAgdGhpcy5vdmVybGF5U2NvcGUucmVnaXN0ZXIoWydNb2QnXSwgJ2MnLCAoKSA9PiB7XG4gICAgICB0aGlzLmNvcHlJbWFnZVRvQ2xpcGJvYXJkKGltZ1ZpZXcpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICAgIHRoaXMub3ZlcmxheVNjb3BlLnJlZ2lzdGVyKFsnTW9kJywgJ1NoaWZ0J10sICdjJywgKCkgPT4ge1xuICAgICAgdGhpcy5jb3B5SW1hZ2VQYXRoKHNyYyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG4gICAgdGhpcy5hcHAua2V5bWFwLnB1c2hTY29wZSh0aGlzLm92ZXJsYXlTY29wZSk7XG5cbiAgICAvLyBNb3VzZXdoZWVsIHpvb20gd2l0aCBSQUYgdGhyb3R0bGluZyB0byBwcmV2ZW50IGxheW91dCB0aHJhc2hpbmdcbiAgICBpbWdWaWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGNvbnN0IHpvb21JbiA9IGUuZGVsdGFZIDwgMDtcbiAgICAgIGNvbnN0IHJhdGlvID0gem9vbUluID8gMC4xIDogLTAuMTtcbiAgICAgIGNvbnN0IHJlY3QgPSBpbWdWaWV3LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgY29uc3Qgb2Zmc2V0WCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICAgIGNvbnN0IG9mZnNldFkgPSBlLmNsaWVudFkgLSByZWN0LnRvcDtcbiAgICAgIGlmICh0aGlzLnJhZklkICE9PSBudWxsKSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLnJhZklkKTtcbiAgICAgIHRoaXMucmFmSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0aGlzLnJhZklkID0gbnVsbDtcbiAgICAgICAgdGhpcy56b29tKHJhdGlvLCB7IG9mZnNldFgsIG9mZnNldFkgfSk7XG4gICAgICAgIHRoaXMuYXBwbHlUcmFuc2Zvcm0oaW1nVmlldyk7XG4gICAgICB9KTtcbiAgICB9LCB7IHNpZ25hbCB9KTtcblxuICAgIC8vIENvcHkgYnV0dG9uXG4gICAgY29weUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGhpcy5jb3B5SW1hZ2VUb0NsaXBib2FyZChpbWdWaWV3KTtcbiAgICB9LCB7IHNpZ25hbCB9KTtcblxuICAgIC8vIENvcHkgUGF0aCBidXR0b25cbiAgICBjb3B5UGF0aEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGhpcy5jb3B5SW1hZ2VQYXRoKHNyYyk7XG4gICAgfSwgeyBzaWduYWwgfSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUZpdFNpemUoaW1nVmlldzogSFRNTEltYWdlRWxlbWVudCkge1xuICAgIGNvbnN0IHdpblcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XG4gICAgY29uc3Qgd2luSCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgLSBCVVRUT05fQVJFQV9IRUlHSFQ7XG4gICAgY29uc3Qgem9vbVcgPSB3aW5XICogWk9PTV9GQUNUT1I7XG4gICAgY29uc3Qgem9vbUggPSB3aW5IICogWk9PTV9GQUNUT1I7XG5cbiAgICBsZXQgdyA9IGltZ1ZpZXcubmF0dXJhbFdpZHRoLCBoID0gaW1nVmlldy5uYXR1cmFsSGVpZ2h0O1xuICAgIGlmIChoID4gem9vbUgpIHtcbiAgICAgIGggPSB6b29tSDtcbiAgICAgIHcgPSBoIC8gaW1nVmlldy5uYXR1cmFsSGVpZ2h0ICogaW1nVmlldy5uYXR1cmFsV2lkdGg7XG4gICAgICBpZiAodyA+IHpvb21XKSB3ID0gem9vbVc7XG4gICAgfSBlbHNlIGlmICh3ID4gem9vbVcpIHtcbiAgICAgIHcgPSB6b29tVztcbiAgICB9XG4gICAgaCA9IHcgKiBpbWdWaWV3Lm5hdHVyYWxIZWlnaHQgLyBpbWdWaWV3Lm5hdHVyYWxXaWR0aDtcblxuICAgIHRoaXMuaW1nSW5mbyA9IHtcbiAgICAgIGN1cldpZHRoOiB3LFxuICAgICAgY3VySGVpZ2h0OiBoLFxuICAgICAgcmVhbFdpZHRoOiBpbWdWaWV3Lm5hdHVyYWxXaWR0aCxcbiAgICAgIHJlYWxIZWlnaHQ6IGltZ1ZpZXcubmF0dXJhbEhlaWdodCxcbiAgICAgIGxlZnQ6ICh3aW5XIC0gdykgLyAyLFxuICAgICAgdG9wOiAod2luSCAtIGgpIC8gMixcbiAgICB9O1xuICAgIHRoaXMuYXBwbHlUcmFuc2Zvcm0oaW1nVmlldyk7XG4gIH1cblxuICBwcml2YXRlIHpvb20ocmF0aW86IG51bWJlciwgb2Zmc2V0OiB7IG9mZnNldFg6IG51bWJlcjsgb2Zmc2V0WTogbnVtYmVyIH0pIHtcbiAgICBjb25zdCBpbmZvID0gdGhpcy5pbWdJbmZvO1xuICAgIGNvbnN0IHpvb21JbiA9IHJhdGlvID4gMDtcbiAgICBjb25zdCBtdWx0aXBsaWVyID0gem9vbUluID8gMSArIHJhdGlvIDogMSAvICgxIC0gcmF0aW8pO1xuICAgIGxldCB6b29tUmF0aW8gPSBpbmZvLmN1cldpZHRoICogbXVsdGlwbGllciAvIGluZm8ucmVhbFdpZHRoO1xuXG4gICAgLy8gU25hcCB0byAxMDAlIHdoZW4gY3Jvc3NpbmcgdGhlIDE6MSB0aHJlc2hvbGRcbiAgICBjb25zdCBjdXJSYXRpbyA9IGluZm8uY3VyV2lkdGggLyBpbmZvLnJlYWxXaWR0aDtcbiAgICBpZiAoKGN1clJhdGlvIDwgMSAmJiB6b29tUmF0aW8gPiAxKSB8fCAoY3VyUmF0aW8gPiAxICYmIHpvb21SYXRpbyA8IDEpKSB7XG4gICAgICB6b29tUmF0aW8gPSAxO1xuICAgICAgY29uc3Qgc25hcE11bHRpcGxpZXIgPSAxIC8gY3VyUmF0aW87XG4gICAgICBpbmZvLmxlZnQgKz0gb2Zmc2V0Lm9mZnNldFggKiAoMSAtIHNuYXBNdWx0aXBsaWVyKTtcbiAgICAgIGluZm8udG9wICs9IG9mZnNldC5vZmZzZXRZICogKDEgLSBzbmFwTXVsdGlwbGllcik7XG4gICAgICBpbmZvLmN1cldpZHRoID0gaW5mby5yZWFsV2lkdGg7XG4gICAgICBpbmZvLmN1ckhlaWdodCA9IGluZm8ucmVhbEhlaWdodDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgbmV3VyA9IGluZm8ucmVhbFdpZHRoICogem9vbVJhdGlvO1xuICAgIGxldCBuZXdIID0gaW5mby5yZWFsSGVpZ2h0ICogem9vbVJhdGlvO1xuXG4gICAgLy8gRW5mb3JjZSBtaW5pbXVtIHNpemVcbiAgICBpZiAobmV3VyA8IElNR19WSUVXX01JTiB8fCBuZXdIIDwgSU1HX1ZJRVdfTUlOKSB7XG4gICAgICBpZiAobmV3VyA8IElNR19WSUVXX01JTikge1xuICAgICAgICBuZXdXID0gSU1HX1ZJRVdfTUlOO1xuICAgICAgICBuZXdIID0gbmV3VyAqIGluZm8ucmVhbEhlaWdodCAvIGluZm8ucmVhbFdpZHRoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3SCA9IElNR19WSUVXX01JTjtcbiAgICAgICAgbmV3VyA9IG5ld0ggKiBpbmZvLnJlYWxXaWR0aCAvIGluZm8ucmVhbEhlaWdodDtcbiAgICAgIH1cbiAgICAgIGluZm8uY3VyV2lkdGggPSBuZXdXO1xuICAgICAgaW5mby5jdXJIZWlnaHQgPSBuZXdIO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGluZm8ubGVmdCArPSBvZmZzZXQub2Zmc2V0WCAqICgxIC0gbXVsdGlwbGllcik7XG4gICAgaW5mby50b3AgKz0gb2Zmc2V0Lm9mZnNldFkgKiAoMSAtIG11bHRpcGxpZXIpO1xuICAgIGluZm8uY3VyV2lkdGggPSBuZXdXO1xuICAgIGluZm8uY3VySGVpZ2h0ID0gbmV3SDtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlUcmFuc2Zvcm0oaW1nVmlldzogSFRNTEltYWdlRWxlbWVudCkge1xuICAgIGNvbnN0IGluZm8gPSB0aGlzLmltZ0luZm87XG4gICAgaW1nVmlldy5zdHlsZS53aWR0aCA9IGAke2luZm8uY3VyV2lkdGh9cHhgO1xuICAgIGltZ1ZpZXcuc3R5bGUuaGVpZ2h0ID0gYCR7aW5mby5jdXJIZWlnaHR9cHhgO1xuICAgIGltZ1ZpZXcuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke2luZm8ubGVmdH1weCwgJHtpbmZvLnRvcH1weClgO1xuICB9XG5cbiAgcHJpdmF0ZSBjb3B5SW1hZ2VQYXRoKHNyYzogc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IHBhdGggPSBzcmM7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoc3JjKTtcbiAgICAgIGNvbnN0IGRlY29kZWRQYXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KHVybC5wYXRobmFtZSk7XG4gICAgICBjb25zdCB2YXVsdEJhc2VQYXRoID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlciBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1BZGFwdGVyXG4gICAgICAgID8gdGhpcy5hcHAudmF1bHQuYWRhcHRlci5nZXRCYXNlUGF0aCgpXG4gICAgICAgIDogbnVsbDtcbiAgICAgIGlmICh2YXVsdEJhc2VQYXRoICYmIGRlY29kZWRQYXRoLmluY2x1ZGVzKHZhdWx0QmFzZVBhdGgpKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IGRlY29kZWRQYXRoLmluZGV4T2YodmF1bHRCYXNlUGF0aCk7XG4gICAgICAgIHBhdGggPSBkZWNvZGVkUGF0aC5zdWJzdHJpbmcoaWR4ICsgdmF1bHRCYXNlUGF0aC5sZW5ndGgpO1xuICAgICAgICBpZiAocGF0aC5zdGFydHNXaXRoKCcvJykpIHBhdGggPSBwYXRoLnN1YnN0cmluZygxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhdGggPSBkZWNvZGVkUGF0aDtcbiAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnLycpKSBwYXRoID0gcGF0aC5zdWJzdHJpbmcoMSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZiBub3QgYSB2YWxpZCBVUkwsIHVzZSBhcy1pc1xuICAgIH1cbiAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChwYXRoKS50aGVuKFxuICAgICAgKCkgPT4gbmV3IE5vdGljZSgnUGF0aCBjb3BpZWQ6ICcgKyBwYXRoKSxcbiAgICAgICgpID0+IG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBjb3B5IHBhdGgnKVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGNvcHlJbWFnZVRvQ2xpcGJvYXJkKGltZ1ZpZXc6IEhUTUxJbWFnZUVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBpbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgIGNvbnN0IGlzRmlsZVVybCA9IGltZ1ZpZXcuc3JjLnN0YXJ0c1dpdGgoJ2ZpbGU6Jyk7XG4gICAgaWYgKCFpc0ZpbGVVcmwpIHtcbiAgICAgIGltYWdlLmNyb3NzT3JpZ2luID0gJ2Fub255bW91cyc7XG4gICAgfVxuICAgIGltYWdlLnNyYyA9IGltZ1ZpZXcuc3JjO1xuICAgIGltYWdlLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgbGV0IHcgPSBpbWFnZS5uYXR1cmFsV2lkdGg7XG4gICAgICBsZXQgaCA9IGltYWdlLm5hdHVyYWxIZWlnaHQ7XG4gICAgICBpZiAodyA+IE1BWF9DQU5WQVNfRElNIHx8IGggPiBNQVhfQ0FOVkFTX0RJTSkge1xuICAgICAgICBjb25zdCBzY2FsZSA9IE1hdGgubWluKE1BWF9DQU5WQVNfRElNIC8gdywgTUFYX0NBTlZBU19ESU0gLyBoKTtcbiAgICAgICAgdyA9IE1hdGguZmxvb3IodyAqIHNjYWxlKTtcbiAgICAgICAgaCA9IE1hdGguZmxvb3IoaCAqIHNjYWxlKTtcbiAgICAgIH1cbiAgICAgIGNhbnZhcy53aWR0aCA9IHc7XG4gICAgICBjYW52YXMuaGVpZ2h0ID0gaDtcbiAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgaWYgKCFjdHgpIHJldHVybjtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSAnI2ZmZic7XG4gICAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgIGN0eC5kcmF3SW1hZ2UoaW1hZ2UsIDAsIDAsIHcsIGgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY2FudmFzLnRvQmxvYihhc3luYyAoYmxvYikgPT4ge1xuICAgICAgICAgIGNhbnZhcy53aWR0aCA9IDA7IC8vIHJlbGVhc2UgR1BVIG1lbW9yeVxuICAgICAgICAgIGlmICghYmxvYikge1xuICAgICAgICAgICAgbmV3IE5vdGljZSgnRmFpbGVkIHRvIGNvcHkgaW1hZ2UnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGUoW1xuICAgICAgICAgICAgICBuZXcgQ2xpcGJvYXJkSXRlbSh7ICdpbWFnZS9wbmcnOiBibG9iIH0pLFxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBuZXcgTm90aWNlKCdJbWFnZSBjb3BpZWQnKTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBjb3B5IGltYWdlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBuZXcgTm90aWNlKCdGYWlsZWQgdG8gY29weSBpbWFnZScpO1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfTtcbiAgICBpbWFnZS5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgbmV3IE5vdGljZSgnRmFpbGVkIHRvIGNvcHkgaW1hZ2UnKTtcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjbG9zZU92ZXJsYXkoKSB7XG4gICAgaWYgKHRoaXMucmFmSWQgIT09IG51bGwpIHtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMucmFmSWQpO1xuICAgICAgdGhpcy5yYWZJZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLm92ZXJsYXlBYm9ydENvbnRyb2xsZXIpIHtcbiAgICAgIHRoaXMub3ZlcmxheUFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgdGhpcy5vdmVybGF5QWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMub3ZlcmxheVNjb3BlKSB7XG4gICAgICB0aGlzLmFwcC5rZXltYXAucG9wU2NvcGUodGhpcy5vdmVybGF5U2NvcGUpO1xuICAgICAgdGhpcy5vdmVybGF5U2NvcGUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHtcbiAgICAgIHRoaXMub3ZlcmxheUVsLnJlbW92ZSgpO1xuICAgICAgdGhpcy5vdmVybGF5RWwgPSBudWxsO1xuICAgIH1cbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBQXlEO0FBRXpELElBQU0sZUFBZTtBQUNyQixJQUFNLGNBQWM7QUFDcEIsSUFBTSxlQUFlO0FBQ3JCLElBQU0scUJBQXFCO0FBQzNCLElBQU0saUJBQWlCO0FBV3ZCLElBQXFCLHFCQUFyQixjQUFnRCx1QkFBTztBQUFBLEVBQXZEO0FBQUE7QUFDRSxTQUFRLFlBQW1DO0FBQzNDLFNBQVEsVUFBbUIsRUFBRSxVQUFVLEdBQUcsV0FBVyxHQUFHLFdBQVcsR0FBRyxZQUFZLEdBQUcsTUFBTSxHQUFHLEtBQUssRUFBRTtBQUNyRyxTQUFRLGVBQTZCO0FBQ3JDLFNBQVEseUJBQWlEO0FBQ3pELFNBQVEsUUFBdUI7QUFFL0IsU0FBUSxtQkFBbUIsQ0FBQyxLQUFpQixtQkFBcUM7QUFDaEYsVUFBSSxLQUFLO0FBQVc7QUFDcEIsVUFBSSxlQUFlO0FBQ25CLFdBQUssWUFBWSxlQUFlLEdBQUc7QUFBQSxJQUNyQztBQUFBO0FBQUEsRUFFQSxTQUFTO0FBRVAsYUFBUyxHQUFHLFNBQVMsY0FBYyxLQUFLLGdCQUFnQjtBQUN4RCxTQUFLLFNBQVMsTUFBTSxTQUFTLElBQUksU0FBUyxjQUFjLEtBQUss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
