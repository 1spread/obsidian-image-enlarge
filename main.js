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
var ImageEnlargePlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.overlayEl = null;
    this.imgInfo = { curWidth: 0, curHeight: 0, realWidth: 0, realHeight: 0, left: 0, top: 0 };
    this.currentImgSrc = "";
    this.overlayScope = null;
    // TODO(human): handleImageClick のイベントハンドラを実装してください
    this.handleImageClick = (evt, delegateTarget) => {
      if (this.overlayEl)
        return;
      evt.preventDefault();
      this.openOverlay(delegateTarget.src);
    };
  }
  async onload() {
    document.on("click", IMG_SELECTOR, this.handleImageClick);
    this.register(() => document.off("click", IMG_SELECTOR, this.handleImageClick));
  }
  onunload() {
    this.closeOverlay();
  }
  openOverlay(src) {
    if (this.overlayEl)
      return;
    this.currentImgSrc = src;
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
    const realImg = new Image();
    realImg.src = src;
    realImg.onload = () => {
      this.calculateFitSize(realImg, imgView);
    };
    if (realImg.complete) {
      this.calculateFitSize(realImg, imgView);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay)
        this.closeOverlay();
    });
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
      this.zoom(ratio, { offsetX, offsetY });
      this.applyTransform(imgView);
    });
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.copyImageToClipboard(imgView);
    });
    copyPathBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.copyImagePath(src);
    });
  }
  calculateFitSize(realImg, imgView) {
    const winW = document.documentElement.clientWidth;
    const winH = document.documentElement.clientHeight - 100;
    const zoomW = winW * ZOOM_FACTOR;
    const zoomH = winH * ZOOM_FACTOR;
    let w = realImg.naturalWidth, h = realImg.naturalHeight;
    if (h > zoomH) {
      h = zoomH;
      w = h / realImg.naturalHeight * realImg.naturalWidth;
      if (w > zoomW)
        w = zoomW;
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
      return;
    }
    info.left += offset.offsetX * (1 - multiplier);
    info.top += offset.offsetY * (1 - multiplier);
    info.curWidth = newW;
    info.curHeight = newH;
  }
  applyTransform(imgView) {
    const info = this.imgInfo;
    imgView.style.width = info.curWidth + "px";
    imgView.style.height = info.curHeight + "px";
    imgView.style.left = info.left + "px";
    imgView.style.top = info.top + "px";
  }
  copyImagePath(src) {
    let path = src;
    try {
      const url = new URL(src);
      const decodedPath = decodeURIComponent(url.pathname);
      const vaultBasePath = this.app.vault.adapter.basePath;
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
    image.crossOrigin = "anonymous";
    image.src = imgView.src;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx)
        return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      try {
        canvas.toBlob(async (blob) => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTm90aWNlLCBQbHVnaW4sIFNjb3BlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG5jb25zdCBJTUdfU0VMRUNUT1IgPSBgLndvcmtzcGFjZS1sZWFmLWNvbnRlbnRbZGF0YS10eXBlPSdtYXJrZG93biddIGltZzpub3QoYSBpbWcpLCAud29ya3NwYWNlLWxlYWYtY29udGVudFtkYXRhLXR5cGU9J2ltYWdlJ10gaW1nYDtcbmNvbnN0IFpPT01fRkFDVE9SID0gMC44O1xuY29uc3QgSU1HX1ZJRVdfTUlOID0gMzA7XG5cbmludGVyZmFjZSBJbWdJbmZvIHtcbiAgY3VyV2lkdGg6IG51bWJlcjtcbiAgY3VySGVpZ2h0OiBudW1iZXI7XG4gIHJlYWxXaWR0aDogbnVtYmVyO1xuICByZWFsSGVpZ2h0OiBudW1iZXI7XG4gIGxlZnQ6IG51bWJlcjtcbiAgdG9wOiBudW1iZXI7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEltYWdlRW5sYXJnZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHByaXZhdGUgb3ZlcmxheUVsOiBIVE1MRGl2RWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGltZ0luZm86IEltZ0luZm8gPSB7IGN1cldpZHRoOiAwLCBjdXJIZWlnaHQ6IDAsIHJlYWxXaWR0aDogMCwgcmVhbEhlaWdodDogMCwgbGVmdDogMCwgdG9wOiAwIH07XG4gIHByaXZhdGUgY3VycmVudEltZ1NyYyA9ICcnO1xuICBwcml2YXRlIG92ZXJsYXlTY29wZTogU2NvcGUgfCBudWxsID0gbnVsbDtcblxuICAvLyBUT0RPKGh1bWFuKTogaGFuZGxlSW1hZ2VDbGljayBcdTMwNkVcdTMwQTRcdTMwRDlcdTMwRjNcdTMwQzhcdTMwQ0ZcdTMwRjNcdTMwQzlcdTMwRTlcdTMwOTJcdTVCOUZcdTg4QzVcdTMwNTdcdTMwNjZcdTMwNEZcdTMwNjBcdTMwNTVcdTMwNDRcbiAgcHJpdmF0ZSBoYW5kbGVJbWFnZUNsaWNrID0gKGV2dDogTW91c2VFdmVudCwgZGVsZWdhdGVUYXJnZXQ6IEhUTUxJbWFnZUVsZW1lbnQpID0+IHtcbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHJldHVybjtcbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLm9wZW5PdmVybGF5KGRlbGVnYXRlVGFyZ2V0LnNyYyk7XG4gIH07XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIC8vIERlbGVnYXRlZCBjbGljayBoYW5kbGVyIFx1MjAxNCBidWJibGUgcGhhc2UsIG5vIGludGVyZmVyZW5jZSB3aXRoIE9ic2lkaWFuIGludGVybmFsc1xuICAgIGRvY3VtZW50Lm9uKCdjbGljaycsIElNR19TRUxFQ1RPUiwgdGhpcy5oYW5kbGVJbWFnZUNsaWNrKTtcbiAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IGRvY3VtZW50Lm9mZignY2xpY2snLCBJTUdfU0VMRUNUT1IsIHRoaXMuaGFuZGxlSW1hZ2VDbGljaykpO1xuICB9XG5cbiAgb251bmxvYWQoKSB7XG4gICAgdGhpcy5jbG9zZU92ZXJsYXkoKTtcbiAgfVxuXG4gIHByaXZhdGUgb3Blbk92ZXJsYXkoc3JjOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHJldHVybjtcbiAgICB0aGlzLmN1cnJlbnRJbWdTcmMgPSBzcmM7XG5cbiAgICAvLyBDcmVhdGUgb3ZlcmxheVxuICAgIGNvbnN0IG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBvdmVybGF5LmFkZENsYXNzKCdpbWFnZS1lbmxhcmdlLW92ZXJsYXknKTtcbiAgICB0aGlzLm92ZXJsYXlFbCA9IG92ZXJsYXk7XG5cbiAgICAvLyBDcmVhdGUgaW1hZ2Ugdmlld1xuICAgIGNvbnN0IGltZ1ZpZXcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICBpbWdWaWV3LmFkZENsYXNzKCdpbWFnZS1lbmxhcmdlLXZpZXcnKTtcbiAgICBpbWdWaWV3LnNyYyA9IHNyYztcblxuICAgIC8vIENyZWF0ZSBidXR0b24gZ3JvdXBcbiAgICBjb25zdCBidG5Hcm91cCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGJ0bkdyb3VwLmFkZENsYXNzKCdpbWFnZS1lbmxhcmdlLWJ0bi1ncm91cCcpO1xuXG4gICAgY29uc3QgY29weUJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGNvcHlCdG4uYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2UtYnRuJyk7XG4gICAgY29weUJ0bi50ZXh0Q29udGVudCA9ICdDb3B5JztcblxuICAgIGNvbnN0IGNvcHlQYXRoQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgY29weVBhdGhCdG4uYWRkQ2xhc3MoJ2ltYWdlLWVubGFyZ2UtYnRuJyk7XG4gICAgY29weVBhdGhCdG4udGV4dENvbnRlbnQgPSAnQ29weSBQYXRoJztcblxuICAgIGJ0bkdyb3VwLmFwcGVuZENoaWxkKGNvcHlCdG4pO1xuICAgIGJ0bkdyb3VwLmFwcGVuZENoaWxkKGNvcHlQYXRoQnRuKTtcbiAgICBvdmVybGF5LmFwcGVuZENoaWxkKGltZ1ZpZXcpO1xuICAgIG92ZXJsYXkuYXBwZW5kQ2hpbGQoYnRuR3JvdXApO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3ZlcmxheSk7XG5cbiAgICAvLyBXYWl0IGZvciBpbWFnZSB0byBsb2FkLCB0aGVuIGNhbGN1bGF0ZSBmaXQgc2l6ZVxuICAgIGNvbnN0IHJlYWxJbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICByZWFsSW1nLnNyYyA9IHNyYztcbiAgICByZWFsSW1nLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgIHRoaXMuY2FsY3VsYXRlRml0U2l6ZShyZWFsSW1nLCBpbWdWaWV3KTtcbiAgICB9O1xuICAgIGlmIChyZWFsSW1nLmNvbXBsZXRlKSB7XG4gICAgICB0aGlzLmNhbGN1bGF0ZUZpdFNpemUocmVhbEltZywgaW1nVmlldyk7XG4gICAgfVxuXG4gICAgLy8gQ2xvc2Ugb24gYmFja2dyb3VuZCBjbGlja1xuICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgaWYgKGUudGFyZ2V0ID09PSBvdmVybGF5KSB0aGlzLmNsb3NlT3ZlcmxheSgpO1xuICAgIH0pO1xuXG4gICAgLy8gS2V5Ym9hcmQgdmlhIE9ic2lkaWFuIFNjb3BlIFx1MjAxNCBpbnRlZ3JhdGVzIHdpdGggS2V5bWFwIHN5c3RlbVxuICAgIHRoaXMub3ZlcmxheVNjb3BlID0gbmV3IFNjb3BlKCk7XG4gICAgdGhpcy5vdmVybGF5U2NvcGUucmVnaXN0ZXIobnVsbCwgJ0VzY2FwZScsICgpID0+IHtcbiAgICAgIHRoaXMuY2xvc2VPdmVybGF5KCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG4gICAgdGhpcy5vdmVybGF5U2NvcGUucmVnaXN0ZXIoWydNb2QnXSwgJ2MnLCAoKSA9PiB7XG4gICAgICB0aGlzLmNvcHlJbWFnZVRvQ2xpcGJvYXJkKGltZ1ZpZXcpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICAgIHRoaXMub3ZlcmxheVNjb3BlLnJlZ2lzdGVyKFsnTW9kJywgJ1NoaWZ0J10sICdjJywgKCkgPT4ge1xuICAgICAgdGhpcy5jb3B5SW1hZ2VQYXRoKHNyYyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG4gICAgdGhpcy5hcHAua2V5bWFwLnB1c2hTY29wZSh0aGlzLm92ZXJsYXlTY29wZSk7XG5cbiAgICAvLyBNb3VzZXdoZWVsIHpvb21cbiAgICBpbWdWaWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGNvbnN0IHpvb21JbiA9IGUuZGVsdGFZIDwgMDtcbiAgICAgIGNvbnN0IHJhdGlvID0gem9vbUluID8gMC4xIDogLTAuMTtcbiAgICAgIGNvbnN0IHJlY3QgPSBpbWdWaWV3LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgY29uc3Qgb2Zmc2V0WCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICAgIGNvbnN0IG9mZnNldFkgPSBlLmNsaWVudFkgLSByZWN0LnRvcDtcbiAgICAgIHRoaXMuem9vbShyYXRpbywgeyBvZmZzZXRYLCBvZmZzZXRZIH0pO1xuICAgICAgdGhpcy5hcHBseVRyYW5zZm9ybShpbWdWaWV3KTtcbiAgICB9KTtcblxuICAgIC8vIENvcHkgYnV0dG9uXG4gICAgY29weUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGhpcy5jb3B5SW1hZ2VUb0NsaXBib2FyZChpbWdWaWV3KTtcbiAgICB9KTtcblxuICAgIC8vIENvcHkgUGF0aCBidXR0b25cbiAgICBjb3B5UGF0aEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGhpcy5jb3B5SW1hZ2VQYXRoKHNyYyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUZpdFNpemUocmVhbEltZzogSFRNTEltYWdlRWxlbWVudCwgaW1nVmlldzogSFRNTEltYWdlRWxlbWVudCkge1xuICAgIGNvbnN0IHdpblcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XG4gICAgY29uc3Qgd2luSCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgLSAxMDA7XG4gICAgY29uc3Qgem9vbVcgPSB3aW5XICogWk9PTV9GQUNUT1I7XG4gICAgY29uc3Qgem9vbUggPSB3aW5IICogWk9PTV9GQUNUT1I7XG5cbiAgICBsZXQgdyA9IHJlYWxJbWcubmF0dXJhbFdpZHRoLCBoID0gcmVhbEltZy5uYXR1cmFsSGVpZ2h0O1xuICAgIGlmIChoID4gem9vbUgpIHtcbiAgICAgIGggPSB6b29tSDtcbiAgICAgIHcgPSBoIC8gcmVhbEltZy5uYXR1cmFsSGVpZ2h0ICogcmVhbEltZy5uYXR1cmFsV2lkdGg7XG4gICAgICBpZiAodyA+IHpvb21XKSB3ID0gem9vbVc7XG4gICAgfSBlbHNlIGlmICh3ID4gem9vbVcpIHtcbiAgICAgIHcgPSB6b29tVztcbiAgICB9XG4gICAgaCA9IHcgKiByZWFsSW1nLm5hdHVyYWxIZWlnaHQgLyByZWFsSW1nLm5hdHVyYWxXaWR0aDtcblxuICAgIHRoaXMuaW1nSW5mbyA9IHtcbiAgICAgIGN1cldpZHRoOiB3LFxuICAgICAgY3VySGVpZ2h0OiBoLFxuICAgICAgcmVhbFdpZHRoOiByZWFsSW1nLm5hdHVyYWxXaWR0aCxcbiAgICAgIHJlYWxIZWlnaHQ6IHJlYWxJbWcubmF0dXJhbEhlaWdodCxcbiAgICAgIGxlZnQ6ICh3aW5XIC0gdykgLyAyLFxuICAgICAgdG9wOiAod2luSCAtIGgpIC8gMixcbiAgICB9O1xuICAgIHRoaXMuYXBwbHlUcmFuc2Zvcm0oaW1nVmlldyk7XG4gIH1cblxuICBwcml2YXRlIHpvb20ocmF0aW86IG51bWJlciwgb2Zmc2V0OiB7IG9mZnNldFg6IG51bWJlcjsgb2Zmc2V0WTogbnVtYmVyIH0pIHtcbiAgICBjb25zdCBpbmZvID0gdGhpcy5pbWdJbmZvO1xuICAgIGNvbnN0IHpvb21JbiA9IHJhdGlvID4gMDtcbiAgICBjb25zdCBtdWx0aXBsaWVyID0gem9vbUluID8gMSArIHJhdGlvIDogMSAvICgxIC0gcmF0aW8pO1xuICAgIGxldCB6b29tUmF0aW8gPSBpbmZvLmN1cldpZHRoICogbXVsdGlwbGllciAvIGluZm8ucmVhbFdpZHRoO1xuXG4gICAgLy8gU25hcCB0byAxMDAlIHdoZW4gY3Jvc3NpbmcgdGhlIDE6MSB0aHJlc2hvbGRcbiAgICBjb25zdCBjdXJSYXRpbyA9IGluZm8uY3VyV2lkdGggLyBpbmZvLnJlYWxXaWR0aDtcbiAgICBpZiAoKGN1clJhdGlvIDwgMSAmJiB6b29tUmF0aW8gPiAxKSB8fCAoY3VyUmF0aW8gPiAxICYmIHpvb21SYXRpbyA8IDEpKSB7XG4gICAgICB6b29tUmF0aW8gPSAxO1xuICAgICAgY29uc3Qgc25hcE11bHRpcGxpZXIgPSAxIC8gY3VyUmF0aW87XG4gICAgICBpbmZvLmxlZnQgKz0gb2Zmc2V0Lm9mZnNldFggKiAoMSAtIHNuYXBNdWx0aXBsaWVyKTtcbiAgICAgIGluZm8udG9wICs9IG9mZnNldC5vZmZzZXRZICogKDEgLSBzbmFwTXVsdGlwbGllcik7XG4gICAgICBpbmZvLmN1cldpZHRoID0gaW5mby5yZWFsV2lkdGg7XG4gICAgICBpbmZvLmN1ckhlaWdodCA9IGluZm8ucmVhbEhlaWdodDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgbmV3VyA9IGluZm8ucmVhbFdpZHRoICogem9vbVJhdGlvO1xuICAgIGxldCBuZXdIID0gaW5mby5yZWFsSGVpZ2h0ICogem9vbVJhdGlvO1xuXG4gICAgLy8gRW5mb3JjZSBtaW5pbXVtIHNpemVcbiAgICBpZiAobmV3VyA8IElNR19WSUVXX01JTiB8fCBuZXdIIDwgSU1HX1ZJRVdfTUlOKSB7XG4gICAgICBpZiAobmV3VyA8IElNR19WSUVXX01JTikge1xuICAgICAgICBuZXdXID0gSU1HX1ZJRVdfTUlOO1xuICAgICAgICBuZXdIID0gbmV3VyAqIGluZm8ucmVhbEhlaWdodCAvIGluZm8ucmVhbFdpZHRoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3SCA9IElNR19WSUVXX01JTjtcbiAgICAgICAgbmV3VyA9IG5ld0ggKiBpbmZvLnJlYWxXaWR0aCAvIGluZm8ucmVhbEhlaWdodDtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpbmZvLmxlZnQgKz0gb2Zmc2V0Lm9mZnNldFggKiAoMSAtIG11bHRpcGxpZXIpO1xuICAgIGluZm8udG9wICs9IG9mZnNldC5vZmZzZXRZICogKDEgLSBtdWx0aXBsaWVyKTtcbiAgICBpbmZvLmN1cldpZHRoID0gbmV3VztcbiAgICBpbmZvLmN1ckhlaWdodCA9IG5ld0g7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5VHJhbnNmb3JtKGltZ1ZpZXc6IEhUTUxJbWFnZUVsZW1lbnQpIHtcbiAgICBjb25zdCBpbmZvID0gdGhpcy5pbWdJbmZvO1xuICAgIGltZ1ZpZXcuc3R5bGUud2lkdGggPSBpbmZvLmN1cldpZHRoICsgJ3B4JztcbiAgICBpbWdWaWV3LnN0eWxlLmhlaWdodCA9IGluZm8uY3VySGVpZ2h0ICsgJ3B4JztcbiAgICBpbWdWaWV3LnN0eWxlLmxlZnQgPSBpbmZvLmxlZnQgKyAncHgnO1xuICAgIGltZ1ZpZXcuc3R5bGUudG9wID0gaW5mby50b3AgKyAncHgnO1xuICB9XG5cbiAgcHJpdmF0ZSBjb3B5SW1hZ2VQYXRoKHNyYzogc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IHBhdGggPSBzcmM7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoc3JjKTtcbiAgICAgIGNvbnN0IGRlY29kZWRQYXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KHVybC5wYXRobmFtZSk7XG4gICAgICBjb25zdCB2YXVsdEJhc2VQYXRoID0gKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgYXMgYW55KS5iYXNlUGF0aCBhcyBzdHJpbmc7XG4gICAgICBpZiAodmF1bHRCYXNlUGF0aCAmJiBkZWNvZGVkUGF0aC5pbmNsdWRlcyh2YXVsdEJhc2VQYXRoKSkge1xuICAgICAgICBjb25zdCBpZHggPSBkZWNvZGVkUGF0aC5pbmRleE9mKHZhdWx0QmFzZVBhdGgpO1xuICAgICAgICBwYXRoID0gZGVjb2RlZFBhdGguc3Vic3RyaW5nKGlkeCArIHZhdWx0QmFzZVBhdGgubGVuZ3RoKTtcbiAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnLycpKSBwYXRoID0gcGF0aC5zdWJzdHJpbmcoMSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXRoID0gZGVjb2RlZFBhdGg7XG4gICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy8nKSkgcGF0aCA9IHBhdGguc3Vic3RyaW5nKDEpO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gSWYgbm90IGEgdmFsaWQgVVJMLCB1c2UgYXMtaXNcbiAgICB9XG4gICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQocGF0aCkudGhlbihcbiAgICAgICgpID0+IG5ldyBOb3RpY2UoJ1BhdGggY29waWVkOiAnICsgcGF0aCksXG4gICAgICAoKSA9PiBuZXcgTm90aWNlKCdGYWlsZWQgdG8gY29weSBwYXRoJylcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBjb3B5SW1hZ2VUb0NsaXBib2FyZChpbWdWaWV3OiBIVE1MSW1hZ2VFbGVtZW50KTogdm9pZCB7XG4gICAgY29uc3QgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICBpbWFnZS5jcm9zc09yaWdpbiA9ICdhbm9ueW1vdXMnO1xuICAgIGltYWdlLnNyYyA9IGltZ1ZpZXcuc3JjO1xuICAgIGltYWdlLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgY2FudmFzLndpZHRoID0gaW1hZ2UubmF0dXJhbFdpZHRoO1xuICAgICAgY2FudmFzLmhlaWdodCA9IGltYWdlLm5hdHVyYWxIZWlnaHQ7XG4gICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgIGlmICghY3R4KSByZXR1cm47XG4gICAgICBjdHguZmlsbFN0eWxlID0gJyNmZmYnO1xuICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICBjdHguZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNhbnZhcy50b0Jsb2IoYXN5bmMgKGJsb2IpID0+IHtcbiAgICAgICAgICBpZiAoIWJsb2IpIHtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBjb3B5IGltYWdlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlKFtcbiAgICAgICAgICAgICAgbmV3IENsaXBib2FyZEl0ZW0oeyAnaW1hZ2UvcG5nJzogYmxvYiB9KVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBuZXcgTm90aWNlKCdJbWFnZSBjb3BpZWQnKTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBjb3B5IGltYWdlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBuZXcgTm90aWNlKCdGYWlsZWQgdG8gY29weSBpbWFnZScpO1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfTtcbiAgICBpbWFnZS5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgbmV3IE5vdGljZSgnRmFpbGVkIHRvIGNvcHkgaW1hZ2UnKTtcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjbG9zZU92ZXJsYXkoKSB7XG4gICAgaWYgKHRoaXMub3ZlcmxheVNjb3BlKSB7XG4gICAgICB0aGlzLmFwcC5rZXltYXAucG9wU2NvcGUodGhpcy5vdmVybGF5U2NvcGUpO1xuICAgICAgdGhpcy5vdmVybGF5U2NvcGUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5vdmVybGF5RWwpIHtcbiAgICAgIHRoaXMub3ZlcmxheUVsLnJlbW92ZSgpO1xuICAgICAgdGhpcy5vdmVybGF5RWwgPSBudWxsO1xuICAgIH1cbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBc0M7QUFFdEMsSUFBTSxlQUFlO0FBQ3JCLElBQU0sY0FBYztBQUNwQixJQUFNLGVBQWU7QUFXckIsSUFBcUIscUJBQXJCLGNBQWdELHVCQUFPO0FB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
