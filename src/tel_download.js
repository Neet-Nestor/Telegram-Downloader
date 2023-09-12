// ==UserScript==
// @name         Telegram Media Downloader
// @name:zh-CN   Telegram下载器
// @version      1.04
// @namespace    https://github.com/Neet-Nestor/Telegram-Media-Downloader
// @description  Used to download images, GIFs, videos and voice messages on Telegram webapp even from channels restricting downloading and saving content
// @description:zh-cn 从禁止下载的Telegram频道中下载图片、视频及语音消息
// @author       Nestor Qin
// @license      GNU GPLv3
// @website      https://github.com/Neet-Nestor/Telegram-Media-Downloader
// @match        https://web.telegram.org/*
// @match        https://webk.telegram.org/*
// @match        https://webz.telegram.org/*
// @icon         https://img.icons8.com/color/452/telegram-app--v5.png
// ==/UserScript==

(function () {
  const logger = {
    info: (message, fileName = null) => {
      console.log(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
    error: (message, fileName = null) => {
      console.error(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
  };
  const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;
  const REFRESH_DELAY = 500;

  const downloadByGeneratedLink = (fileUrl, fileName) => {
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = fileUrl;
    a.download = fileName;
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(fileUrl);

    logger.info("Download triggered", fileName);
  };

  const tel_download_video = (url) => {
    let _blobs = [];
    let _next_offset = 0;
    let _total_size = null;
    let _file_extension = "mp4";

    let fileName =
      (Math.random() + 1).toString(36).substring(2, 10) + "." + _file_extension;

    // Some video src is in format:
    // 'stream/{"dcId":5,"location":{...},"size":...,"mimeType":"video/mp4","fileName":"xxxx.MP4"}'
    try {
      const metadata = JSON.parse(
        decodeURIComponent(url.split("/")[url.split("/").length - 1])
      );
      logger.info(metadata);
      if (metadata.fileName) {
        fileName = metadata.fileName;
      }
    } catch (e) {
      // Invalid JSON string, pass extracting fileName
    }

    const fetchNextPart = () => {
      fetch(url, {
        method: "GET",
        headers: {
          Range: `bytes=${_next_offset}-`,
        },
      })
        .then((res) => {
          if (![200, 206].includes(res.status)) {
            logger.error(
              "Non 200/206 response was received: " + res.status,
              fileName
            );
            return;
          }

          const mime = res.headers.get("Content-Type").split(";")[0];
          if (!mime.startsWith("video/")) {
            logger.error(
              "Get non video response with MIME type " + mime,
              fileName
            );
            throw "Get non video response with MIME type " + mime;
          }
          _file_extension = mime.split("/")[1];
          fileName = fileName.substring(0, fileName.indexOf('.') + 1) + _file_extension;

          const match = res.headers
            .get("Content-Range")
            .match(contentRangeRegex);

          const startOffset = parseInt(match[1]);
          const endOffset = parseInt(match[2]);
          const totalSize = parseInt(match[3]);

          if (startOffset !== _next_offset) {
            logger.error("Gap detected between responses.", fileName);
            logger.info("Last offset: " + _next_offset, fileName);
            logger.info("New start offset " + match[1], fileName);
            throw "Gap detected between responses.";
          }
          if (_total_size && totalSize !== _total_size) {
            logger.error("Total size differs", fileName);
            throw "Total size differs";
          }

          _next_offset = endOffset + 1;
          _total_size = totalSize;

          logger.info(
            `Get response: ${res.headers.get(
              "Content-Length"
            )} bytes data from ${res.headers.get("Content-Range")}`,
            fileName
          );
          logger.info(
            `Progress: ${((_next_offset * 100) / _total_size).toFixed(0)}%`,
            fileName
          );
          return res.blob();
        })
        .then((resBlob) => {
          _blobs.push(resBlob);
        })
        .then(() => {
          if (_next_offset < _total_size) {
            fetchNextPart();
          } else {
            save();
          }
        })
        .catch((reason) => {
          logger.error(reason, fileName);
        });
    };

    const save = () => {
      logger.info("Finish downloading blobs", fileName);
      logger.info("Concatenating blobs and downloading...", fileName);

      const blob = new Blob(_blobs, {type: "video/mp4"});
      const blobUrl = window.URL.createObjectURL(blob);

      logger.info("Final blob size: " + blob.size + " bytes", fileName);

      downloadByGeneratedLink(blobUrl, fileName)
    };

    fetchNextPart();
  };

  const tel_download_audio = (url) => {
    let _blobs = [];
    let _next_offset = 0
    let _total_size = null;
    const fileName = (Math.random() + 1).toString(36).substring(2, 10) + ".ogg";

    const fetchNextPart = () => {
      fetch(url, {
        method: "GET",
        headers: {
          Range: `bytes=${_next_offset}-`,
        },
      })
        .then((res) => {
          if (res.status !== 206 && res.status !== 200) {
            logger.error(
              "Non 200/206 response was received: " + res.status,
              fileName
            );
            return;
          }

          const mime = res.headers.get("Content-Type").split(";")[0];
          if (!mime.startsWith("audio/")) {
            logger.error(
              "Get non audio response with MIME type " + mime,
              fileName
            );
            throw "Get non audio response with MIME type " + mime;
          }

          const match = res.headers
            .get("Content-Range")
            .match(contentRangeRegex);

          const startOffset = parseInt(match[1]);
          const endOffset = parseInt(match[2]);
          const totalSize = parseInt(match[3]);

          if (startOffset !== _next_offset) {
            logger.error("Gap detected between responses.");
            logger.info("Last offset: " + _next_offset);
            logger.info("New start offset " + match[1]);
            throw "Gap detected between responses.";
          }
          if (_total_size && totalSize !== _total_size) {
            logger.error("Total size differs");
            throw "Total size differs";
          }

          _next_offset = endOffset + 1;
          _total_size = totalSize;

          logger.info(
            `Get response: ${res.headers.get(
              "Content-Length"
            )} bytes data from ${res.headers.get("Content-Range")}`
          );

          return res.blob();
        })
        .then((resBlob) => {
          _blobs.push(resBlob);
        })
        .then(() => {
          if (_next_offset < _total_size) {
            fetchNextPart();
          } else {
            save();
          }
        })
        .catch((reason) => {
          logger.error(reason, fileName);
        });
    };

    const save = () => {
      logger.info(
        "Finish downloading blobs. Concatenating blobs and downloading...",
        fileName
      );

      let blob = new Blob(_blobs, {type: "audio/ogg"});
      const blobUrl = window.URL.createObjectURL(blob);

      logger.info("Final blob size in bytes: " + blob.size, fileName);

      downloadByGeneratedLink(blobUrl, fileName);
    };

    fetchNextPart();
  };

  const tel_download_image = (imageUrl) => {
    const fileName =
      (Math.random() + 1).toString(36).substring(2, 10) + ".jpeg"; // assume jpeg

    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = imageUrl;
    a.download = fileName;
    a.click();
    document.body.removeChild(a);

    logger.info("Download triggered", fileName);
  };

  logger.info("Initialized");

  // For webz /a/ webapp
  setInterval(() => {
    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(
      "#MediaViewer .MediaViewerSlide--active"
    );
    if (!mediaContainer) return;
    const mediaViewerActions = document.querySelector(
      "#MediaViewer .MediaViewerActions"
    );
    if (!mediaViewerActions) return;

    const videoPlayer = mediaContainer.querySelector(
      ".MediaViewerContent > .VideoPlayer"
    );
    const img = mediaContainer.querySelector(".MediaViewerContent > div > img");
    // 1. Video player detected - Video or GIF
    // container > .MediaViewerSlides > .MediaViewerSlide > .MediaViewerContent > .VideoPlayer > video[src]
    const downloadIcon = document.createElement("i");
    downloadIcon.className = "icon icon-download";
    const downloadButton = document.createElement("button");
    downloadButton.className =
      "Button smaller translucent-white round tel-download";
    downloadButton.setAttribute("type", "button");
    downloadButton.setAttribute("title", "Download");
    downloadButton.setAttribute("aria-label", "Download");
    if (videoPlayer) {
      const videoUrl = videoPlayer.querySelector("video").currentSrc;
      downloadButton.setAttribute("data-tel-download-url", videoUrl);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        tel_download_video(videoUrl);
      };

      // Add download button to video controls
      const controls = videoPlayer.querySelector(".VideoPlayerControls");
      if (controls) {
        const buttons = controls.querySelector(".buttons");
        if (!buttons.querySelector("button.tel-download")) {
          const spacer = buttons.querySelector(".spacer");
          spacer.after(downloadButton);
        }
      }

      // Add/Update/Remove download button to topbar
      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          // There's existing download button, remove ours
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== videoUrl
        ) {
          // Update existing button
          telDownloadButton.onclick = () => {
            tel_download_video(videoUrl);
          };
          telDownloadButton.setAttribute("data-tel-download-url", videoUrl);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        // Add the button if there's no download button at all
        mediaViewerActions.prepend(downloadButton);
      }
    } else if (img && img.src) {
      downloadButton.setAttribute("data-tel-download-url", img.src);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        tel_download_image(img.src);
      };

      // Add/Update/Remove download button to topbar
      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          // There's existing download button, remove ours
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== img.src
        ) {
          // Update existing button
          telDownloadButton.onclick = () => {
            tel_download_image(img.src);
          };
          telDownloadButton.setAttribute("data-tel-download-url", img.src);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        // Add the button if there's no download button at all
        mediaViewerActions.prepend(downloadButton);
      }
    }
  }, REFRESH_DELAY);

  // For webk /k/ webapp
  setInterval(() => {
    /* Voice Message */
    const pinnedAudio = document.body.querySelector(".pinned-audio");
    let dataMid;
    let downloadButtonPinnedAudio = document.body.querySelector("._tel_download_button_pinned_container") || document.createElement("button");
    if (pinnedAudio) {
      dataMid = pinnedAudio.getAttribute("data-mid");
      downloadButtonPinnedAudio.className = "btn-icon tgico-download _tel_download_button_pinned_container";
    }
    const voiceMessages = document.body.querySelectorAll("audio-element");
    voiceMessages.forEach((voiceMessage) => {
      const bubble = voiceMessage.closest(".bubble");
      const link = voiceMessage.audio.getAttribute("src");
      if (dataMid && downloadButtonPinnedAudio.getAttribute("data-mid") !== dataMid && voiceMessage.getAttribute("data-mid") === dataMid) {
        downloadButtonPinnedAudio.onclick = (e) => {
          e.stopPropagation();
          tel_download_audio(link);
        }
        downloadButtonPinnedAudio.setAttribute("data-mid", dataMid);
      }
      if (!bubble || bubble.querySelector("._tel_download_button_voice_container")) {
        return; /* Skip if there's already a download button */
      }
      if (link) {
        const container = document.createElement("div");
        container.className = "_tel_download_button_voice_container";
        container.style.display = "flex";
        container.style.justifyContent = "center";
        container.style.alignItems = "end";
        container.style.zIndex = "2";
        container.style.order = "0";
        container.classList.add("bubble-content-wrapper");

        const downloadButton = document.createElement("button");
        downloadButton.className = "btn-icon default__button tgico-download tel-download";
        downloadButton.style.marginBottom = "16px";
        downloadButton.style.backgroundColor = "black";

        downloadButton.onclick = (e) => {
          e.stopPropagation();
          tel_download_audio(link);
        };
        voiceMessage.closest(".bubble").appendChild(container);
        container.appendChild(downloadButton);
      }
    });
    if (pinnedAudio && !downloadButtonPinnedAudio.parentNode) {
      pinnedAudio.querySelector(".pinned-container-wrapper-utils").appendChild(downloadButtonPinnedAudio);
    }


    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(".media-viewer-whole");
    if (!mediaContainer) return;
    const mediaAspecter = mediaContainer.querySelector(
      ".media-viewer-movers .media-viewer-aspecter"
    );
    const mediaButtons = mediaContainer.querySelector(
      ".media-viewer-topbar .media-viewer-buttons"
    );
    if (!mediaAspecter || !mediaButtons) return;

    // If the download button is hidden, we can simply unhide it
    if (mediaButtons.querySelector(".btn-icon.tgico-download")) {
      const button = mediaButtons.querySelector(
        "button.btn-icon.tgico-download"
      );
      if (button.classList.contains("hide")) {
        button.classList.remove("hide");
      }
    }
    // If forward button is hidden, we can simply unhide it too
    if (mediaButtons.querySelector("button.btn-icon.tgico-forward")) {
      const button = mediaButtons.querySelector(
        "button.btn-icon.tgico-forward"
      );
      if (button.classList.contains("hide")) {
        button.classList.remove("hide");
      }
    }

    if (mediaAspecter.querySelector(".ckin__player")) {
      // 1. Video player detected - Video and it has finished initial loading
      // container > .ckin__player > video[src]

      // add download button to videos
      const controls = mediaAspecter.querySelector(
        ".default__controls.ckin__controls"
      );
      const videoUrl = mediaAspecter.querySelector("video").src;

      if (controls && !controls.querySelector(".tel-download")) {
        const brControls = controls.querySelector(
          ".bottom-controls .right-controls"
        );
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "btn-icon default__button tgico-download tel-download";
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          tel_download_video(videoUrl);
        };
        brControls.prepend(downloadButton);
      }
    } else if (
      mediaAspecter.querySelector("video") &&
      mediaAspecter.querySelector("video") &&
      !mediaButtons.querySelector("button.btn-icon.tgico-download")
    ) {
      // 2. Video HTML element detected, could be either GIF or unloaded video
      // container > video[src]
      const videoUrl = mediaAspecter.querySelector("video").src;
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      downloadButton.onclick = () => {
        tel_download_video(videoUrl);
      };
      mediaButtons.prepend(downloadButton);
    } else if (!mediaButtons.querySelector("button.btn-icon.tgico-download")) {
      // 3. Image without download button detected
      // container > img.thumbnail
      const imageUrl = mediaAspecter.querySelector("img.thumbnail").src;
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      downloadButton.onclick = () => {
        tel_download_image(imageUrl);
      };
      mediaButtons.prepend(downloadButton);
    }
  }, REFRESH_DELAY);
})();
